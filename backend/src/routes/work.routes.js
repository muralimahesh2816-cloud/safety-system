const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission, authorizeRoles } = require("../middleware/rbac.middleware");
const validate = require("../middleware/validate.middleware");
const audit = require("../middleware/audit.middleware");
const logger = require("../utils/logger");
const WorkApproval = require("../models/WorkApproval");
const { ROLES } = require("../constants/roles");
const {
  createWorkSchema,
  updateWorkSchema,
  statusUpdateSchema,
  stageActionSchema,
  returnWorkSchema,
  completeWorkSchema,
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

const WORK_STAGES = {
  PENDING_CHECK: "Pending Check",
  PENDING_RECOMMENDATION: "Pending Recommendation",
  PENDING_APPROVAL: "Pending Approval",
  APPROVED: "Approved",
  RETURNED: "Returned for Correction",
  COMPLETED: "Completed"
};

const WORK_STAGE_LABELS = {
  check: "Check Work",
  recommend: "Recommend Work",
  approve: "Final Approval",
  return: "Return for Correction",
  complete: "Complete Work"
};

const STAGE_ROLE_FALLBACKS = {
  check: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SAFETY_MANAGER, ROLES.SUPERVISOR],
  recommend: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SAFETY_MANAGER],
  approve: [ROLES.SUPER_ADMIN, ROLES.ADMIN],
  return: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SAFETY_MANAGER, ROLES.SUPERVISOR],
  complete: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SAFETY_MANAGER, ROLES.SUPERVISOR]
};

const normalizeObjectId = (value) => (value ? String(value) : "");
const sameUser = (left, right) => normalizeObjectId(left) && normalizeObjectId(left) === normalizeObjectId(right);

const deriveWorkflowStage = (work = {}) => {
  if (work.workflowStage) return work.workflowStage;
  if (work.status === "Completed") return WORK_STAGES.COMPLETED;
  if (work.status === "Approved") return WORK_STAGES.APPROVED;
  if (work.status === "Rejected" || work.status === "Returned for Correction") return WORK_STAGES.RETURNED;
  if (work.approvedAt || work.approvedBy) return WORK_STAGES.APPROVED;
  if (work.recommendedAt || work.recommendedBy) return WORK_STAGES.PENDING_APPROVAL;
  if (work.checkedAt || work.checkedBy) return WORK_STAGES.PENDING_RECOMMENDATION;
  return WORK_STAGES.PENDING_CHECK;
};

const assertStagePermission = (req, action) => {
  const role = req.user?.role;
  if (role === ROLES.SUPER_ADMIN) return;

  if (req.user?.permissions?.work?.[action] === true) return;

  const fallbackRoles = STAGE_ROLE_FALLBACKS[action] || [];
  if (fallbackRoles.includes(role)) return;

  const code = {
    check: "WORK_CHECK_FORBIDDEN",
    recommend: "WORK_RECOMMEND_FORBIDDEN",
    approve: "WORK_APPROVE_FORBIDDEN",
    complete: "WORK_COMPLETE_FORBIDDEN",
    return: "WORK_RETURN_FORBIDDEN"
  }[action] || "PERMISSION_DENIED";
  logger.warn("Work stage permission denied", {
    route: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    role,
    permission: `work.${action}`
  });
  throw new ApiError(403, `You do not have permission to ${String(WORK_STAGE_LABELS[action] || action).toLowerCase()}`, null, code);
};

const createStageActor = (req, description = "") => ({
  userId: req.user.id,
  name: req.user.name || "",
  role: req.user.role || "",
  description,
  date: new Date()
});

const validateStagePayload = (schema, body) => {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.flatten());
  }
  return parsed.data;
};

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

const assertWorkflowStage = (work, expectedStage) => {
  const currentStage = deriveWorkflowStage(work);
  if (currentStage !== expectedStage) {
    throw new ApiError(
      409,
      `This item has already moved to ${currentStage}. Refresh the list before continuing.`,
      { currentStage, expectedStage },
      "INVALID_WORKFLOW_STAGE"
    );
  }
  return currentStage;
};

const addWorkflowTimeline = (work, { label, description, userId }) => {
  work.timeline.push({
    label,
    description,
    user: userId
  });
};

const updateStageActorFields = (work, prefix, actor) => {
  work[prefix] = actor;
  work[`${prefix}By`] = actor.name;
  work[`${prefix}ById`] = actor.userId;
  work[`${prefix}ByRole`] = actor.role;
  work[`${prefix}Description`] = actor.description;
  work[`${prefix}At`] = actor.date;
};

const completeWorkWithMedia = async (req, res) => {
  assertStagePermission(req, "complete");
  const payload = validateStagePayload(completeWorkSchema, {
    description: req.body.description || req.body.completionDescription || ""
  });
  const work = await WorkApproval.findById(req.params.id);
  if (!work) throw new ApiError(404, "Work approval not found");
  assertWorkflowStage(work, WORK_STAGES.APPROVED);

  const afterFiles = [...(req.files?.afterImages || []), ...(req.files?.afterImage || [])];
  const afterVideoFiles = [...(req.files?.afterVideos || []), ...(req.files?.afterVideo || [])];
  validateWorkMedia({ images: afterFiles, videos: afterVideoFiles, label: "After media" });
  if (!afterFiles.length && !afterVideoFiles.length) {
    throw new ApiError(400, "At least one completion image or video is required");
  }

  const uploads = await uploadManyAssets(afterFiles, "safety-hse/work/after", "image");
  const videoUploads = await uploadManyAssets(afterVideoFiles, "safety-hse/work/after-videos", "video");
  const actor = createStageActor(req, payload.description);

  work.afterImages = [...(work.afterImages || []), ...uploads];
  work.afterImage = work.afterImages[0]?.url || uploads[0]?.url || "";
  work.afterVideos = [...(work.afterVideos || []), ...videoUploads];
  work.afterVideo = work.afterVideos[0]?.url || videoUploads[0]?.url || "";
  work.completedBy = actor.name;
  work.completedById = actor.userId;
  work.completedByRole = actor.role;
  work.completionDescription = actor.description;
  work.completedAt = actor.date;
  work.completion = actor;
  work.status = WORK_STAGES.COMPLETED;
  work.workflowStage = WORK_STAGES.COMPLETED;
  work.approvalHistory.push({
    action: "completed",
    by: req.user.id,
    comment: payload.description
  });
  addWorkflowTimeline(work, {
    label: "Completed",
    description: `${actor.name || "User"} completed work with ${uploads.length} image(s), ${videoUploads.length} video(s): ${payload.description}`,
    userId: req.user.id
  });

  await work.save();
  await audit(req, "work_complete", "work", { images: uploads.length, videos: videoUploads.length }, work._id);
  res.json({ success: true, work: toLegacyWorkRecord(work) });
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
  const workflowStage = deriveWorkflowStage(plain);
  return {
    ...plain,
    approvalNumber: plain.approvalNumber || (plain._id ? `WA-${String(plain._id).slice(-8).toUpperCase()}` : ""),
    description: plain.description || plain.workDescription || "",
    workflowStage,
    status: plain.status || workflowStage,
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
    checkedByRole: plain.checkedByRole || plain.checked?.role || "",
    checkedDescription: plain.checkedDescription || plain.checked?.description || "",
    checkedAt: plain.checkedAt || plain.checked?.date || "",
    recommendedBy: plain.recommendedBy || "",
    recommendedByRole: plain.recommendedByRole || plain.recommended?.role || "",
    recommendedDescription: plain.recommendedDescription || plain.recommended?.description || "",
    recommendedAt: plain.recommendedAt || plain.recommended?.date || "",
    approvedBy,
    approvedByName: approvedBy,
    approvedByRole: plain.approvedByRole || "",
    approvalDescription: plain.approvalDescription || plain.approved?.description || "",
    approvedAt: plain.approvedAt || "",
    approvalDate: plain.approvedAt || "",
    returnedBy: plain.returnedBy || plain.returned?.name || "",
    returnedByRole: plain.returnedByRole || plain.returned?.role || "",
    returnDescription: plain.returnDescription || plain.returned?.description || "",
    returnStage: plain.returnStage || "",
    returnedAt: plain.returnedAt || plain.returned?.date || "",
    completedBy: plain.completedBy || plain.completion?.name || "",
    completedByRole: plain.completedByRole || plain.completion?.role || "",
    completionDescription: plain.completionDescription || plain.completion?.description || "",
    completedAt: plain.completedAt || plain.completion?.date || "",
    completionDate: plain.completionDate || plain.completedAt || (plain.status === "Completed" ? plain.updatedAt : "")
  };
};

const buildWorkQuery = (query = {}) => {
  const filters = {};
  const search = String(query.search || query.q || "").trim();

  if (query.status) {
    filters.$or = [{ status: query.status }, { workflowStage: query.status }];
  }
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
      status: WORK_STAGES.PENDING_CHECK,
      workflowStage: WORK_STAGES.PENDING_CHECK,
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
  validate(updateWorkSchema),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");

    const currentStage = deriveWorkflowStage(work);
    const canUpdate = req.user.role === ROLES.SUPER_ADMIN || req.user.permissions?.work?.update === true;
    const canResubmitReturned = currentStage === WORK_STAGES.RETURNED && sameUser(work.createdBy, req.user.id);
    if (!canUpdate && !canResubmitReturned) {
      throw new ApiError(403, "You do not have permission to update this work approval", null, "WORK_UPDATE_FORBIDDEN");
    }
    if (currentStage === WORK_STAGES.COMPLETED) {
      throw new ApiError(400, "Completed work is locked and cannot be edited");
    }

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

    if (currentStage === WORK_STAGES.RETURNED) {
      work.checked = undefined;
      work.checkedBy = "";
      work.checkedById = null;
      work.checkedByRole = "";
      work.checkedDescription = "";
      work.checkedAt = null;
      work.recommended = undefined;
      work.recommendedBy = "";
      work.recommendedById = null;
      work.recommendedByRole = "";
      work.recommendedDescription = "";
      work.recommendedAt = null;
      work.approved = undefined;
      work.approvedBy = "";
      work.approvedById = null;
      work.approvedByRole = "";
      work.approvalDescription = "";
      work.approvedAt = null;
      work.status = WORK_STAGES.PENDING_CHECK;
      work.workflowStage = WORK_STAGES.PENDING_CHECK;
      work.timeline.push({
        label: "Returned Work Resubmitted",
        description: "Corrected work approval details resubmitted for checking",
        user: req.user.id
      });
    } else {
      work.timeline.push({
        label: "Details Edited",
        description: "Submitted work approval details updated",
        user: req.user.id
      });
    }

    await work.save();
    await audit(req, "update", "work", req.body, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.patch(
  "/:id/workflow",
  authMiddleware,
  authorizePermission("work", "update"),
  asyncHandler(async (_req, _res) => {
    throw new ApiError(410, "Multi-level workflow is disabled. Use sequential check, recommend, approve endpoints.");
  })
);

router.post(
  "/:id/check",
  authMiddleware,
  asyncHandler(async (req, res) => {
    assertStagePermission(req, "check");
    const payload = validateStagePayload(stageActionSchema, req.body);
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    assertWorkflowStage(work, WORK_STAGES.PENDING_CHECK);
    if (req.user.role !== ROLES.SUPER_ADMIN && sameUser(work.createdBy, req.user.id)) {
      throw new ApiError(403, "Checker cannot be the same user as creator", null, "WORK_CHECK_FORBIDDEN");
    }

    const actor = createStageActor(req, payload.description);
    updateStageActorFields(work, "checked", actor);
    work.status = WORK_STAGES.PENDING_RECOMMENDATION;
    work.workflowStage = WORK_STAGES.PENDING_RECOMMENDATION;
    work.approvalHistory.push({ action: "checked", by: req.user.id, comment: payload.description });
    addWorkflowTimeline(work, {
      label: "Checked",
      description: `${actor.name || "Checker"} checked work: ${payload.description}`,
      userId: req.user.id
    });

    await work.save();
    await audit(req, "work_check", "work", { description: payload.description }, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/recommend",
  authMiddleware,
  asyncHandler(async (req, res) => {
    assertStagePermission(req, "recommend");
    const payload = validateStagePayload(stageActionSchema, req.body);
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    assertWorkflowStage(work, WORK_STAGES.PENDING_RECOMMENDATION);
    if (req.user.role !== ROLES.SUPER_ADMIN && sameUser(work.createdBy, req.user.id)) {
      throw new ApiError(403, "Recommender cannot be the same user as creator", null, "WORK_RECOMMEND_FORBIDDEN");
    }
    if (req.user.role !== ROLES.SUPER_ADMIN && sameUser(work.checkedById, req.user.id)) {
      throw new ApiError(403, "Recommender cannot be the same person as checker", null, "WORK_RECOMMEND_FORBIDDEN");
    }

    const actor = createStageActor(req, payload.description);
    updateStageActorFields(work, "recommended", actor);
    work.status = WORK_STAGES.PENDING_APPROVAL;
    work.workflowStage = WORK_STAGES.PENDING_APPROVAL;
    work.approvalHistory.push({ action: "recommended", by: req.user.id, comment: payload.description });
    addWorkflowTimeline(work, {
      label: "Recommended",
      description: `${actor.name || "Recommender"} recommended work: ${payload.description}`,
      userId: req.user.id
    });

    await work.save();
    await audit(req, "work_recommend", "work", { description: payload.description }, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/approve",
  authMiddleware,
  asyncHandler(async (req, res) => {
    assertStagePermission(req, "approve");
    const payload = validateStagePayload(stageActionSchema, req.body);
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    assertWorkflowStage(work, WORK_STAGES.PENDING_APPROVAL);

    const actor = createStageActor(req, payload.description);
    work.approved = actor;
    work.approvedBy = actor.name;
    work.approvedById = actor.userId;
    work.approvedByRole = actor.role;
    work.approvalDescription = actor.description;
    work.approvedAt = actor.date;
    work.status = WORK_STAGES.APPROVED;
    work.workflowStage = WORK_STAGES.APPROVED;
    work.approvalHistory.push({ action: "approved", by: req.user.id, comment: payload.description });
    addWorkflowTimeline(work, {
      label: "Approved",
      description: `${actor.name || "Approver"} approved work: ${payload.description}`,
      userId: req.user.id
    });

    await work.save();
    await audit(req, "work_approve", "work", { description: payload.description }, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/return",
  authMiddleware,
  asyncHandler(async (req, res) => {
    assertStagePermission(req, "return");
    const payload = validateStagePayload(returnWorkSchema, req.body);
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    const currentStage = deriveWorkflowStage(work);
    if (![WORK_STAGES.PENDING_CHECK, WORK_STAGES.PENDING_RECOMMENDATION, WORK_STAGES.PENDING_APPROVAL].includes(currentStage)) {
      throw new ApiError(
        409,
        `This work approval cannot be returned while it is ${currentStage}`,
        { currentStage },
        "INVALID_WORKFLOW_STAGE"
      );
    }

    const actor = createStageActor(req, payload.description);
    work.returned = actor;
    work.returnedBy = actor.name;
    work.returnedById = actor.userId;
    work.returnedByRole = actor.role;
    work.returnDescription = actor.description;
    work.returnedAt = actor.date;
    work.returnStage = currentStage;
    work.status = WORK_STAGES.RETURNED;
    work.workflowStage = WORK_STAGES.RETURNED;
    work.approvalHistory.push({ action: "returned", by: req.user.id, comment: payload.description });
    addWorkflowTimeline(work, {
      label: "Returned for Correction",
      description: `${actor.name || "Reviewer"} returned work from ${currentStage}: ${payload.description}`,
      userId: req.user.id
    });

    await work.save();
    await audit(req, "work_return", "work", { stage: currentStage, description: payload.description }, work._id);
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/complete",
  authMiddleware,
  upload.fields([
    { name: "afterImages", maxCount: 10 },
    { name: "afterImage", maxCount: 1 },
    { name: "afterVideos", maxCount: 10 },
    { name: "afterVideo", maxCount: 1 }
  ]),
  asyncHandler(completeWorkWithMedia)
);

router.patch(
  "/:id/status",
  authMiddleware,
  authorizePermission("work", "update"),
  validate(statusUpdateSchema),
  asyncHandler(async (req, _res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    throw new ApiError(410, "Direct status updates are disabled. Use sequential check, recommend, approve, return, and complete endpoints.");
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
  upload.fields([
    { name: "afterImages", maxCount: 10 },
    { name: "afterImage", maxCount: 1 },
    { name: "afterVideos", maxCount: 10 },
    { name: "afterVideo", maxCount: 1 }
  ]),
  asyncHandler(completeWorkWithMedia)
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
