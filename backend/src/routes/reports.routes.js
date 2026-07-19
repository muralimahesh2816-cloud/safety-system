const express = require("express");
const asyncHandler = require("../utils/async-handler");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const audit = require("../middleware/audit.middleware");
const WorkApproval = require("../models/WorkApproval");
const Hazard = require("../models/Hazard");
const User = require("../models/User");
const Training = require("../models/Training");
const { filterByPeriod, buildCsv } = require("../utils/reporting");
const { getChainageFrom, getChainageTo } = require("../utils/chainage");
const { canViewExactLocation, redactRecordLocations } = require("../utils/media-metadata");
const logger = require("../utils/logger");

const router = express.Router();

const normalizeChainageForCompare = (value = "") => String(value || "").trim().replace(/\s+/g, "").toLowerCase();

const getStrictChainageTo = (record = {}) => {
  const to = String(record.chainageTo || "").trim();
  const from = getChainageFrom(record);
  return to && normalizeChainageForCompare(to) !== normalizeChainageForCompare(from) ? to : "";
};

const toRows = ({ work, hazards, users, training }) => {
  const rows = [];
  work.forEach((item) => {
    rows.push({
      module: "work",
      title: item.title,
      status: item.status,
      priority: item.priority,
      createdAt: item.createdAt
    });
  });
  hazards.forEach((item) => {
    rows.push({
      module: "hazard",
      title: item.title,
      status: item.status,
      priority: item.severity,
      createdAt: item.createdAt
    });
  });
  users.forEach((item) => {
    rows.push({
      module: "user",
      title: item.name,
      status: item.status,
      priority: item.role,
      createdAt: item.createdAt
    });
  });
  training.forEach((item) => {
    rows.push({
      module: "training",
      title: item.title,
      status: item.isPublished ? "Published" : "Draft",
      priority: item.category,
      createdAt: item.createdAt
    });
  });
  return rows;
};

const normalizeWorkflowStage = (record = {}) => {
  const stage = record.workflowStage || record.status || "Pending Check";
  return stage === "Pending Approval" ? "Pending Final Approval" : stage;
};

const toLegacyWorkRecord = (record, user) => redactRecordLocations({
  _id: record._id,
  approvalNumber: record.approvalNumber || `WA-${String(record._id).slice(-8).toUpperCase()}`,
  date: record.createdAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  plaza: record.plaza || "",
  workType: record.workType || record.title || "",
  description: record.description || "",
  location: record.location || "",
  chainageFrom: getChainageFrom(record),
  chainageTo: getStrictChainageTo(record),
  chainage: record.chainage || getChainageFrom(record),
  chainageNo: record.chainageNo || record.chainage || getChainageFrom(record),
  approvedChainageFrom: record.approvedChainage?.from || getChainageFrom(record),
  approvedChainageTo: record.approvedChainage?.to || getChainageTo(record),
  completedChainageFrom: record.completedChainageFrom || record.completion?.completedChainageFrom || "",
  completedChainageTo: record.completedChainageTo || record.completion?.completedChainageTo || "",
  remainingChainageFrom: record.remainingChainageFrom || record.completion?.remainingChainageFrom || "",
  remainingChainageTo: record.remainingChainageTo || record.completion?.remainingChainageTo || "",
  partialCompletionReason: record.partialCompletionReason || record.completion?.partialCompletionReason || "",
  workersCount: record.workersCount || 0,
  priority: record.priority || "Medium",
  status: record.status === "Pending Approval"
    ? "Pending Final Approval"
    : record.status || normalizeWorkflowStage(record),
  workflowStage: normalizeWorkflowStage(record),
  reportedBy: record.createdByName || record.createdBy?.name || "",
  createdByName: record.createdByName || record.createdBy?.name || "",
  createdByRole: record.createdByRole || record.createdBy?.role || "",
  checkedBy: record.checkedBy || "",
  checkedByRole: record.checkedByRole || "",
  checkedDescription: record.checkedDescription || "",
  checkedAt: record.checkedAt || "",
  recommendedBy: record.recommendedBy || "",
  recommendedByRole: record.recommendedByRole || "",
  recommendedDescription: record.recommendedDescription || "",
  recommendedAt: record.recommendedAt || "",
  approvedBy: record.approvedBy || "",
  approvedByRole: record.approvedByRole || "",
  approvalDescription: record.approvalDescription || "",
  approvedAt: record.approvedAt || "",
  approvalDate: record.approvedAt || "",
  returnedBy: record.returnedBy || "",
  returnedByRole: record.returnedByRole || "",
  returnDescription: record.returnDescription || "",
  returnStage: record.returnStage || "",
  returnedAt: record.returnedAt || "",
  completedBy: record.completedBy || "",
  completedByRole: record.completedByRole || "",
  completionDescription: record.completionDescription || "",
  completedAt: record.completedAt || "",
  completionDate: record.completedAt || (["Completed", "Partially Completed"].includes(record.status) ? record.updatedAt : ""),
  returnedHistory: record.returnedHistory || [],
  chainageAuditHistory: record.chainageAuditHistory || [],
  timeline: record.timeline || [],
  beforeImage: record.beforeImages?.[0]?.url || record.beforeImage || "",
  afterImage: record.afterImages?.[0]?.url || record.afterImage || "",
  beforeVideo: record.beforeVideos?.[0]?.url || record.beforeVideo || "",
  afterVideo: record.afterVideos?.[0]?.url || record.afterVideo || "",
  beforeImages: record.beforeImages || [],
  afterImages: record.afterImages || [],
  beforeVideos: record.beforeVideos || [],
  afterVideos: record.afterVideos || [],
  mediaCount:
    (record.beforeImages?.length || 0) +
    (record.afterImages?.length || 0) +
    (record.beforeVideos?.length || 0) +
    (record.afterVideos?.length || 0)
}, user, ["beforeImages", "afterImages", "beforeVideos", "afterVideos"]);

const formatCorrectiveActions = (actions = []) =>
  actions
    .map((item) => {
      const owner = item.owner?.name ? ` (${item.owner.name})` : "";
      const status = item.status ? ` [${item.status}]` : "";
      return `${item.action || ""}${owner}${status}`.trim();
    })
    .filter(Boolean)
    .join("; ");

const toLegacyHazardRecord = (record, user) => redactRecordLocations({
  _id: record._id,
  date: record.date || record.createdAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  plaza: record.plaza || "",
  location: record.location || "",
  reportedBy:
    typeof record.reportedBy === "object"
      ? record.reportedBy?.name || record.reportedByName || ""
      : record.reportedByName || "",
  category: record.category || "",
  description: record.description || "",
  severity: record.severity || "",
  likelihood: record.likelihood || "",
  riskScore: record.riskScore || 0,
  action: record.action || "",
  actionTaken: record.closureNotes || formatCorrectiveActions(record.correctiveActions),
  status: record.status === "Closed" ? "Closed" : "Open",
  beforeImage: record.evidenceImages?.[0]?.url || record.beforeImage || "",
  afterImage: record.closureImages?.[0]?.url || record.afterImage || "",
  beforeVideo: record.evidenceVideos?.[0]?.url || record.beforeVideo || "",
  afterVideo: record.closureVideos?.[0]?.url || record.afterVideo || "",
  evidenceImages: record.evidenceImages || [],
  closureImages: record.closureImages || [],
  evidenceVideos: record.evidenceVideos || [],
  closureVideos: record.closureVideos || []
}, user, ["evidenceImages", "closureImages", "evidenceVideos", "closureVideos"]);

const toMediaExportRows = (record, moduleName, user) => {
  const fields = moduleName === "work"
    ? [["beforeImages", "Before"], ["beforeVideos", "Before"], ["afterImages", "Completion"], ["afterVideos", "Completion"]]
    : [["evidenceImages", "Before"], ["evidenceVideos", "Before"], ["closureImages", "After"], ["closureVideos", "After"]];
  const exactLocationAllowed = canViewExactLocation(user, record);
  return fields.flatMap(([field, stage]) => (record[field] || []).map((media) => ({
    module: `${moduleName}_media`,
    title: record.title || record.approvalNumber || moduleName,
    status: record.status,
    priority: record.priority || record.severity || "",
    createdAt: record.createdAt,
    mediaType: media.mediaType || (field.toLowerCase().includes("video") ? "video" : "image"),
    evidenceStage: stage,
    captureSource: media.captureSource || "file",
    capturedAt: media.location?.capturedAt || media.uploadedAt || "",
    latitude: exactLocationAllowed ? media.location?.latitude ?? "" : "",
    longitude: exactLocationAllowed ? media.location?.longitude ?? "" : "",
    accuracyMeters: exactLocationAllowed ? media.location?.accuracyMeters ?? "" : "",
    formattedAddress: exactLocationAllowed ? media.location?.formattedAddress || media.location?.plaza || "" : "",
    uploadedBy: media.uploadedBy || "",
    uploadedAt: media.uploadedAt || "",
    mediaUrl: media.secureUrl || media.url || "",
    thumbnailUrl: media.thumbnailUrl || "",
    watermarkStatus: media.watermark?.processingStatus || "not_required"
  })));
};

router.get(
  "/work",
  authMiddleware,
  authorizePermission("reports", "view"),
  asyncHandler(async (req, res) => {
    const records = await WorkApproval.find()
      .populate("createdBy", "name role")
      .select(
        "title plaza approvalNumber workType description location chainage chainageNo chainageFrom chainageTo approvedChainage completedChainageFrom completedChainageTo remainingChainageFrom remainingChainageTo partialCompletionReason completion workersCount priority status workflowStage createdBy createdByName createdByRole checkedBy checkedByRole checkedDescription checkedAt checked recommendedBy recommendedByRole recommendedDescription recommendedAt recommended approvedBy approvedByRole approvalDescription approvedAt approved returnedBy returnedByRole returnDescription returnStage returnedAt returnedHistory completedBy completedByRole completionDescription completedAt beforeImages afterImages beforeVideos afterVideos beforeImage afterImage beforeVideo afterVideo timeline chainageAuditHistory createdAt updatedAt"
      )
      .sort({ createdAt: -1 });
    await audit(req, "report_work_view", "reports", { type: "work", rows: records.length });
    res.json(records.map((record) => toLegacyWorkRecord(record, req.user)));
  })
);

router.get(
  "/hazard",
  authMiddleware,
  authorizePermission("reports", "view"),
  asyncHandler(async (req, res) => {
    const records = await Hazard.find()
      .populate("reportedBy", "name")
      .populate("correctiveActions.owner", "name")
      .select(
        "title date plaza location reportedBy reportedByName category description severity likelihood riskScore action correctiveActions closureNotes status evidenceImages closureImages evidenceVideos closureVideos beforeImage afterImage beforeVideo afterVideo createdAt updatedAt"
      )
      .sort({ createdAt: -1 });
    await audit(req, "report_hazard_view", "reports", { type: "hazard", rows: records.length });
    res.json(records.map((record) => toLegacyHazardRecord(record, req.user)));
  })
);

router.get(
  "/analytics",
  authMiddleware,
  authorizePermission("reports", "view"),
  asyncHandler(async (req, res) => {
    const period = req.query.period || "monthly";
    const [work, hazards, users, training] = await Promise.all([
      WorkApproval.find().select("title status priority createdAt"),
      Hazard.find().select("title status severity riskScore createdAt"),
      User.find().select("name role status createdAt lastLoginAt"),
      Training.find().select("title category isPublished completions createdAt")
    ]);

    const filtered = {
      work: filterByPeriod(work, period),
      hazards: filterByPeriod(hazards, period),
      users: filterByPeriod(users, period),
      training: filterByPeriod(training, period)
    };

    const analytics = {
      period,
      totals: {
        work: filtered.work.length,
        hazards: filtered.hazards.length,
        users: filtered.users.length,
        training: filtered.training.length
      },
      workTrends: filtered.work.map((item) => ({
        title: item.title,
        status: item.status,
        priority: item.priority,
        createdAt: item.createdAt
      })),
      hazardTrends: filtered.hazards.map((item) => ({
        title: item.title,
        status: item.status,
        severity: item.severity,
        riskScore: item.riskScore,
        createdAt: item.createdAt
      })),
      userPerformance: filtered.users.map((item) => ({
        name: item.name,
        role: item.role,
        status: item.status,
        lastLoginAt: item.lastLoginAt
      })),
      safetyKpis: {
        closedHazardRate:
          filtered.hazards.length === 0
            ? 100
            : Math.round(
                (filtered.hazards.filter((item) => item.status === "Closed").length /
                  filtered.hazards.length) *
                  100
              ),
        workCompletionRate:
          filtered.work.length === 0
            ? 100
            : Math.round(
                (filtered.work.filter((item) => item.status === "Completed").length /
                  filtered.work.length) *
                  100
              )
      }
    };

    await audit(req, "report_analytics_view", "reports", {
      period,
      totals: analytics.totals
    });

    res.json({
      success: true,
      analytics,
      datasets: filtered
    });
  })
);

router.get(
  "/export",
  authMiddleware,
  authorizePermission("reports", "view"),
  asyncHandler(async (req, res) => {
    const startedAt = Date.now();
    const format = req.query.format || "csv";
    const period = req.query.period || "monthly";

    const [work, hazards, users, training] = await Promise.all([
      WorkApproval.find().select("title approvalNumber status priority createdBy assignedTo beforeImages afterImages beforeVideos afterVideos createdAt"),
      Hazard.find().select("title status severity reportedBy assignedTo evidenceImages closureImages evidenceVideos closureVideos createdAt"),
      User.find().select("name role status createdAt"),
      Training.find().select("title category isPublished createdAt")
    ]);

    const filtered = {
      work: filterByPeriod(work, period),
      hazards: filterByPeriod(hazards, period),
      users: filterByPeriod(users, period),
      training: filterByPeriod(training, period)
    };
    const rows = [
      ...toRows(filtered),
      ...filtered.work.flatMap((record) => toMediaExportRows(record, "work", req.user)),
      ...filtered.hazards.flatMap((record) => toMediaExportRows(record, "hazard", req.user))
    ];
    await audit(req, "report_export", "reports", {
      format,
      period,
      rows: rows.length
    });
    logger.info("Report export generated", {
      requestId: req.requestId,
      format,
      rows: rows.length,
      durationMs: Date.now() - startedAt
    });

    if (format === "csv") {
      const csv = buildCsv(rows);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="hse-${period}.csv"`);
      res.send(csv);
      return;
    }

    if (format === "pdf" || format === "excel") {
      res.json({
        success: true,
        format,
        period,
        rows,
        note: `Use client-side ${format.toUpperCase()} render/export from these rows`
      });
      return;
    }

    res.json({
      success: true,
      format,
      period,
      rows
    });
  })
);

module.exports = router;
