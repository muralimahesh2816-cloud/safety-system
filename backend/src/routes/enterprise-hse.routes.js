const express = require("express");
const mongoose = require("mongoose");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const { canAccessModule } = require("../middleware/permission.middleware");
const audit = require("../middleware/audit.middleware");
const { ROLES } = require("../constants/roles");
const {
  ENTERPRISE_HSE_MODULES,
  findHseModule,
  canTransition
} = require("../constants/enterprise-hse");
const { getHseModel } = require("../models/EnterpriseHseRecord");
const User = require("../models/User");
const HseChecklistTemplate = require("../models/HseChecklistTemplate");
const { createNotification } = require("../services/notifications.service");
const { uploadManyAssets } = require("../utils/uploads");
const {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  createMemoryUpload
} = require("../utils/multer");
const {
  parseMediaMetadata,
  mergeMediaMetadata,
  normalizeLocation,
  normalizeRecordLocations
} = require("../utils/media-metadata");
const { escapeRegex, getPagination, buildPaginationMeta } = require("../utils/pagination");

const router = express.Router();
const upload = createMemoryUpload({
  allowedMimeTypes: [...IMAGE_MIME_TYPES, ...VIDEO_MIME_TYPES, ...DOCUMENT_MIME_TYPES],
  maxFileSizeMb: 100,
  maxFiles: 24
});
const uploadFields = upload.fields([
  { name: "evidenceImages", maxCount: 8 },
  { name: "evidenceVideos", maxCount: 6 },
  { name: "evidenceVideoThumbnails", maxCount: 6 },
  { name: "documents", maxCount: 10 }
]);

const DATE_FIELDS = ["businessDate", "startDate", "dueDate", "expiryDate"];
const objectIdFields = new Set(["assignedTo", "owner"]);

const terminalStatusesFor = (definition) => {
  if (definition.statuses.includes("Closed")) {
    return ["Closed", ...(definition.statuses.includes("Cancelled") ? ["Cancelled"] : [])];
  }
  const configured = {
    documents: ["Archived"],
    ppe: ["Disposed"],
    "waste-records": ["Verified"],
    "compliance-calendar": ["Verified"],
    "competency-matrix": ["Competent"]
  };
  return configured[definition.key] || [definition.statuses.at(-1)];
};

const parseJson = (value, fallback, label) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  if (value.length > 200000) throw new ApiError(400, `${label} is too large`);
  try {
    return JSON.parse(value);
  } catch (_error) {
    throw new ApiError(400, `${label} contains invalid JSON`);
  }
};

const cleanObject = (value, depth = 0) => {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.slice(0, 200).map((item) => cleanObject(item, depth + 1));
  if (typeof value !== "object") {
    return typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/g, " ").trim() : value;
  }
  return Object.entries(value).reduce((result, [key, item]) => {
    if (!key.startsWith("$") && !key.includes(".")) result[key] = cleanObject(item, depth + 1);
    return result;
  }, {});
};

const parsePayload = (body = {}) => {
  const payload = {};
  ["title", "description", "category", "site", "location", "severity", "priority"].forEach((field) => {
    if (body[field] !== undefined) payload[field] = String(body[field] || "").trim();
  });
  DATE_FIELDS.forEach((field) => {
    if (body[field] === undefined) return;
    const parsed = body[field] ? new Date(body[field]) : null;
    if (parsed && Number.isNaN(parsed.getTime())) throw new ApiError(400, `${field} is invalid`);
    payload[field] = parsed;
  });
  objectIdFields.forEach((field) => {
    if (body[field] === undefined) return;
    if (body[field] && !mongoose.Types.ObjectId.isValid(body[field])) throw new ApiError(400, `${field} is invalid`);
    payload[field] = body[field] || null;
  });
  if (body.tags !== undefined) {
    const tags = parseJson(body.tags, [], "Tags");
    if (!Array.isArray(tags)) throw new ApiError(400, "Tags must be a list");
    payload.tags = tags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, 30);
  }
  if (body.participants !== undefined) {
    const participants = parseJson(body.participants, [], "Participants");
    if (!Array.isArray(participants) || participants.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
      throw new ApiError(400, "Participants must contain valid users");
    }
    payload.participants = participants.slice(0, 200);
  }
  if (body.data !== undefined) payload.data = cleanObject(parseJson(body.data, {}, "Module details"));
  if (body.checklist !== undefined) {
    const checklist = parseJson(body.checklist, [], "Checklist");
    if (!Array.isArray(checklist)) throw new ApiError(400, "Checklist must be a list");
    payload.checklist = cleanObject(checklist);
  }
  if (body.geoLocation !== undefined) {
    const location = parseJson(body.geoLocation, {}, "Location");
    payload.geoLocation = normalizeLocation(location, "record");
  }
  return payload;
};

const validateRequired = (definition, payload) => {
  const missing = definition.required.filter((field) => {
    const value = payload[field] ?? payload.data?.[field];
    return value === undefined || value === null || value === "";
  });
  if (missing.length) {
    throw new ApiError(400, "Required information is missing", { fields: missing }, "VALIDATION_FAILED");
  }
  if (definition.key === "permits") {
    const conditional = {
      "Hot Work": ["fireWatch"],
      "Confined Space": ["gasTestReference", "rescuePlan"],
      "Height Work": ["rescuePlan"],
      "Electrical Isolation": ["isolationReference"],
      Excavation: ["excavationDepth"],
      Lifting: ["liftingPlan"]
    };
    const conditionalMissing = (conditional[payload.category] || []).filter((field) => !payload.data?.[field]);
    if (conditionalMissing.length) {
      throw new ApiError(400, "Permit-specific controls are required", { fields: conditionalMissing }, "VALIDATION_FAILED");
    }
  }
};

const serialize = (record) => normalizeRecordLocations(record, ["evidenceImages", "evidenceVideos"]);

const queueAssignmentNotification = ({ record, definition, actorId }) => {
  if (!record.assignedTo) return;
  setImmediate(() => createNotification({
    userId: record.assignedTo,
    type: "assignment",
    title: `${definition.singular} assigned`,
    message: `${record.recordId}: ${record.title} has been assigned to you`,
    module: definition.key,
    relatedRecordId: record._id,
    url: `/${definition.slug}/${record._id}`,
    priority: record.priority === "Urgent" || record.severity === "Critical" ? "urgent" : "high",
    createdBy: actorId,
    data: { recordId: record._id, module: definition.key }
  }).catch(() => undefined));
};

const storeUploads = async (req, definition) => {
  const images = req.files?.evidenceImages || [];
  const videos = req.files?.evidenceVideos || [];
  const thumbnails = req.files?.evidenceVideoThumbnails || [];
  const documents = req.files?.documents || [];
  const imageMetadata = parseMediaMetadata(req.body.evidenceImageMetadata, {
    module: definition.key, stage: "before", mediaType: "image", maxCount: 8
  });
  const videoMetadata = parseMediaMetadata(req.body.evidenceVideoMetadata, {
    module: definition.key, stage: "before", mediaType: "video", maxCount: 6
  });
  const folder = `safety-hse/${definition.slug}`;
  const [rawImages, rawVideos, rawThumbnails, rawDocuments] = await Promise.all([
    uploadManyAssets(images, `${folder}/evidence`, "image"),
    uploadManyAssets(videos, `${folder}/videos`, "video"),
    uploadManyAssets(thumbnails, `${folder}/thumbnails`, "image"),
    uploadManyAssets(documents, `${folder}/documents`, "auto")
  ]);
  return {
    evidenceImages: mergeMediaMetadata(rawImages, imageMetadata, {
      userId: req.user.id, module: definition.key, stage: "before", mediaType: "image"
    }),
    evidenceVideos: mergeMediaMetadata(rawVideos, videoMetadata, {
      userId: req.user.id, module: definition.key, stage: "before", mediaType: "video", thumbnails: rawThumbnails
    }),
    attachments: rawDocuments.map((document) => ({ ...document, uploadedBy: req.user.id, uploadedAt: new Date() }))
  };
};

const buildFilters = (query = {}, definition = { dateField: "businessDate" }) => {
  const filters = { isArchived: query.archived === "true" };
  ["status", "category", "severity", "priority", "assignedTo"].forEach((field) => {
    if (query[field]) filters[field] = query[field];
  });
  if (query.site) filters.site = new RegExp(escapeRegex(query.site), "i");
  if (query.search) {
    const expression = new RegExp(escapeRegex(query.search), "i");
    filters.$or = ["recordId", "title", "description", "site", "location", "category"].map((field) => ({ [field]: expression }));
  }
  if (query.dateFrom || query.dateTo) {
    const dateField = definition.dateField || "businessDate";
    filters[dateField] = {};
    if (query.dateFrom) filters[dateField].$gte = new Date(query.dateFrom);
    if (query.dateTo) filters[dateField].$lte = new Date(`${query.dateTo}T23:59:59.999Z`);
  }
  if (query.dueBefore) filters.dueDate = { $lte: new Date(query.dueBefore) };
  return filters;
};

const buildSort = (query = {}) => {
  const allowed = new Set(["createdAt", "updatedAt", "businessDate", "startDate", "dueDate", "expiryDate", "title", "status", "severity", "priority"]);
  const field = allowed.has(query.sortBy) ? query.sortBy : "createdAt";
  const direction = query.sortDirection === "asc" ? 1 : -1;
  return { [field]: direction, _id: direction };
};

const registerCrudRoutes = (definition, basePath) => {
  const Model = getHseModel(definition.key);
  const moduleRouter = express.Router();

  moduleRouter.get(
    "/summary",
    authMiddleware,
    authorizePermission(definition.key, "view"),
    asyncHandler(async (_req, res) => {
      const now = new Date();
      const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const terminalStatuses = terminalStatusesFor(definition);
      const [total, open, overdue, highRisk, expiring] = await Promise.all([
        Model.countDocuments({ isArchived: false }),
        Model.countDocuments({ isArchived: false, status: { $nin: terminalStatuses } }),
        Model.countDocuments({ isArchived: false, dueDate: { $lt: now }, status: { $nin: terminalStatuses } }),
        Model.countDocuments({ isArchived: false, status: { $nin: terminalStatuses }, $or: [{ severity: { $in: ["High", "Critical"] } }, { priority: { $in: ["High", "Urgent"] } }] }),
        Model.countDocuments({ isArchived: false, expiryDate: { $gte: now, $lte: soon } })
      ]);
      res.json({ success: true, summary: { total, open, overdue, highRisk, expiring } });
    })
  );

  moduleRouter.get(
    "/export",
    authMiddleware,
    authorizePermission(definition.key, "view"),
    asyncHandler(async (req, res) => {
      const records = await Model.find(buildFilters(req.query, definition))
        .populate("assignedTo", "name email role")
        .sort(buildSort(req.query))
        .limit(5000)
        .lean();
      await audit(req, "export", definition.key, { format: req.query.format || "json", count: records.length });
      res.json({ success: true, module: definition, records: records.map(serialize), generatedAt: new Date() });
    })
  );

  moduleRouter.get(
    "/",
    authMiddleware,
    authorizePermission(definition.key, "view"),
    asyncHandler(async (req, res) => {
      const filters = buildFilters(req.query, definition);
      const pagination = getPagination(req.query, { defaultLimit: 25, maxLimit: 100 });
      const [records, total] = await Promise.all([
        Model.find(filters)
          .populate("assignedTo", "name email role")
          .populate("owner", "name email role")
          .populate("createdBy", "name role")
          .sort(buildSort(req.query))
          .skip(pagination.skip)
          .limit(pagination.limit),
        Model.countDocuments(filters)
      ]);
      res.json({
        success: true,
        module: definition,
        records: records.map(serialize),
        pagination: buildPaginationMeta({ ...pagination, total })
      });
    })
  );

  moduleRouter.post(
    "/",
    authMiddleware,
    authorizePermission(definition.key, "create"),
    uploadFields,
    asyncHandler(async (req, res) => {
      const payload = parsePayload(req.body);
      validateRequired(definition, payload);
      const uploads = await storeUploads(req, definition);
      const record = await Model.create({
        ...payload,
        ...uploads,
        createdBy: req.user.id,
        createdByName: req.user.name || "",
        history: [{ action: "Created", toStatus: definition.statuses[0], actor: req.user.id, actorName: req.user.name || "" }]
      });
      queueAssignmentNotification({ record, definition, actorId: req.user.id });
      await audit(req, "create", definition.key, { recordId: record.recordId, title: record.title }, record._id, { newValue: payload });
      res.status(201).json({ success: true, record: serialize(record) });
    })
  );

  moduleRouter.get(
    "/:id",
    authMiddleware,
    authorizePermission(definition.key, "view"),
    asyncHandler(async (req, res) => {
      const record = await Model.findById(req.params.id)
        .populate("assignedTo", "name email role")
        .populate("owner", "name email role")
        .populate("createdBy", "name role")
        .populate("participants", "name role")
        .populate("history.actor", "name role");
      if (!record || record.isArchived) throw new ApiError(404, `${definition.singular} not found`);
      res.json({ success: true, module: definition, record: serialize(record) });
    })
  );

  moduleRouter.patch(
    "/:id",
    authMiddleware,
    authorizePermission(definition.key, "update"),
    uploadFields,
    asyncHandler(async (req, res) => {
      const record = await Model.findById(req.params.id);
      if (!record || record.isArchived) throw new ApiError(404, `${definition.singular} not found`);
      const payload = parsePayload(req.body);
      const previousValue = record.toObject();
      const combinedPayload = {
        ...previousValue,
        ...payload,
        data: { ...(previousValue.data || {}), ...(payload.data || {}) }
      };
      validateRequired(definition, combinedPayload);
      const uploads = await storeUploads(req, definition);
      Object.entries(payload).forEach(([key, value]) => {
        record[key] = key === "data" ? { ...(record.data || {}), ...(value || {}) } : value;
      });
      record.evidenceImages.push(...uploads.evidenceImages);
      record.evidenceVideos.push(...uploads.evidenceVideos);
      record.attachments.push(...uploads.attachments);
      record.version += 1;
      record.history.push({ action: "Updated", note: String(req.body.changeNote || "Record details updated"), actor: req.user.id, actorName: req.user.name || "" });
      await record.save();
      if (payload.assignedTo && String(payload.assignedTo) !== String(previousValue.assignedTo || "")) {
        queueAssignmentNotification({ record, definition, actorId: req.user.id });
      }
      await audit(req, "update", definition.key, { recordId: record.recordId }, record._id, { previousValue, newValue: record.toObject() });
      res.json({ success: true, record: serialize(record) });
    })
  );

  moduleRouter.post(
    "/:id/transition",
    authMiddleware,
    authorizePermission(definition.key, "update"),
    asyncHandler(async (req, res) => {
      const record = await Model.findById(req.params.id);
      if (!record || record.isArchived) throw new ApiError(404, `${definition.singular} not found`);
      const nextStatus = String(req.body.status || "").trim();
      if (!canTransition(definition, record.status, nextStatus)) {
        throw new ApiError(409, `Cannot move from ${record.status} to ${nextStatus}`, { allowedStatuses: definition.statuses }, "INVALID_HSE_WORKFLOW_STAGE");
      }
      const previousStatus = record.status;
      record.status = nextStatus;
      if (req.body.assignedTo) {
        if (!mongoose.Types.ObjectId.isValid(req.body.assignedTo)) throw new ApiError(400, "Assignee is invalid");
        record.assignedTo = req.body.assignedTo;
      }
      record.version += 1;
      record.history.push({
        action: "Status Transition",
        fromStatus: previousStatus,
        toStatus: nextStatus,
        note: String(req.body.note || "").trim(),
        actor: req.user.id,
        actorName: req.user.name || ""
      });
      await record.save();
      queueAssignmentNotification({ record, definition, actorId: req.user.id });
      await audit(req, "workflow_transition", definition.key, { fromStatus: previousStatus, toStatus: nextStatus, note: req.body.note || "" }, record._id);
      res.json({ success: true, record: serialize(record) });
    })
  );

  moduleRouter.delete(
    "/:id",
    authMiddleware,
    authorizePermission(definition.key, "delete"),
    asyncHandler(async (req, res) => {
      const record = await Model.findById(req.params.id);
      if (!record || record.isArchived) throw new ApiError(404, `${definition.singular} not found`);
      record.isArchived = true;
      record.version += 1;
      record.history.push({ action: "Archived", fromStatus: record.status, actor: req.user.id, actorName: req.user.name || "" });
      await record.save();
      await audit(req, "archive", definition.key, { recordId: record.recordId, title: record.title }, record._id);
      res.json({ success: true, message: `${definition.singular} archived` });
    })
  );

  router.use(basePath, moduleRouter);
};

router.get(
  "/hse/modules",
  authMiddleware,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, modules: ENTERPRISE_HSE_MODULES });
  })
);

router.get(
  "/hse/assignees",
  authMiddleware,
  asyncHandler(async (_req, res) => {
    const users = await User.find({ status: "active" })
      .select("name email role department employeeId")
      .sort({ name: 1 })
      .limit(1000)
      .lean();
    res.json({ success: true, users });
  })
);

router.get(
  "/hse/checklist-templates",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const definition = findHseModule(String(req.query.moduleKey || ""));
    if (!definition) throw new ApiError(400, "A valid checklist module is required");
    if (!canAccessModule(req.user.permissions, definition.key, "view")) throw new ApiError(403, "You do not have permission to view these templates", null, "PERMISSION_DENIED");
    const templates = await HseChecklistTemplate.find({ moduleKey: definition.key, isActive: true })
      .populate("createdBy", "name role")
      .sort({ category: 1, name: 1 })
      .limit(500)
      .lean();
    res.json({ success: true, templates });
  })
);

router.post(
  "/hse/checklist-templates",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const definition = findHseModule(String(req.body.moduleKey || ""));
    if (!definition) throw new ApiError(400, "A valid checklist module is required");
    if (!canAccessModule(req.user.permissions, definition.key, "create")) throw new ApiError(403, "You do not have permission to create templates", null, "PERMISSION_DENIED");
    const name = String(req.body.name || "").trim();
    const items = cleanObject(req.body.items || []);
    if (!name || !Array.isArray(items) || !items.length) throw new ApiError(400, "Template name and checklist items are required");
    const template = await HseChecklistTemplate.create({
      name,
      moduleKey: definition.key,
      category: String(req.body.category || "").trim(),
      items: items.map((item) => ({ item: item.item, guidance: item.remarks || item.guidance || "", critical: item.critical === true })),
      createdBy: req.user.id
    });
    await audit(req, "create_checklist_template", definition.key, { name, itemCount: template.items.length }, template._id);
    res.status(201).json({ success: true, template });
  })
);

router.get(
  "/hse/dashboard",
  authMiddleware,
  authorizePermission("dashboard", "view"),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const moduleMetrics = await Promise.all(ENTERPRISE_HSE_MODULES.map(async (definition) => {
      const Model = getHseModel(definition.key);
      const terminalStatuses = terminalStatusesFor(definition);
      const [total, open, overdue, highRisk, expiring] = await Promise.all([
        Model.countDocuments({ isArchived: false }),
        Model.countDocuments({ isArchived: false, status: { $nin: terminalStatuses } }),
        Model.countDocuments({ isArchived: false, dueDate: { $lt: now }, status: { $nin: terminalStatuses } }),
        Model.countDocuments({ isArchived: false, status: { $nin: terminalStatuses }, $or: [{ severity: { $in: ["High", "Critical"] } }, { priority: { $in: ["High", "Urgent"] } }] }),
        Model.countDocuments({ isArchived: false, expiryDate: { $gte: now, $lte: thirtyDaysAhead } })
      ]);
      return { key: definition.key, label: definition.label, phase: definition.phase, total, open, overdue, highRisk, expiring };
    }));
    const Incident = getHseModel("incidents");
    const Observation = getHseModel("observations");
    const Capa = getHseModel("capa");
    const Permit = getHseModel("permits");
    const Inspection = getHseModel("inspections");
    const Toolbox = getHseModel("toolbox-talks");
    const Ppe = getHseModel("ppe");
    const Contractor = getHseModel("contractors");
    const Emergency = getHseModel("emergency-logs");
    const Document = getHseModel("documents");
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const [recentIncidents, safeObservations, allObservations, overdueCapa, activePermits, inspectionResults, toolboxThisMonth, ppeDue, contractorExpiring, emergencyOpen, documentExpiring] = await Promise.all([
      Incident.countDocuments({ createdAt: { $gte: thirtyDaysAgo }, isArchived: false }),
      Observation.countDocuments({ category: { $in: ["Safe Act", "Positive Practice"] }, isArchived: false }),
      Observation.countDocuments({ isArchived: false }),
      Capa.countDocuments({ dueDate: { $lt: now }, status: { $nin: terminalStatusesFor(findHseModule("capa")) }, isArchived: false }),
      Permit.countDocuments({ status: "Active", isArchived: false }),
      Inspection.aggregate([
        { $match: { isArchived: false } },
        { $unwind: "$checklist" },
        { $match: { "checklist.result": { $in: ["Compliant", "Non-Compliant"] } } },
        { $group: { _id: null, total: { $sum: 1 }, compliant: { $sum: { $cond: [{ $eq: ["$checklist.result", "Compliant"] }, 1, 0] } } } }
      ]),
      Toolbox.countDocuments({ businessDate: { $gte: monthStart }, status: { $in: ["Conducted", "Attendance Verified", "Closed"] }, isArchived: false }),
      Ppe.countDocuments({ status: { $in: ["Due for Inspection", "Damaged"] }, isArchived: false }),
      Contractor.countDocuments({ expiryDate: { $gte: now, $lte: thirtyDaysAhead }, isArchived: false }),
      Emergency.countDocuments({ status: { $ne: "Closed" }, isArchived: false }),
      Document.countDocuments({ expiryDate: { $gte: now, $lte: thirtyDaysAhead }, isArchived: false })
    ]);
    const inspectionTotals = inspectionResults[0] || { total: 0, compliant: 0 };
    res.json({
      success: true,
      generatedAt: now,
      kpis: {
        incidentsLast30Days: recentIncidents,
        safeObservationRate: allObservations ? Math.round((safeObservations / allObservations) * 100) : 0,
        overdueCapa,
        activePermits,
        highRiskOpen: moduleMetrics.reduce((sum, item) => sum + item.highRisk, 0),
        expiringItems: moduleMetrics.reduce((sum, item) => sum + item.expiring, 0),
        inspectionComplianceRate: inspectionTotals.total ? Math.round((inspectionTotals.compliant / inspectionTotals.total) * 100) : 0,
        toolboxThisMonth,
        ppeDue,
        contractorExpiring,
        emergencyOpen,
        documentExpiring
      },
      modules: moduleMetrics
    });
  })
);

router.get(
  "/hse/alerts",
  authMiddleware,
  authorizePermission("dashboard", "view"),
  asyncHandler(async (_req, res) => {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const groups = await Promise.all(ENTERPRISE_HSE_MODULES.map(async (definition) => {
      const Model = getHseModel(definition.key);
      const terminalStatuses = terminalStatusesFor(definition);
      const records = await Model.find({
        isArchived: false,
        status: { $nin: terminalStatuses },
        $or: [
          { dueDate: { $lt: now } },
          { expiryDate: { $gte: now, $lte: soon } },
          { severity: "Critical" },
          { priority: "Urgent" }
        ]
      }).select("recordId title status severity priority dueDate expiryDate assignedTo").sort({ dueDate: 1, expiryDate: 1 }).limit(10).lean();
      return records.map((record) => ({ ...record, module: definition.key, moduleLabel: definition.label }));
    }));
    res.json({ success: true, alerts: groups.flat().slice(0, 100), generatedAt: now });
  })
);

ENTERPRISE_HSE_MODULES.forEach((definition) => {
  registerCrudRoutes(definition, `/${definition.slug}`);
  definition.aliases.forEach((alias) => registerCrudRoutes(definition, `/${alias}`));
});

router.use((req, _res, next) => {
  if (findHseModule(req.path.split("/").filter(Boolean)[0])) {
    next(new ApiError(404, "HSE resource not found"));
    return;
  }
  next();
});

module.exports = router;
