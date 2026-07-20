const express = require("express");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const validate = require("../middleware/validate.middleware");
const audit = require("../middleware/audit.middleware");
const Hazard = require("../models/Hazard");
const User = require("../models/User");
const { ROLES } = require("../constants/roles");
const {
  createHazardSchema,
  updateHazardSchema,
  assignHazardSchema,
  correctiveActionSchema,
  closeHazardSchema
} = require("../validators/hazard.validators");
const { uploadManyAssets } = require("../utils/uploads");
const { IMAGE_MIME_TYPES, VIDEO_MIME_TYPES, createMemoryUpload } = require("../utils/multer");
const {
  parseMediaMetadata,
  mergeMediaMetadata,
  normalizeRecordLocations,
  normalizeLocation
} = require("../utils/media-metadata");
const { reverseGeocode } = require("../services/location.service");
const logger = require("../utils/logger");
const { createNotification } = require("../services/notifications.service");
const {
  escapeRegex,
  getPagination,
  buildPaginationMeta,
  hasPagination
} = require("../utils/pagination");

const router = express.Router();
const MB = 1024 * 1024;
const HAZARD_IMAGE_LIMIT_MB = 10;
const HAZARD_VIDEO_LIMIT_MB = 100;
const HAZARD_MEDIA_MAX_COUNT = 6;
const upload = createMemoryUpload({
  allowedMimeTypes: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES],
  maxFileSizeMb: HAZARD_VIDEO_LIMIT_MB,
  maxFiles: 20
});
const severityWeight = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4
};
const likelihoodWeight = {
  Rare: 1,
  Possible: 2,
  Likely: 3,
  "Almost Certain": 4
};
const sameUser = (left, right) => String(left?._id || left || "") === String(right?._id || right || "");
const parseRecordLocation = (raw, userId) => {
  if (!raw) return undefined;
  let value = raw;
  if (typeof raw === "string") {
    try { value = JSON.parse(raw); } catch (_error) { throw new ApiError(400, "Location details are invalid"); }
  }
  return normalizeLocation({ ...value, updatedBy: userId }, "record");
};

const queueNotification = (payload) => {
  setImmediate(() => {
    createNotification(payload).catch(() => {
      // Notification delivery must not roll back an authoritative hazard update.
    });
  });
};

const validateHazardMedia = ({ images = [], videos = [], label = "Hazard media" }) => {
  if (images.length > HAZARD_MEDIA_MAX_COUNT) {
    throw new ApiError(400, `${label}: maximum ${HAZARD_MEDIA_MAX_COUNT} images allowed`);
  }
  if (videos.length > HAZARD_MEDIA_MAX_COUNT) {
    throw new ApiError(400, `${label}: maximum ${HAZARD_MEDIA_MAX_COUNT} videos allowed`);
  }
  images.forEach((file) => {
    if (file.size > HAZARD_IMAGE_LIMIT_MB * MB) {
      throw new ApiError(400, `${file.originalname || "Image"} exceeds ${HAZARD_IMAGE_LIMIT_MB}MB image limit`);
    }
  });
  videos.forEach((file) => {
    if (file.size > HAZARD_VIDEO_LIMIT_MB * MB) {
      throw new ApiError(400, `${file.originalname || "Video"} exceeds ${HAZARD_VIDEO_LIMIT_MB}MB video limit`);
    }
  });
};

const toLegacyHazardRecord = (record, user) => {
  const plain = typeof record.toObject === "function" ? record.toObject() : record;
  const serialized = {
    ...plain,
    status: plain.status === "Closed" ? "Closed" : "Open",
    date: plain.date || plain.createdAt,
    beforeImage: plain.evidenceImages?.[0]?.url || plain.beforeImage || "",
    afterImage: plain.closureImages?.[0]?.url || plain.afterImage || "",
    beforeVideo: plain.evidenceVideos?.[0]?.url || plain.beforeVideo || "",
    afterVideo: plain.closureVideos?.[0]?.url || plain.afterVideo || "",
    mediaCount:
      (plain.evidenceImages?.length || 0) +
      (plain.closureImages?.length || 0) +
      (plain.evidenceVideos?.length || 0) +
      (plain.closureVideos?.length || 0),
    reportedBy:
      typeof plain.reportedBy === "object"
        ? plain.reportedBy?.name || plain.reportedByName || ""
        : plain.reportedByName || plain.reportedBy || ""
  };
  return normalizeRecordLocations(
    serialized,
    ["evidenceImages", "closureImages", "evidenceVideos", "closureVideos"]
  );
};

router.get(
  "/",
  authMiddleware,
  authorizePermission("hazards", "view"),
  asyncHandler(async (req, res) => {
    const filters = {};
    const { status, category, severity, location, assignedTo, search } = req.query;
    if (status) filters.status = status;
    if (category) filters.category = category;
    if (severity) filters.severity = severity;
    if (location) filters.location = new RegExp(escapeRegex(location), "i");
    if (assignedTo) filters.assignedTo = assignedTo;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filters.$or = [{ title: regex }, { description: regex }, { location: regex }];
    }

    const shouldPaginate = hasPagination(req.query);
    const pagination = getPagination(req.query);
    let query = Hazard.find(filters)
      .populate("reportedBy", "name role")
      .populate("assignedTo", "name role")
      .populate("correctiveActions.owner", "name role")
      .sort({ createdAt: -1 });
    if (shouldPaginate) {
      query = query.skip(pagination.skip).limit(pagination.limit);
    }

    const [records, total] = await Promise.all([
      query,
      Hazard.countDocuments(filters)
    ]);
    res.json({
      success: true,
      records: records.map((record) => toLegacyHazardRecord(record, req.user)),
      pagination: shouldPaginate
        ? buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total })
        : { total, unpaginated: true }
    });
  })
);

router.post(
  "/",
  authMiddleware,
  authorizePermission("hazards", "create"),
  upload.fields([
    { name: "evidenceImages", maxCount: 6 },
    { name: "beforeImage", maxCount: 1 },
    { name: "evidenceVideos", maxCount: 6 },
    { name: "beforeVideo", maxCount: 1 },
    { name: "evidenceVideoThumbnails", maxCount: 6 }
  ]),
  asyncHandler(async (req, res) => {
    const parsed = createHazardSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed", parsed.error.flatten());
    }

    const evidenceFiles = [...(req.files?.evidenceImages || []), ...(req.files?.beforeImage || [])];
    const evidenceVideoFiles = [...(req.files?.evidenceVideos || []), ...(req.files?.beforeVideo || [])];
    const evidenceVideoThumbnailFiles = req.files?.evidenceVideoThumbnails || [];
    validateHazardMedia({ images: evidenceFiles, videos: evidenceVideoFiles, label: "Evidence media" });
    if (!evidenceFiles.length) {
      throw new ApiError(400, "Before image is required");
    }
    const imageMetadata = parseMediaMetadata(req.body.evidenceImageMetadata, {
      module: "hazard",
      stage: "before",
      mediaType: "image",
      maxCount: HAZARD_MEDIA_MAX_COUNT
    });
    const videoMetadata = parseMediaMetadata(req.body.evidenceVideoMetadata, {
      module: "hazard",
      stage: "before",
      mediaType: "video",
      maxCount: HAZARD_MEDIA_MAX_COUNT
    });
    const [rawEvidenceImages, rawEvidenceVideos, thumbnailUploads] = await Promise.all([
      uploadManyAssets(evidenceFiles, "safety-hse/hazards/evidence", "image"),
      uploadManyAssets(evidenceVideoFiles, "safety-hse/hazards/evidence-videos", "video"),
      uploadManyAssets(evidenceVideoThumbnailFiles, "safety-hse/hazards/video-thumbnails", "image")
    ]);
    const evidenceImages = mergeMediaMetadata(rawEvidenceImages, imageMetadata, {
      userId: req.user.id, module: "hazard", stage: "before", mediaType: "image"
    });
    const evidenceVideos = mergeMediaMetadata(rawEvidenceVideos, videoMetadata, {
      userId: req.user.id,
      thumbnails: thumbnailUploads,
      module: "hazard",
      stage: "before",
      mediaType: "video"
    });

    const payload = parsed.data;
    const geoLocation = parseRecordLocation(req.body.geoLocation, req.user.id);
    const normalizedTitle =
      payload.title || `${payload.category || "Hazard"} - ${payload.plaza || payload.location || "Site"}`;
    const normalizedDescription =
      payload.description ||
      `${payload.category || "Hazard"} reported at ${payload.location || "-"}${
        payload.reportedBy ? ` by ${payload.reportedBy}` : ""
      }`;
    const hazard = await Hazard.create({
      ...payload,
      ...(geoLocation ? { geoLocation } : {}),
      title: normalizedTitle,
      description: normalizedDescription,
      evidenceImages,
      beforeImage: evidenceImages[0]?.url || "",
      evidenceVideos,
      beforeVideo: evidenceVideos[0]?.url || "",
      date: payload.date ? new Date(payload.date) : new Date(),
      plaza: payload.plaza || "",
      action: payload.action || "",
      assignedTo: payload.assignedTo || null,
      reportedBy: req.user.id,
      reportedByName: payload.reportedBy || req.user.name || "",
      timeline: [
        {
          label: "Hazard Reported",
          description: "Initial report submitted",
          user: req.user.id
        }
      ]
    });
    logger.info("Media location metadata saved", {
      recordId: String(hazard._id),
      module: "hazard",
      stage: "before",
      mediaCount: evidenceImages.length + evidenceVideos.length,
      locationCount: [...evidenceImages, ...evidenceVideos].filter((item) => item.location?.latitude !== undefined).length
    });

    if (hazard.assignedTo) {
      queueNotification({
        userId: hazard.assignedTo,
        type: "hazard",
        title: "Hazard Assigned",
        message: `${hazard.title} has been assigned to you`,
        data: { hazardId: hazard._id },
        priority: "high"
      });
    }

    await audit(req, "create", "hazards", { title: hazard.title }, hazard._id);
    await audit(
      req,
      [...evidenceImages, ...evidenceVideos].some((item) => item.location?.latitude !== undefined)
        ? "location_attached"
        : "location_missing",
      "hazards",
      { mediaCount: evidenceImages.length + evidenceVideos.length },
      hazard._id
    );
    res.status(201).json({ success: true, hazard: toLegacyHazardRecord(hazard, req.user) });
  })
);

router.get(
  "/:id",
  authMiddleware,
  authorizePermission("hazards", "view"),
  asyncHandler(async (req, res) => {
    const hazard = await Hazard.findById(req.params.id)
      .populate("reportedBy", "name role")
      .populate("assignedTo", "name role")
      .populate("correctiveActions.owner", "name role");
    if (!hazard) throw new ApiError(404, "Hazard not found");
    res.json({ success: true, hazard: toLegacyHazardRecord(hazard, req.user) });
  })
);

router.patch(
  "/:id/location",
  authMiddleware,
  authorizePermission("hazards", "update"),
  asyncHandler(async (req, res) => {
    const hazard = await Hazard.findById(req.params.id);
    if (!hazard) throw new ApiError(404, "Hazard not found");
    const isOwner = sameUser(hazard.reportedBy, req.user.id) || sameUser(hazard.assignedTo, req.user.id);
    const isAdministrator = [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(req.user.role);
    if ((!isOwner || hazard.status === "Closed") && !isAdministrator) {
      throw new ApiError(403, "You cannot change this hazard location", null, "LOCATION_UPDATE_FORBIDDEN");
    }
    const reason = String(req.body.reason || "").trim();
    if (!reason) throw new ApiError(400, "A reason is required for every location change", null, "LOCATION_REASON_REQUIRED");
    const submitted = parseRecordLocation(req.body.location, req.user.id);
    if (!submitted?.latitude && submitted?.latitude !== 0) throw new ApiError(400, "Valid coordinates are required");
    const resolved = await reverseGeocode(submitted.latitude, submitted.longitude, { requestId: req.id });
    const nextLocation = normalizeLocation({ ...submitted, ...resolved, updatedBy: req.user.id, updatedAt: new Date() }, "record");
    hazard.locationAuditHistory.push({
      previousLocation: hazard.geoLocation?.toObject?.() || hazard.geoLocation || {},
      newLocation: nextLocation,
      reason,
      updatedBy: req.user.id,
      updatedByName: req.user.name || "",
      updatedByRole: req.user.role || ""
    });
    hazard.geoLocation = nextLocation;
    if (nextLocation.formattedAddress && nextLocation.formattedAddress !== "Address unavailable") hazard.location = nextLocation.formattedAddress;
    hazard.timeline.push({ label: "Location Updated", description: reason, user: req.user.id });
    await hazard.save();
    await audit(req, "location_updated", "hazards", { reason, previousLocation: hazard.locationAuditHistory.at(-1).previousLocation, newLocation: nextLocation }, hazard._id);
    res.json({ success: true, hazard: toLegacyHazardRecord(hazard, req.user) });
  })
);

router.patch(
  "/:id",
  authMiddleware,
  authorizePermission("hazards", "update"),
  validate(updateHazardSchema),
  asyncHandler(async (req, res) => {
    const hazard = await Hazard.findById(req.params.id);
    if (!hazard) throw new ApiError(404, "Hazard not found");

    const editableFields = [
      "title",
      "description",
      "category",
      "severity",
      "likelihood",
      "plaza",
      "location",
      "action"
    ];

    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        hazard[field] = req.body[field];
      }
    });

    if (req.body.date !== undefined) {
      hazard.date = req.body.date ? new Date(req.body.date) : null;
    }
    if (req.body.reportedBy !== undefined) {
      hazard.reportedByName = req.body.reportedBy;
    }

    hazard.title =
      hazard.title || `${hazard.category || "Hazard"} - ${hazard.plaza || hazard.location || "Site"}`;
    hazard.description =
      hazard.description ||
      `${hazard.category || "Hazard"} reported at ${hazard.location || "-"}${
        hazard.reportedByName ? ` by ${hazard.reportedByName}` : ""
      }`;
    hazard.riskScore =
      req.body.riskScore !== undefined
        ? req.body.riskScore
        : (severityWeight[hazard.severity] || 1) * (likelihoodWeight[hazard.likelihood] || 1);
    if (hazard.status !== "Closed") hazard.status = "Open";

    hazard.timeline.push({
      label: "Details Edited",
      description: "Submitted hazard details updated",
      user: req.user.id
    });

    await hazard.save();
    await audit(req, "update", "hazards", req.body, hazard._id);
    res.json({ success: true, hazard: toLegacyHazardRecord(hazard) });
  })
);

router.patch(
  "/:id/assign",
  authMiddleware,
  authorizePermission("hazards", "update"),
  validate(assignHazardSchema),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.body.assignedTo);
    if (!user) throw new ApiError(404, "Assignee not found");

    const hazard = await Hazard.findById(req.params.id);
    if (!hazard) throw new ApiError(404, "Hazard not found");

    hazard.assignedTo = req.body.assignedTo;
    if (hazard.status !== "Closed") hazard.status = "Open";
    hazard.timeline.push({
      label: "Assigned",
      description: `Assigned to ${user.name}`,
      user: req.user.id
    });
    await hazard.save();

    queueNotification({
      userId: user._id,
      type: "hazard",
      title: "New Hazard Assignment",
      message: `${hazard.title} has been assigned to you`,
      data: { hazardId: hazard._id },
      priority: "high"
    });

    await audit(req, "assign", "hazards", { assignedTo: user._id }, hazard._id);
    res.json({ success: true, hazard: toLegacyHazardRecord(hazard) });
  })
);

router.post(
  "/:id/corrective-actions",
  authMiddleware,
  authorizePermission("hazards", "update"),
  validate(correctiveActionSchema),
  asyncHandler(async (req, res) => {
    const hazard = await Hazard.findById(req.params.id);
    if (!hazard) throw new ApiError(404, "Hazard not found");

    hazard.correctiveActions.push({
      action: req.body.action,
      owner: req.body.owner || null,
      targetDate: req.body.targetDate ? new Date(req.body.targetDate) : null,
      status: req.body.status
    });
    hazard.timeline.push({
      label: "Corrective Action Added",
      description: req.body.action,
      user: req.user.id
    });

    await hazard.save();
    await audit(req, "corrective_action", "hazards", req.body, hazard._id);
    res.json({ success: true, hazard: toLegacyHazardRecord(hazard) });
  })
);

router.patch(
  "/:id/close",
  authMiddleware,
  authorizePermission("hazards", "update"),
  upload.fields([
    { name: "closureImages", maxCount: 6 },
    { name: "afterImage", maxCount: 1 },
    { name: "closureVideos", maxCount: 6 },
    { name: "afterVideo", maxCount: 1 },
    { name: "closureVideoThumbnails", maxCount: 6 }
  ]),
  asyncHandler(async (req, res) => {
    const parsed = closeHazardSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed", parsed.error.flatten());
    }

    const hazard = await Hazard.findById(req.params.id);
    if (!hazard) throw new ApiError(404, "Hazard not found");
    if (hazard.status === "Closed") {
      throw new ApiError(400, "Closed hazard is already locked");
    }

    const closureFiles = [...(req.files?.closureImages || []), ...(req.files?.afterImage || [])];
    const closureVideoFiles = [...(req.files?.closureVideos || []), ...(req.files?.afterVideo || [])];
    const closureVideoThumbnailFiles = req.files?.closureVideoThumbnails || [];
    validateHazardMedia({ images: closureFiles, videos: closureVideoFiles, label: "Closure media" });
    if (!closureFiles.length) {
      throw new ApiError(400, "After image is required to close hazard");
    }
    const imageMetadata = parseMediaMetadata(req.body.closureImageMetadata, {
      module: "hazard",
      stage: "after",
      mediaType: "image",
      maxCount: HAZARD_MEDIA_MAX_COUNT
    });
    const videoMetadata = parseMediaMetadata(req.body.closureVideoMetadata, {
      module: "hazard",
      stage: "after",
      mediaType: "video",
      maxCount: HAZARD_MEDIA_MAX_COUNT
    });
    const [rawClosureImages, rawClosureVideos, thumbnailUploads] = await Promise.all([
      uploadManyAssets(closureFiles, "safety-hse/hazards/closure", "image"),
      uploadManyAssets(closureVideoFiles, "safety-hse/hazards/closure-videos", "video"),
      uploadManyAssets(closureVideoThumbnailFiles, "safety-hse/hazards/video-thumbnails", "image")
    ]);
    const closureImages = mergeMediaMetadata(rawClosureImages, imageMetadata, {
      userId: req.user.id, module: "hazard", stage: "after", mediaType: "image"
    });
    const closureVideos = mergeMediaMetadata(rawClosureVideos, videoMetadata, {
      userId: req.user.id,
      thumbnails: thumbnailUploads,
      module: "hazard",
      stage: "after",
      mediaType: "video"
    });

    hazard.status = "Closed";
    hazard.closureNotes = parsed.data.closureNotes;
    hazard.closureImages = [...(hazard.closureImages || []), ...closureImages];
    hazard.closureVideos = [...(hazard.closureVideos || []), ...closureVideos];
    hazard.afterImage = hazard.closureImages[0]?.url || closureImages[0]?.url || "";
    hazard.afterVideo = hazard.closureVideos[0]?.url || closureVideos[0]?.url || "";
    hazard.timeline.push({
      label: "Hazard Closed",
      description: parsed.data.closureNotes || "Hazard closed",
      user: req.user.id
    });
    await hazard.save();
    logger.info("Media location metadata saved", {
      recordId: String(hazard._id),
      module: "hazard",
      stage: "after",
      mediaCount: closureImages.length + closureVideos.length,
      locationCount: [...closureImages, ...closureVideos].filter((item) => item.location?.latitude !== undefined).length
    });

    await audit(
      req,
      "close",
      "hazards",
      {
        closureImages: closureImages.length,
        closureVideos: closureVideos.length,
        locationAvailability: [...closureImages, ...closureVideos]
          .some((item) => item.location?.latitude !== undefined)
      },
      hazard._id
    );
    res.json({ success: true, hazard: toLegacyHazardRecord(hazard, req.user) });
  })
);

router.delete(
  "/:id",
  authMiddleware,
  authorizePermission("hazards", "delete"),
  asyncHandler(async (req, res) => {
    const hazard = await Hazard.findById(req.params.id);
    if (!hazard) throw new ApiError(404, "Hazard not found");
    await Hazard.findByIdAndDelete(req.params.id);
    await audit(req, "delete", "hazards", { title: hazard.title }, hazard._id);
    res.json({ success: true, message: "Hazard deleted" });
  })
);

module.exports = router;
