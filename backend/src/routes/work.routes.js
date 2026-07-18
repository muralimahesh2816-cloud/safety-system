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
const {
  createNotification,
  notifyWorkCreated,
  notifyWorkChecked,
  notifyWorkApproved,
  notifyWorkReturned,
  notifyWorkCompleted
} = require("../services/notifications.service");
const {
  getChainageFrom,
  getChainageTo,
  normalizeChainagePayload,
  parseComparableChainage
} = require("../utils/chainage");
const {
  escapeRegex,
  getPagination,
  buildPaginationMeta,
  hasPagination
} = require("../utils/pagination");

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

const runWorkflowNotification = async (label, operation) => {
  try {
    await operation();
  } catch (error) {
    logger.warn("Workflow notification delivery failed", {
      label,
      message: error.message
    });
  }
};

const WORK_STAGES = {
  PENDING_CHECK: "Pending Check",
  PENDING_FINAL_APPROVAL: "Pending Final Approval",
  APPROVED: "Approved",
  PARTIALLY_COMPLETED: "Partially Completed",
  RETURNED: "Returned for Correction",
  COMPLETED: "Completed"
};

const WORK_STAGE_LABELS = {
  check: "Check Work",
  approve: "Final Approval",
  return: "Return for Correction",
  complete: "Complete Work"
};

const STAGE_ROLE_FALLBACKS = {
  check: [
    ROLES.SAFETY_OFFICER,
    ROLES.SAFETY_ENGINEER,
    ROLES.SITE_ENGINEER,
    ROLES.PROJECT_ENGINEER,
    ROLES.MAINTENANCE_ENGINEER
  ],
  approve: [
    ROLES.MAINTENANCE_MANAGER,
    ROLES.PROJECT_MANAGER,
    ROLES.ADMIN
  ]
};

const ACTION_PERMISSION_CODES = {
  check: "CHECK_PERMISSION_REQUIRED",
  approve: "APPROVAL_PERMISSION_REQUIRED"
};

const ACTION_REQUIRED_CODES = {
  check: "REVIEW_FINDINGS_REQUIRED",
  approve: "APPROVAL_REMARKS_REQUIRED",
  return: "RETURN_REASON_REQUIRED"
};

const normalizeObjectId = (value) => (value ? String(value) : "");
const sameUser = (left, right) => normalizeObjectId(left) && normalizeObjectId(left) === normalizeObjectId(right);

const deriveWorkflowStage = (work = {}) => {
  if (work.workflowStage === "Pending Approval") return WORK_STAGES.PENDING_FINAL_APPROVAL;
  if (work.workflowStage === "Pending Recommendation") return WORK_STAGES.PENDING_FINAL_APPROVAL;
  if (work.workflowStage) return work.workflowStage;
  if (work.status === "Pending Approval") return WORK_STAGES.PENDING_FINAL_APPROVAL;
  if (work.status === "Pending Recommendation") return WORK_STAGES.PENDING_FINAL_APPROVAL;
  if (work.status === WORK_STAGES.PARTIALLY_COMPLETED) return WORK_STAGES.PARTIALLY_COMPLETED;
  if (work.status === "Completed") return WORK_STAGES.COMPLETED;
  if (work.status === "Approved") return WORK_STAGES.APPROVED;
  if (work.status === "Rejected" || work.status === "Returned for Correction") return WORK_STAGES.RETURNED;
  if (work.approvedAt || work.approvedBy) return WORK_STAGES.APPROVED;
  if (work.recommendedAt || work.recommendedBy) return WORK_STAGES.PENDING_FINAL_APPROVAL;
  if (work.checkedAt || work.checkedBy) return WORK_STAGES.PENDING_FINAL_APPROVAL;
  return WORK_STAGES.PENDING_CHECK;
};

const assertStagePermission = (req, action) => {
  const role = req.user?.role;
  if (role === ROLES.SUPER_ADMIN) return;

  const fallbackRoles = STAGE_ROLE_FALLBACKS[action] || [];
  const hasRole = fallbackRoles.includes(role);
  const hasPermission = req.user?.permissions?.work?.[action] === true;
  if (hasRole && hasPermission) return;

  const code = ACTION_PERMISSION_CODES[action] || "PERMISSION_DENIED";
  logger.warn("Work stage permission denied", {
    route: req.originalUrl,
    method: req.method,
    userId: req.user?.id,
    role,
    permission: `work.${action}`
  });
  throw new ApiError(403, `You do not have permission to ${String(WORK_STAGE_LABELS[action] || action).toLowerCase()}`, null, code);
};

const createStageActor = (req, description = "", extra = {}) => ({
  userId: req.user.id,
  name: req.user.name || "",
  role: req.user.role || "",
  description,
  ...extra,
  date: new Date()
});

const validateStagePayload = (schema, body) => {
  const parsed = schema.safeParse(body || {});
  if (!parsed.success) {
    throw new ApiError(400, "Validation failed", parsed.error.flatten());
  }
  return parsed.data;
};

const getRequiredActionDescription = (action, payload = {}) => {
  const value = {
    check: payload.reviewFindings || payload.description,
    approve: payload.approvalRemarks || payload.description,
    return: payload.correctionReason || payload.description
  }[action];
  const description = String(value || "").trim();
  if (!description) {
    throw new ApiError(400, "Mandatory workflow remarks are required", null, ACTION_REQUIRED_CODES[action]);
  }
  return description;
};

const assertReturnPermissionForStage = (req, currentStage) => {
  const action = {
    [WORK_STAGES.PENDING_CHECK]: "check",
    [WORK_STAGES.PENDING_FINAL_APPROVAL]: "approve"
  }[currentStage];
  if (!action) {
    throw new ApiError(
      409,
      `This work approval cannot be returned while it is ${currentStage}`,
      { currentStage },
      "INVALID_WORKFLOW_STAGE"
    );
  }
  assertStagePermission(req, action);
  return action;
};

const assertCompletionPermission = (req, work) => {
  if (req.user?.role === ROLES.SUPER_ADMIN) return;
  if (sameUser(work.createdBy, req.user?.id) || sameUser(work.assignedTo, req.user?.id)) return;
  if (req.user?.permissions?.work?.complete === true) return;
  throw new ApiError(403, "Only the creator, assigned user, or authorized role can complete approved work", null, "WORK_COMPLETE_FORBIDDEN");
};

const buildStageConflicts = (work, action, userId) => {
  const checks = {
    check: [
      { field: "createdBy", label: "creator", code: "CREATOR_CANNOT_CHECK" }
    ],
    approve: [
      { field: "createdBy", label: "creator", code: "SAME_USER_STAGE_CONFLICT" },
      { field: "checkedById", label: "checker", code: "SAME_USER_STAGE_CONFLICT" }
    ]
  }[action] || [];

  return checks.filter((item) => sameUser(work[item.field], userId));
};

const assertStageSeparation = (req, work, action, overrideReason = "") => {
  const conflicts = buildStageConflicts(work, action, req.user?.id);
  if (!conflicts.length) return [];

  const first = conflicts[0];
  if (action === "approve") {
    throw new ApiError(
      403,
      `The ${first.label} cannot perform final approval for the same work approval`,
      { conflicts: conflicts.map((item) => item.label) },
      first.code
    );
  }

  if (req.user?.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(
      403,
      `The ${first.label} cannot perform this workflow stage for the same work approval`,
      { conflicts: conflicts.map((item) => item.label) },
      first.code
    );
  }

  if (!String(overrideReason || "").trim()) {
    throw new ApiError(
      400,
      "Super Admin override reason is required when bypassing workflow separation",
      { conflicts: conflicts.map((item) => item.label) },
      "SAME_USER_STAGE_CONFLICT"
    );
  }

  return conflicts;
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

const normalizeComparable = (value = "") => String(value || "").trim().replace(/\s+/g, "").toUpperCase();

const getApprovedChainage = (work = {}) => ({
  from: String(work.approvedChainage?.from || getChainageFrom(work) || "").trim(),
  to: String(work.approvedChainage?.to || getChainageTo(work) || "").trim()
});

const validateCompletionChainage = (work, payload) => {
  const approved = getApprovedChainage(work);
  const completedFrom = String(payload.completedChainageFrom || approved.from || "").trim();
  const completedTo = String(payload.completedChainageTo || approved.to || "").trim();

  if (!approved.from || !approved.to || !completedFrom || !completedTo) {
    throw new ApiError(400, "Completed chainage and approved chainage are required", null, "INVALID_COMPLETED_CHAINAGE");
  }

  const approvedFromNumber = parseComparableChainage(approved.from);
  const approvedToNumber = parseComparableChainage(approved.to);
  const completedFromNumber = parseComparableChainage(completedFrom);
  const completedToNumber = parseComparableChainage(completedTo);

  const numbersComparable = [
    approvedFromNumber,
    approvedToNumber,
    completedFromNumber,
    completedToNumber
  ].every((value) => value !== null);

  if (
    numbersComparable &&
    (completedFromNumber < approvedFromNumber ||
      completedToNumber > approvedToNumber ||
      completedToNumber < completedFromNumber)
  ) {
    throw new ApiError(400, "Completed chainage must be within approved chainage", null, "INVALID_COMPLETED_CHAINAGE");
  }

  if (!numbersComparable) {
    const exactMatch =
      normalizeComparable(completedFrom) === normalizeComparable(approved.from) &&
      normalizeComparable(completedTo) === normalizeComparable(approved.to);
    if (!exactMatch) {
      throw new ApiError(400, "Completed chainage could not be validated against approved chainage", null, "INVALID_COMPLETED_CHAINAGE");
    }
  }

  const isFullCompletion =
    normalizeComparable(completedFrom) === normalizeComparable(approved.from) &&
    normalizeComparable(completedTo) === normalizeComparable(approved.to);
  const closesRemainingChainage =
    !isFullCompletion &&
    deriveWorkflowStage(work) === WORK_STAGES.PARTIALLY_COMPLETED &&
    normalizeComparable(completedFrom) === normalizeComparable(work.remainingChainageFrom || work.completion?.remainingChainageFrom) &&
    normalizeComparable(completedTo) === normalizeComparable(work.remainingChainageTo || work.completion?.remainingChainageTo);
  const partialCompletionReason = String(payload.partialCompletionReason || "").trim();
  if (!isFullCompletion && !closesRemainingChainage && !partialCompletionReason) {
    throw new ApiError(
      400,
      "Partial completion reason is required when completed chainage does not match approved chainage",
      null,
      "PARTIAL_COMPLETION_REASON_REQUIRED"
    );
  }

  return {
    approved,
    completedFrom,
    completedTo,
    isFullCompletion: isFullCompletion || closesRemainingChainage,
    closesRemainingChainage,
    partialCompletionReason,
    remainingFrom: isFullCompletion || closesRemainingChainage
      ? ""
      : normalizeComparable(completedFrom) !== normalizeComparable(approved.from)
      ? approved.from
      : completedTo,
    remainingTo: isFullCompletion || closesRemainingChainage
      ? ""
      : normalizeComparable(completedFrom) !== normalizeComparable(approved.from)
      ? completedFrom
      : approved.to
  };
};

const clearReviewFieldsForResubmission = (work) => {
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
};

const completeWorkWithMedia = async (req, res) => {
  const payload = validateStagePayload(completeWorkSchema, {
    description: req.body.description || req.body.completionDescription || "",
    completedChainageFrom: req.body.completedChainageFrom || "",
    completedChainageTo: req.body.completedChainageTo || "",
    partialCompletionReason: req.body.partialCompletionReason || ""
  });
  const work = await WorkApproval.findById(req.params.id);
  if (!work) throw new ApiError(404, "Work approval not found");
  const currentStage = deriveWorkflowStage(work);
  if (![WORK_STAGES.APPROVED, WORK_STAGES.PARTIALLY_COMPLETED].includes(currentStage)) {
    throw new ApiError(
      409,
      `This item has already moved to ${currentStage}. Refresh the list before continuing.`,
      { currentStage, expectedStage: WORK_STAGES.APPROVED },
      "INVALID_WORKFLOW_STAGE"
    );
  }
  assertCompletionPermission(req, work);
  const completionChainage = validateCompletionChainage(work, payload);

  const afterFiles = [...(req.files?.afterImages || []), ...(req.files?.afterImage || [])];
  const afterVideoFiles = [...(req.files?.afterVideos || []), ...(req.files?.afterVideo || [])];
  validateWorkMedia({ images: afterFiles, videos: afterVideoFiles, label: "After media" });
  if (!afterFiles.length && !afterVideoFiles.length) {
    throw new ApiError(400, "At least one completion image or video is required");
  }

  const uploads = await uploadManyAssets(afterFiles, "safety-hse/work/after", "image");
  const videoUploads = await uploadManyAssets(afterVideoFiles, "safety-hse/work/after-videos", "video");
  const actor = createStageActor(req, payload.description);
  const storedCompletedFrom = completionChainage.closesRemainingChainage
    ? completionChainage.approved.from
    : completionChainage.completedFrom;
  const storedCompletedTo = completionChainage.closesRemainingChainage
    ? completionChainage.approved.to
    : completionChainage.completedTo;

  work.afterImages = [...(work.afterImages || []), ...uploads];
  work.afterImage = work.afterImages[0]?.url || uploads[0]?.url || "";
  work.afterVideos = [...(work.afterVideos || []), ...videoUploads];
  work.afterVideo = work.afterVideos[0]?.url || videoUploads[0]?.url || "";
  work.completedBy = actor.name;
  work.completedById = actor.userId;
  work.completedByRole = actor.role;
  work.completionDescription = actor.description;
  work.completedChainageFrom = storedCompletedFrom;
  work.completedChainageTo = storedCompletedTo;
  work.remainingChainageFrom = completionChainage.remainingFrom;
  work.remainingChainageTo = completionChainage.remainingTo;
  work.partialCompletionReason = completionChainage.partialCompletionReason;
  work.completedAt = actor.date;
  work.completion = {
    ...actor,
    completedChainageFrom: storedCompletedFrom,
    completedChainageTo: storedCompletedTo,
    remainingChainageFrom: completionChainage.remainingFrom,
    remainingChainageTo: completionChainage.remainingTo,
    partialCompletionReason: completionChainage.partialCompletionReason
  };
  work.status = completionChainage.isFullCompletion ? WORK_STAGES.COMPLETED : WORK_STAGES.PARTIALLY_COMPLETED;
  work.workflowStage = work.status;
  work.chainageAuditHistory.push({
    approvedChainageFrom: completionChainage.approved.from,
    approvedChainageTo: completionChainage.approved.to,
    completedChainageFrom: completionChainage.completedFrom,
    completedChainageTo: completionChainage.completedTo,
    remainingChainageFrom: completionChainage.remainingFrom,
    remainingChainageTo: completionChainage.remainingTo,
    updatedBy: req.user.id,
    updatedByName: actor.name,
    updatedByRole: actor.role,
    updateDescription: payload.description,
    partialCompletionReason: completionChainage.partialCompletionReason
  });
  work.approvalHistory.push({
    action: completionChainage.isFullCompletion ? "completed" : "partially_completed",
    by: req.user.id,
    comment: payload.description
  });
  addWorkflowTimeline(work, {
    label: completionChainage.isFullCompletion ? "Completed" : "Partially Completed",
    description: `${actor.name || "User"} completed chainage ${completionChainage.completedFrom} to ${completionChainage.completedTo} with ${uploads.length} image(s), ${videoUploads.length} video(s): ${payload.description}`,
    userId: req.user.id
  });

  await work.save();
  await audit(
    req,
    completionChainage.isFullCompletion ? "work_complete" : "work_partial_complete",
    "work",
    {
      images: uploads.length,
      videos: videoUploads.length,
      completedChainageFrom: completionChainage.completedFrom,
      completedChainageTo: completionChainage.completedTo,
      partialCompletionReason: completionChainage.partialCompletionReason
    },
    work._id
  );
  await runWorkflowNotification("work_completed", () =>
    notifyWorkCompleted({ work, actorId: req.user.id })
  );
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
  const approvedChainageFrom = plain.approvedChainage?.from || chainageFrom;
  const approvedChainageTo = plain.approvedChainage?.to || chainageTo;
  const completedChainageFrom = plain.completedChainageFrom || plain.completion?.completedChainageFrom || "";
  const completedChainageTo = plain.completedChainageTo || plain.completion?.completedChainageTo || "";
  const remainingChainageFrom = plain.remainingChainageFrom || plain.completion?.remainingChainageFrom || "";
  const remainingChainageTo = plain.remainingChainageTo || plain.completion?.remainingChainageTo || "";
  const partialCompletionReason = plain.partialCompletionReason || plain.completion?.partialCompletionReason || "";
  const createdByName = plain.createdByName || plain.createdBy?.name || "";
  const createdByRole = plain.createdByRole || plain.createdBy?.role || "";
  const approvedBy = plain.approvedBy || plain.approvedById?.name || "";
  const workflowStage = deriveWorkflowStage(plain);
  return {
    ...plain,
    approvalNumber: plain.approvalNumber || (plain._id ? `WA-${String(plain._id).slice(-8).toUpperCase()}` : ""),
    description: plain.description || plain.workDescription || "",
    workflowStage,
    status: ["Pending Approval", "Pending Recommendation"].includes(plain.status)
      ? workflowStage
      : plain.status || workflowStage,
    chainageFrom,
    chainageTo,
    chainage: plain.chainage || chainageFrom,
    chainageNo: plain.chainageNo || plain.chainage || chainageFrom,
    approvedChainage: {
      from: approvedChainageFrom,
      to: approvedChainageTo
    },
    approvedChainageFrom,
    approvedChainageTo,
    completedChainageFrom,
    completedChainageTo,
    remainingChainageFrom,
    remainingChainageTo,
    partialCompletionReason,
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
    completionDate: plain.completionDate || plain.completedAt || (["Completed", "Partially Completed"].includes(plain.status) ? plain.updatedAt : ""),
    returnedHistory: plain.returnedHistory || [],
    chainageAuditHistory: plain.chainageAuditHistory || []
  };
};

const buildWorkQuery = (query = {}) => {
  const filters = {};
  const search = String(query.search || query.q || "").trim();

  if (query.status) {
    filters.$and = [
      ...(filters.$and || []),
      { $or: [{ status: query.status }, { workflowStage: query.status }] }
    ];
  }
  if (query.workType) filters.workType = query.workType;
  if (query.plaza) filters.plaza = query.plaza;
  if (query.location) filters.location = new RegExp(escapeRegex(query.location), "i");

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filters.$and = [
      ...(filters.$and || []),
      {
        $or: [
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
        ]
      }
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
    const filters = buildWorkQuery(req.query);
    const shouldPaginate = hasPagination(req.query);
    const pagination = getPagination(req.query);
    let query = WorkApproval.find(filters)
      .populate("createdBy", "name role")
      .populate("assignedTo", "name role")
      .sort({ createdAt: -1 });
    if (shouldPaginate) {
      query = query.skip(pagination.skip).limit(pagination.limit);
    }
    const [records, total] = await Promise.all([
      query,
      WorkApproval.countDocuments(filters)
    ]);
    res.json({
      success: true,
      records: records.map(toLegacyWorkRecord),
      pagination: shouldPaginate
        ? buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total })
        : { total, unpaginated: true }
    });
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
      approvedChainage: {
        from: normalizedChainage.chainageFrom,
        to: normalizedChainage.chainageTo
      },
      beforeImages,
      beforeImage: beforeImages[0]?.url || "",
      beforeVideos,
      beforeVideo: beforeVideos[0]?.url || "",
      createdBy: req.user.id,
      createdByName: req.user.name || "",
      createdByRole: req.user.role || "",
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

    await runWorkflowNotification("work_created", () =>
      notifyWorkCreated({ work, actorId: req.user.id })
    );
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
    if (currentStage === WORK_STAGES.PARTIALLY_COMPLETED) {
      throw new ApiError(400, "Partially completed work cannot be edited from this route");
    }

    const previousChainageFrom = getChainageFrom(work);
    const previousChainageTo = getChainageTo(work);

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

    const normalizedChainage = normalizeChainagePayload({
      ...req.body,
      chainageFrom: req.body.chainageFrom || work.chainageFrom,
      chainageTo: req.body.chainageTo || work.chainageTo,
      chainage: req.body.chainage || work.chainage,
      chainageNo: req.body.chainageNo || work.chainageNo
    });
    work.chainageFrom = normalizedChainage.chainageFrom;
    work.chainageTo = normalizedChainage.chainageTo;
    work.chainage = normalizedChainage.chainage;
    work.chainageNo = normalizedChainage.chainageNo;
    work.title = work.title || `${work.workType} - ${work.location}`;
    if (![WORK_STAGES.APPROVED, WORK_STAGES.COMPLETED, WORK_STAGES.PARTIALLY_COMPLETED].includes(currentStage)) {
      work.approvedChainage = {
        from: normalizedChainage.chainageFrom,
        to: normalizedChainage.chainageTo
      };
    }

    if (
      normalizeComparable(previousChainageFrom) !== normalizeComparable(normalizedChainage.chainageFrom) ||
      normalizeComparable(previousChainageTo) !== normalizeComparable(normalizedChainage.chainageTo)
    ) {
      work.chainageAuditHistory.push({
        approvedChainageFrom: previousChainageFrom,
        approvedChainageTo: previousChainageTo,
        completedChainageFrom: "",
        completedChainageTo: "",
        remainingChainageFrom: "",
        remainingChainageTo: "",
        updatedBy: req.user.id,
        updatedByName: req.user.name || "",
        updatedByRole: req.user.role || "",
        updateDescription: currentStage === WORK_STAGES.RETURNED
          ? "Chainage corrected during returned-work resubmission"
          : "Work approval chainage updated before completion",
        partialCompletionReason: ""
      });
    }

    if (currentStage === WORK_STAGES.RETURNED) {
      clearReviewFieldsForResubmission(work);
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
    throw new ApiError(410, "Multi-level workflow is disabled. Use sequential check and final approval endpoints.");
  })
);

router.post(
  "/:id/resubmit",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    const currentStage = deriveWorkflowStage(work);
    assertWorkflowStage(work, WORK_STAGES.RETURNED);

    const canUpdate = req.user.role === ROLES.SUPER_ADMIN || req.user.permissions?.work?.update === true;
    const isCreator = sameUser(work.createdBy, req.user.id);
    if (!canUpdate && !isCreator) {
      throw new ApiError(403, "Only the creator can resubmit returned work", null, "WORK_UPDATE_FORBIDDEN");
    }

    clearReviewFieldsForResubmission(work);
    work.timeline.push({
      label: "Returned Work Resubmitted",
      description: "Work approval resubmitted for checking",
      user: req.user.id
    });
    work.approvalHistory.push({
      action: "resubmitted",
      by: req.user.id,
      comment: `Resubmitted from ${currentStage}`
    });

    await work.save();
    await audit(req, "work_resubmit", "work", { fromStage: currentStage }, work._id);
    await runWorkflowNotification("work_resubmitted", () =>
      notifyWorkCreated({ work, actorId: req.user.id })
    );
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/check",
  authMiddleware,
  asyncHandler(async (req, res) => {
    assertStagePermission(req, "check");
    const payload = validateStagePayload(stageActionSchema, req.body);
    const reviewFindings = getRequiredActionDescription("check", payload);
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    assertWorkflowStage(work, WORK_STAGES.PENDING_CHECK);
    const overrideConflicts = assertStageSeparation(req, work, "check", payload.overrideReason);

    const actor = createStageActor(req, reviewFindings, { reviewFindings });
    updateStageActorFields(work, "checked", actor);
    work.status = WORK_STAGES.PENDING_FINAL_APPROVAL;
    work.workflowStage = WORK_STAGES.PENDING_FINAL_APPROVAL;
    work.approvalHistory.push({ action: "checked", by: req.user.id, comment: reviewFindings });
    addWorkflowTimeline(work, {
      label: "Checked",
      description: `${actor.name || "Checker"} checked work: ${reviewFindings}`,
      userId: req.user.id
    });

    await work.save();
    await audit(req, "work_check", "work", { reviewFindings }, work._id);
    await runWorkflowNotification("work_checked", () =>
      notifyWorkChecked({ work, actorId: req.user.id })
    );
    if (overrideConflicts.length) {
      await audit(
        req,
        "work_super_admin_override",
        "work",
        {
          stage: "check",
          reason: payload.overrideReason,
          conflicts: overrideConflicts.map((item) => item.label)
        },
        work._id
      );
    }
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/recommend",
  authMiddleware,
  asyncHandler(async () => {
    throw new ApiError(
      410,
      "Recommendation workflow is disabled. Checked work now moves directly to final approval.",
      null,
      "RECOMMENDATION_WORKFLOW_DISABLED"
    );
  })
);

router.post(
  "/:id/approve",
  authMiddleware,
  asyncHandler(async (req, res) => {
    assertStagePermission(req, "approve");
    const payload = validateStagePayload(stageActionSchema, req.body);
    const approvalRemarks = getRequiredActionDescription("approve", payload);
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    assertWorkflowStage(work, WORK_STAGES.PENDING_FINAL_APPROVAL);
    const overrideConflicts = assertStageSeparation(req, work, "approve", payload.overrideReason);

    const actor = createStageActor(req, approvalRemarks, { approvalRemarks });
    work.approved = actor;
    work.approvedBy = actor.name;
    work.approvedById = actor.userId;
    work.approvedByRole = actor.role;
    work.approvalDescription = actor.description;
    work.approvedAt = actor.date;
    work.approvedChainage = {
      from: getChainageFrom(work),
      to: getChainageTo(work)
    };
    work.status = WORK_STAGES.APPROVED;
    work.workflowStage = WORK_STAGES.APPROVED;
    work.approvalHistory.push({ action: "approved", by: req.user.id, comment: approvalRemarks });
    addWorkflowTimeline(work, {
      label: "Approved",
      description: `${actor.name || "Approver"} approved work: ${approvalRemarks}`,
      userId: req.user.id
    });

    await work.save();
    await audit(req, "work_approve", "work", { approvalRemarks }, work._id);
    await runWorkflowNotification("work_approved", () =>
      notifyWorkApproved({ work, actorId: req.user.id })
    );
    if (overrideConflicts.length) {
      await audit(
        req,
        "work_super_admin_override",
        "work",
        {
          stage: "approve",
          reason: payload.overrideReason,
          conflicts: overrideConflicts.map((item) => item.label)
        },
        work._id
      );
    }
    res.json({ success: true, work: toLegacyWorkRecord(work) });
  })
);

router.post(
  "/:id/return",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const payload = validateStagePayload(returnWorkSchema, req.body);
    const correctionReason = getRequiredActionDescription("return", payload);
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    const currentStage = deriveWorkflowStage(work);
    if (![WORK_STAGES.PENDING_CHECK, WORK_STAGES.PENDING_FINAL_APPROVAL].includes(currentStage)) {
      throw new ApiError(
        409,
        `This work approval cannot be returned while it is ${currentStage}`,
        { currentStage },
        "INVALID_WORKFLOW_STAGE"
      );
    }
    const stageAction = assertReturnPermissionForStage(req, currentStage);
    const overrideConflicts = assertStageSeparation(req, work, stageAction, payload.overrideReason);

    const actor = createStageActor(req, correctionReason);
    work.returned = actor;
    work.returnedBy = actor.name;
    work.returnedById = actor.userId;
    work.returnedByRole = actor.role;
    work.returnDescription = actor.description;
    work.returnedAt = actor.date;
    work.returnStage = currentStage;
    work.returnedHistory.push({
      returnedByUserId: actor.userId,
      returnedByName: actor.name,
      returnedByRole: actor.role,
      returnedFromStage: currentStage,
      correctionReason,
      returnedAt: actor.date
    });
    work.status = WORK_STAGES.RETURNED;
    work.workflowStage = WORK_STAGES.RETURNED;
    work.approvalHistory.push({ action: "returned", by: req.user.id, comment: correctionReason });
    addWorkflowTimeline(work, {
      label: "Returned for Correction",
      description: `${actor.name || "Reviewer"} returned work from ${currentStage}: ${correctionReason}`,
      userId: req.user.id
    });

    await work.save();
    await audit(req, "work_return", "work", { stage: currentStage, correctionReason }, work._id);
    await runWorkflowNotification("work_returned", () =>
      notifyWorkReturned({ work, actorId: req.user.id, reason: correctionReason })
    );
    if (overrideConflicts.length) {
      await audit(
        req,
        "work_super_admin_override",
        "work",
        {
          stage: `return:${currentStage}`,
          reason: payload.overrideReason,
          conflicts: overrideConflicts.map((item) => item.label)
        },
        work._id
      );
    }
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

router.post(
  "/:id/partial-complete",
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
    throw new ApiError(410, "Direct status updates are disabled. Use sequential check, final approval, return, and complete endpoints.");
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
