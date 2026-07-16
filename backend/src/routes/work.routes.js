const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission, authorizeRoles } = require("../middleware/rbac.middleware");
const validate = require("../middleware/validate.middleware");
const audit = require("../middleware/audit.middleware");
const WorkApproval = require("../models/WorkApproval");
const { ROLES } = require("../constants/roles");
const {
  createWorkSchema,
  updateWorkSchema,
  workflowActionSchema,
  statusUpdateSchema,
  commentSchema,
  signatureSchema
} = require("../validators/work.validators");
const { uploadManyAssets } = require("../utils/uploads");
const { createMemoryUpload, IMAGE_MIME_TYPES, VIDEO_MIME_TYPES } = require("../utils/multer");
const { createNotification } = require("../services/notifications.service");
const {
  getChainageFrom,
  getChainageTo,
  normalizeChainagePayload
} = require("../utils/chainage");

const router = express.Router();
const MB = 1024 * 1024;
const WORK_IMAGE_LIMIT_MB = 10;
const WORK_VIDEO_LIMIT_MB = 100;
const WORK_MEDIA_MAX_COUNT = 10;
const upload = createMemoryUpload({
  allowedMimeTypes: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES],
  maxFileSizeMb: WORK_VIDEO_LIMIT_MB,
  maxFiles: 22
});

const validateWorkMedia = ({ images = [], videos = [], label = "Work media" }) => {
  if (images.length > WORK_MEDIA_MAX_COUNT) {
    throw new ApiError(400, `${label}: maximum ${WORK_MEDIA_MAX_COUNT} images allowed`);
  }
  if (videos.length > WORK_MEDIA_MAX_COUNT) {
    throw new ApiError(400, `${label}: maximum ${WORK_MEDIA_MAX_COUNT} videos allowed`);
  }

  images.forEach((file) => {
    if (file.size > WORK_IMAGE_LIMIT_MB * MB) {
      throw new ApiError(400, `${file.originalname || "Image"} exceeds ${WORK_IMAGE_LIMIT_MB}MB image limit`);
    }
  });
  videos.forEach((file) => {
    if (file.size > WORK_VIDEO_LIMIT_MB * MB) {
      throw new ApiError(400, `${file.originalname || "Video"} exceeds ${WORK_VIDEO_LIMIT_MB}MB video limit`);
    }
  });
};

const parseDate = (value) => (value ? new Date(value) : null);
const toLegacyWorkRecord = (record) => {
  const plain = typeof record.toObject === "function" ? record.toObject() : record;
  const beforeImage = plain.beforeImages?.[0]?.url || plain.beforeImage || "";
  const afterImage = plain.afterImages?.[0]?.url || plain.afterImage || "";
  const beforeVideo = plain.beforeVideos?.[0]?.url || plain.beforeVideo || "";
  const afterVideo = plain.afterVideos?.[0]?.url || plain.afterVideo || "";
  const mediaCount =
    (plain.beforeImages?.length || 0) +
    (plain.afterImages?.length || 0) +
    (plain.beforeVideos?.length || 0) +
    (plain.afterVideos?.length || 0);
  const chainageFrom = getChainageFrom(plain);
  const chainageTo = getChainageTo(plain);
  const createdByName = plain.createdByName || plain.createdBy?.name || "";
  const createdByRole = plain.createdByRole || plain.createdBy?.role || "";
  const approvedBy = plain.approvedBy || plain.approvedById?.name || "";
  return {
    ...plain,
    approvalNumber: plain.approvalNumber || (plain._id ? `WA-${String(plain._id).slice(-8).toUpperCase()}` : ""),
    description: plain.description || plain.workDescription || "",
    chainageFrom,
    chainageTo,
    chainage: plain.chainage || chainageFrom,
    chainageNo: plain.chainageNo || plain.chainage || chainageFrom,
    beforeImage,
    afterImage,
    beforeVideo,
    afterVideo,
    beforeVideos: plain.beforeVideos || [],
    afterVideos: plain.afterVideos || [],
    mediaCount,
    createdByName,
    createdByRole,
    reportedBy: plain.reportedBy || createdByName,
    checkedBy: plain.checkedBy || "",
    recommendedBy: plain.recommendedBy || "",
    approvedBy,
    approvedByName: approvedBy,
    approvedByRole: plain.approvedByRole || "",
    approvedAt: plain.approvedAt || "",
    approvalDate: plain.approvedAt || "",
    completionDate: plain.completionDate || (plain.status === "Completed" ? plain.updatedAt : "")
  };
};

const buildWorkQuery = (query = {}) => {
  const filters = {};
  const search = String(query.search || query.q || "").trim();

  if (query.status) filters.status = query.status;
  if (query.workType) filters.workType = query.workType;
  if (query.plaza) filters.plaza = query.plaza;
  if (query.location) filters.location = new RegExp(query.location, "i");

  if (search) {
    const regex = new RegExp(search, "i");
    filters.$or = [
      { chainageFrom: regex },
      { chainageTo: regex },
      { chainageNo: regex },
      { chainage: regex },
      { location: regex },
      { workType: regex },
      { title: regex },
      { checkedBy: regex },
      { recommendedBy: regex },
      { approvedBy: regex },
      { createdByName: regex }
    ];
  }

  if (query.date) {
    const start = new Date(query.date);
    if (!Number.isNaN(start.getTime())) {
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      filters.createdAt = { $gte: start, $lte: end };
    }
  }

  return filters;
};

router.get(
  "/",
  authMiddleware,
  authorizePermission("work", "view"),
  asyncHandler(async (req, res) => {
    const records = await WorkApproval.find(buildWorkQuery(req.query))
      .populate("createdBy", "name role")
      .populate("assignedTo", "name role")
      .sort({ createdAt: -1 });
    res.json({ success: true, records: records.map(toLegacyWorkRecord) });
  })
);

router.post(
  "/",
  authMiddleware,
  authorizePermission("work", "create"),
  upload.fields([
    { name: "beforeImages", maxCount: 10 },
    { name: "beforeImage", maxCount: 1 },
    { name: "beforeVideos", maxCount: 10 },
    { name: "beforeVideo", maxCount: 1 }
  ]),
  asyncHandler(async (req, res) => {
    const normalizedBody = {
      ...req.body,
      ...normalizeChainagePayload(req.body)
    };
    const parsed = createWorkSchema.safeParse(normalizedBody);
    if (!parsed.success) {
      throw new ApiError(400, "Validation failed", parsed.error.flatten());
    }

    const beforeFiles = [...(req.files?.beforeImages || []), ...(req.files?.beforeImage || [])];
    const beforeVideoFiles = [...(req.files?.beforeVideos || []), ...(req.files?.beforeVideo || [])];
    validateWorkMedia({ images: beforeFiles, videos: beforeVideoFiles, label: "Before media" });
    if (!beforeFiles.length) {
      throw new ApiError(400, "Before image is required");
    }
    const beforeImages = await uploadManyAssets(
      beforeFiles,
      "safety-hse/work/before",
      "image"
    );
    const beforeVideos = await uploadManyAssets(
      beforeVideoFiles,
      "safety-hse/work/before-videos",
      "video"
    );

    const payload = parsed.data;
    const normalizedChainage = normalizeChainagePayload(payload);
    const work = await WorkApproval.create({
      ...payload,
      ...normalizedChainage,
      title: payload.title || `${payload.workType} - ${payload.location}`,
      description: payload.description || "",
      beforeImages,
      beforeImage: beforeImages[0]?.url || "",
      beforeVideos,
      beforeVideo: beforeVideos[0]?.url || "",
      createdBy: req.user.id,
      createdByName: req.user.name || "",
      createdByRole: req.user.role || "",
      checkedBy: payload.checkedBy || "",
      recommendedBy: payload.recommendedBy || "",
      assignedTo: payload.assignedTo || null,
      startDate: parseDate(payload.startDate),
      dueDate: parseDate(payload.dueDate),
      workflow: [],
      timeline: [
        {
          label: "Created",
          description: `Created by ${req.user.name || "User"}`,
          user: req.user.id
        }
      ]
    });

    if (work.assignedTo) {
      await createNotification({
        userId: work.assignedTo,
        type: "work",
        title: "New Work Approval",
        message: `${work.title} was assigned to you`,
        data: { workId: work._id }
      });
    }

    await audit(req, "create", "work", { title: work.title }, work._id);
    res.status(201).json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.get(
  "/:id",
  authMiddleware,
  authorizePermission("work", "view"),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id)
      .populate("createdBy", "name role")
      .populate("assignedTo", "name role")
      .populate("comments.user", "name role")
      .populate("digitalSignatures.signedBy", "name role");
    if (!work) throw new ApiError(404, "Work approval not found");
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.patch(
  "/:id",
  authMiddleware,
  authorizePermission("work", "update"),
  validate(updateWorkSchema),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");

    const editableFields = [
      "title",
      "workType",
      "description",
      "category",
      "plaza",
      "location",
      "chainage",
      "chainageNo",
      "chainageFrom",
      "chainageTo",
      "workersCount",
      "checkedBy",
      "recommendedBy",
      "priority"
    ];

    editableFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        work[field] = req.body[field];
      }
    });

    if (req.body.startDate !== undefined) {
      work.startDate = parseDate(req.body.startDate);
    }
    if (req.body.dueDate !== undefined) {
      work.dueDate = parseDate(req.body.dueDate);
    }

    const normalizedChainage = normalizeChainagePayload(req.body);
    work.chainageFrom = normalizedChainage.chainageFrom;
    work.chainageTo = normalizedChainage.chainageTo;
    work.chainage = normalizedChainage.chainage;
    work.chainageNo = normalizedChainage.chainageNo;
    work.title = work.title || `${work.workType} - ${work.location}`;
    work.timeline.push({
      label: "Details Edited",
      description: "Submitted work approval details updated",
      user: req.user.id
    });

    await work.save();
    await audit(req, "update", "work", req.body, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.patch(
  "/:id/workflow",
  authMiddleware,
  authorizePermission("work", "update"),
  validate(workflowActionSchema),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");

    const { level, status, comments } = req.body;
    const current = work.workflow.find((step) => step.level === level);
    if (!current) throw new ApiError(404, "Workflow level not configured");

    current.status = status;
    current.comments = comments;
    current.actedAt = new Date();
    current.approver = req.user.id;

    work.approvalHistory.push({
      action: `workflow_${status}`,
      by: req.user.id,
      comment: comments,
      at: new Date()
    });
    work.timeline.push({
      label: `Workflow Level ${level}`,
      description: `${status.toUpperCase()} by ${req.user.name}`,
      user: req.user.id
    });

    const rejected = work.workflow.some((item) => item.status === "rejected");
    const approved = work.workflow.every((item) => item.status === "approved");

    if (rejected) {
      work.status = "Rejected";
    } else if (approved) {
      work.status = "Approved";
      work.approvedBy = req.user.name || work.approvedBy;
      work.approvedById = req.user.id;
      work.approvedByRole = req.user.role || "";
      work.approvedAt = new Date();
    } else {
      work.status = "Under Review";
    }

    await work.save();
    await audit(req, "workflow_update", "work", { level, status }, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.patch(
  "/:id/status",
  authMiddleware,
  authorizePermission("work", "update"),
  validate(statusUpdateSchema),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    if (work.status === "Completed") {
      throw new ApiError(400, "Completed work is locked and cannot be changed");
    }
    if (req.body.status === "Completed") {
      throw new ApiError(400, "Upload completion image to mark work as completed");
    }

    if (req.body.checkedBy !== undefined) {
      work.checkedBy = req.body.checkedBy;
    }
    if (req.body.recommendedBy !== undefined) {
      work.recommendedBy = req.body.recommendedBy;
    }

    if (req.body.status === "Approved" && (!work.checkedBy || !work.recommendedBy)) {
      throw new ApiError(
        400,
        "Please select Checked By and Recommended By before approving this Work Approval."
      );
    }

    work.status = req.body.status;
    if (req.body.status === "Approved") {
      work.approvedBy = req.user.name || work.approvedBy;
      work.approvedById = req.user.id;
      work.approvedByRole = req.user.role || "";
      work.approvedAt = new Date();
    } else if (req.body.status === "Rejected") {
      work.approvedBy = "";
      work.approvedById = null;
      work.approvedByRole = "";
      work.approvedAt = null;
    }
    work.approvalHistory.push({
      action: `status_${req.body.status}`,
      by: req.user.id,
      comment: req.body.comment
    });
    work.timeline.push({
      label: "Status Updated",
      description: `${req.body.status} by ${req.user.name || "Admin"}${req.body.comment ? `: ${req.body.comment}` : ""}`,
      user: req.user.id
    });
    if (req.body.status === "Approved") {
      work.timeline.push({
        label: "Admin Review",
        description: `Checked by ${work.checkedBy}; recommended by ${work.recommendedBy}; approved by ${req.user.name || "Admin"}`,
        user: req.user.id
      });
    }

    await work.save();
    await audit(req, "status_update", "work", req.body, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/comments",
  authMiddleware,
  authorizePermission("work", "update"),
  validate(commentSchema),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");

    work.comments.push({
      user: req.user.id,
      text: req.body.text
    });
    work.timeline.push({
      label: "Comment Added",
      description: req.body.text,
      user: req.user.id
    });
    await work.save();
    await audit(req, "comment", "work", { text: req.body.text }, work._id);

    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/signatures",
  authMiddleware,
  authorizePermission("work", "update"),
  validate(signatureSchema),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");

    work.digitalSignatures.push({
      signedBy: req.user.id,
      role: req.user.role,
      signatureText: req.body.signatureText
    });
    work.timeline.push({
      label: "Digital Signature",
      description: `Signed by ${req.user.name}`,
      user: req.user.id
    });

    await work.save();
    await audit(req, "signature", "work", {}, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/images/after",
  authMiddleware,
  authorizePermission("work", "update"),
  upload.fields([
    { name: "afterImages", maxCount: 10 },
    { name: "afterImage", maxCount: 1 },
    { name: "afterVideos", maxCount: 10 },
    { name: "afterVideo", maxCount: 1 }
  ]),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    if (work.status === "Completed") {
      throw new ApiError(400, "Completed work is already locked");
    }
    if (work.status !== "Approved") {
      throw new ApiError(400, "Only approved work can upload completion evidence");
    }
    const afterFiles = [...(req.files?.afterImages || []), ...(req.files?.afterImage || [])];
    const afterVideoFiles = [...(req.files?.afterVideos || []), ...(req.files?.afterVideo || [])];
    validateWorkMedia({ images: afterFiles, videos: afterVideoFiles, label: "After media" });
    if (!afterFiles.length && !afterVideoFiles.length) {
      throw new ApiError(400, "At least one completion image or video is required");
    }

    const uploads = await uploadManyAssets(afterFiles, "safety-hse/work/after", "image");
    const videoUploads = await uploadManyAssets(afterVideoFiles, "safety-hse/work/after-videos", "video");
    work.afterImages = [...(work.afterImages || []), ...uploads];
    work.afterImage = work.afterImages[0]?.url || uploads[0]?.url || "";
    work.afterVideos = [...(work.afterVideos || []), ...videoUploads];
    work.afterVideo = work.afterVideos[0]?.url || videoUploads[0]?.url || "";
    work.status = "Completed";
    work.timeline.push({
      label: "After Evidence Uploaded",
      description: `${uploads.length} image(s), ${videoUploads.length} video(s) added`,
      user: req.user.id
    });
    work.timeline.push({
      label: "Completed",
      description: `Completion evidence uploaded by ${req.user.name || "User"}`,
      user: req.user.id
    });
    await work.save();
    await audit(req, "after_media_upload", "work", { images: uploads.length, videos: videoUploads.length }, work._id);

    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid work approval id");
    }

    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    await WorkApproval.findByIdAndDelete(req.params.id);
    await audit(req, "delete", "work", { title: work.title }, work._id);
    res.json({ success: true, message: "Work approval deleted" });
  })
);

module.exports = router;
