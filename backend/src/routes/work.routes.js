const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
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
const { createNotification } = require("../services/notifications.service");
const {
  getChainageFrom,
  getChainageTo,
  normalizeChainagePayload
} = require("../utils/chainage");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const parseDate = (value) => (value ? new Date(value) : null);
const toLegacyWorkRecord = (record) => {
  const plain = typeof record.toObject === "function" ? record.toObject() : record;
  const beforeImage = plain.beforeImages?.[0]?.url || plain.beforeImage || "";
  const afterImage = plain.afterImages?.[0]?.url || plain.afterImage || "";
  const chainageFrom = getChainageFrom(plain);
  const chainageTo = getChainageTo(plain);
  return {
    ...plain,
    description: plain.description || plain.workDescription || "",
    chainageFrom,
    chainageTo,
    chainage: plain.chainage || chainageFrom,
    chainageNo: plain.chainageNo || plain.chainage || chainageFrom,
    beforeImage,
    afterImage,
    approvedBy: plain.approvedBy || ""
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
      { title: regex }
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
    { name: "beforeImages", maxCount: 5 },
    { name: "beforeImage", maxCount: 1 }
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
    if (!beforeFiles.length) {
      throw new ApiError(400, "Before image is required");
    }
    const beforeImages = await uploadManyAssets(
      beforeFiles,
      "safety-hse/work/before",
      "image"
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
      createdBy: req.user.id,
      assignedTo: payload.assignedTo || null,
      startDate: parseDate(payload.startDate),
      dueDate: parseDate(payload.dueDate),
      workflow: [
        { level: 1, status: "pending" },
        { level: 2, status: "pending" },
        { level: 3, status: "pending" }
      ],
      timeline: [
        {
          label: "Created",
          description: "Work approval request created",
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
    res.status(201).json({ success: true, work });
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
    } else {
      work.status = "Under Review";
    }

    await work.save();
    await audit(req, "workflow_update", "work", { level, status }, work._id);
    res.json({ success: true, work });
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

    work.status = req.body.status;
    if (req.body.approvedBy) {
      work.approvedBy = req.body.approvedBy;
    } else if (["Approved", "Rejected", "Completed"].includes(req.body.status)) {
      work.approvedBy = req.user.name || work.approvedBy;
    }
    work.approvalHistory.push({
      action: `status_${req.body.status}`,
      by: req.user.id,
      comment: req.body.comment
    });
    work.timeline.push({
      label: "Status Updated",
      description: `${req.body.status}${req.body.comment ? `: ${req.body.comment}` : ""}`,
      user: req.user.id
    });

    await work.save();
    await audit(req, "status_update", "work", req.body, work._id);
    res.json({ success: true, work });
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

    res.json({ success: true, work });
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
    res.json({ success: true, work });
  })
);

router.post(
  "/:id/images/after",
  authMiddleware,
  authorizePermission("work", "update"),
  upload.fields([
    { name: "afterImages", maxCount: 5 },
    { name: "afterImage", maxCount: 1 }
  ]),
  asyncHandler(async (req, res) => {
    const work = await WorkApproval.findById(req.params.id);
    if (!work) throw new ApiError(404, "Work approval not found");
    const afterFiles = [...(req.files?.afterImages || []), ...(req.files?.afterImage || [])];
    if (!afterFiles.length) {
      throw new ApiError(400, "At least one image is required");
    }

    const uploads = await uploadManyAssets(afterFiles, "safety-hse/work/after", "image");
    work.afterImages = [...(work.afterImages || []), ...uploads];
    work.afterImage = work.afterImages[0]?.url || uploads[0]?.url || "";
    if (work.status === "Approved" || work.status === "Under Review") {
      work.status = "Completed";
    }
    work.timeline.push({
      label: "After Images Uploaded",
      description: `${uploads.length} file(s) added`,
      user: req.user.id
    });
    await work.save();
    await audit(req, "after_images_upload", "work", { count: uploads.length }, work._id);

    res.json({ success: true, work });
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
