const express = require("express");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const validate = require("../middleware/validate.middleware");
const audit = require("../middleware/audit.middleware");
const Hazard = require("../models/Hazard");
const User = require("../models/User");
const {
  createHazardSchema,
  updateHazardSchema,
  assignHazardSchema,
  correctiveActionSchema,
  closeHazardSchema
} = require("../validators/hazard.validators");
const { uploadManyAssets } = require("../utils/uploads");
const { createMemoryUpload } = require("../utils/multer");
const { createNotification } = require("../services/notifications.service");
const {
  escapeRegex,
  getPagination,
  buildPaginationMeta,
  hasPagination
} = require("../utils/pagination");

const router = express.Router();
const upload = createMemoryUpload({ maxFileSizeMb: 10, maxFiles: 7 });
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
const toLegacyHazardRecord = (record) => {
  const plain = typeof record.toObject === "function" ? record.toObject() : record;
  return {
    ...plain,
    status: plain.status === "Closed" ? "Closed" : "Open",
    date: plain.date || plain.createdAt,
    beforeImage: plain.evidenceImages?.[0]?.url || plain.beforeImage || "",
    afterImage: plain.closureImages?.[0]?.url || plain.afterImage || "",
    reportedBy:
      typeof plain.reportedBy === "object"
        ? plain.reportedBy?.name || plain.reportedByName || ""
        : plain.reportedByName || plain.reportedBy || ""
  };
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
      records: records.map(toLegacyHazardRecord),
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
    { name: "beforeImage", maxCount: 1 }
  ]),
  asyncHandler(async (req, res) => {
    const parsed = createHazardSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed", parsed.error.flatten());
    }

    const evidenceFiles = [...(req.files?.evidenceImages || []), ...(req.files?.beforeImage || [])];
    if (!evidenceFiles.length) {
      throw new ApiError(400, "Before image is required");
    }
    const evidenceImages = await uploadManyAssets(
      evidenceFiles,
      "safety-hse/hazards/evidence",
      "image"
    );

    const payload = parsed.data;
    const normalizedTitle =
      payload.title || `${payload.category || "Hazard"} - ${payload.plaza || payload.location || "Site"}`;
    const normalizedDescription =
      payload.description ||
      `${payload.category || "Hazard"} reported at ${payload.location || "-"}${
        payload.reportedBy ? ` by ${payload.reportedBy}` : ""
      }`;
    const hazard = await Hazard.create({
      ...payload,
      title: normalizedTitle,
      description: normalizedDescription,
      evidenceImages,
      beforeImage: evidenceImages[0]?.url || "",
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

    if (hazard.assignedTo) {
      await createNotification({
        userId: hazard.assignedTo,
        type: "hazard",
        title: "Hazard Assigned",
        message: `${hazard.title} has been assigned to you`,
        data: { hazardId: hazard._id },
        priority: "high"
      });
    }

    await audit(req, "create", "hazards", { title: hazard.title }, hazard._id);
    res.status(201).json({ success: true, hazard: toLegacyHazardRecord(hazard) });
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
    res.json({ success: true, hazard: toLegacyHazardRecord(hazard) });
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

    await createNotification({
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
    { name: "afterImage", maxCount: 1 }
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
    if (!closureFiles.length) {
      throw new ApiError(400, "After image is required to close hazard");
    }
    const closureImages = await uploadManyAssets(
      closureFiles,
      "safety-hse/hazards/closure",
      "image"
    );

    hazard.status = "Closed";
    hazard.closureNotes = parsed.data.closureNotes;
    hazard.closureImages = [...(hazard.closureImages || []), ...closureImages];
    hazard.afterImage = hazard.closureImages[0]?.url || closureImages[0]?.url || "";
    hazard.timeline.push({
      label: "Hazard Closed",
      description: parsed.data.closureNotes || "Hazard closed",
      user: req.user.id
    });
    await hazard.save();

    await audit(req, "close", "hazards", { closureImages: closureImages.length }, hazard._id);
    res.json({ success: true, hazard: toLegacyHazardRecord(hazard) });
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
