const express = require("express");
const asyncHandler = require("../utils/async-handler");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const WorkApproval = require("../models/WorkApproval");
const Hazard = require("../models/Hazard");
const User = require("../models/User");
const Training = require("../models/Training");
const { filterByPeriod, buildCsv } = require("../utils/reporting");
const { getChainageFrom } = require("../utils/chainage");

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

const toLegacyWorkRecord = (record) => ({
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
  workersCount: record.workersCount || 0,
  priority: record.priority || "Medium",
  status: record.status || "Pending",
  reportedBy: record.createdByName || record.createdBy?.name || "",
  createdByName: record.createdByName || record.createdBy?.name || "",
  createdByRole: record.createdByRole || record.createdBy?.role || "",
  checkedBy: record.checkedBy || "",
  recommendedBy: record.recommendedBy || "",
  approvedBy: record.approvedBy || "",
  approvedByRole: record.approvedByRole || "",
  approvedAt: record.approvedAt || "",
  approvalDate: record.approvedAt || "",
  completionDate: record.status === "Completed" ? record.updatedAt : "",
  beforeImage: record.beforeImages?.[0]?.url || record.beforeImage || "",
  afterImage: record.afterImages?.[0]?.url || record.afterImage || ""
});

const formatCorrectiveActions = (actions = []) =>
  actions
    .map((item) => {
      const owner = item.owner?.name ? ` (${item.owner.name})` : "";
      const status = item.status ? ` [${item.status}]` : "";
      return `${item.action || ""}${owner}${status}`.trim();
    })
    .filter(Boolean)
    .join("; ");

const toLegacyHazardRecord = (record) => ({
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
  afterImage: record.closureImages?.[0]?.url || record.afterImage || ""
});

router.get(
  "/work",
  authMiddleware,
  authorizePermission("reports", "view"),
  asyncHandler(async (_req, res) => {
    const records = await WorkApproval.find()
      .populate("createdBy", "name role")
      .select(
        "title plaza approvalNumber workType description location chainage chainageNo chainageFrom chainageTo workersCount priority status createdBy createdByName createdByRole checkedBy recommendedBy approvedBy approvedByRole approvedAt beforeImages afterImages beforeImage afterImage createdAt updatedAt"
      )
      .sort({ createdAt: -1 });
    res.json(records.map(toLegacyWorkRecord));
  })
);

router.get(
  "/hazard",
  authMiddleware,
  authorizePermission("reports", "view"),
  asyncHandler(async (_req, res) => {
    const records = await Hazard.find()
      .populate("reportedBy", "name")
      .populate("correctiveActions.owner", "name")
      .select(
        "title date plaza location reportedBy reportedByName category description severity likelihood riskScore action correctiveActions closureNotes status evidenceImages closureImages beforeImage afterImage createdAt updatedAt"
      )
      .sort({ createdAt: -1 });
    res.json(records.map(toLegacyHazardRecord));
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
    const format = req.query.format || "csv";
    const period = req.query.period || "monthly";

    const [work, hazards, users, training] = await Promise.all([
      WorkApproval.find().select("title status priority createdAt"),
      Hazard.find().select("title status severity createdAt"),
      User.find().select("name role status createdAt"),
      Training.find().select("title category isPublished createdAt")
    ]);

    const filtered = {
      work: filterByPeriod(work, period),
      hazards: filterByPeriod(hazards, period),
      users: filterByPeriod(users, period),
      training: filterByPeriod(training, period)
    };
    const rows = toRows(filtered);

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
