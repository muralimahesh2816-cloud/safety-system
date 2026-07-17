const User = require("../models/User");
const WorkApproval = require("../models/WorkApproval");
const Hazard = require("../models/Hazard");
const Training = require("../models/Training");
const AuditLog = require("../models/AuditLog");

const monthLabel = (date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short"
  }).format(date);

const buildMonthlyBuckets = (months = 6) => {
  const now = new Date();
  const bucket = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bucket.push({
      key: `${d.getFullYear()}-${d.getMonth() + 1}`,
      label: monthLabel(d),
      work: 0,
      hazards: 0,
      trainingCompletions: 0
    });
  }
  return bucket;
};

const getMonthlyStartDate = (months = 6) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
};

const applyAggregateCounts = (bucket, rows, field) => {
  const indexMap = new Map(bucket.map((item, idx) => [item.key, idx]));
  rows.forEach((row) => {
    const key = `${row._id.year}-${row._id.month}`;
    const index = indexMap.get(key);
    if (index !== undefined) bucket[index][field] = row.count;
  });
  return bucket;
};

const aggregateCreatedByMonth = (Model, startDate) =>
  Model.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 }
      }
    }
  ]);

const aggregateTrainingCompletionsByMonth = (startDate) =>
  Training.aggregate([
    { $unwind: "$completions" },
    {
      $match: {
        "completions.isCompleted": true,
        "completions.completedAt": { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: "$completions.completedAt" },
          month: { $month: "$completions.completedAt" }
        },
        count: { $sum: 1 }
      }
    }
  ]);

const aggregateUserLoginsByMonth = (startDate) =>
  User.aggregate([
    { $match: { lastLoginAt: { $gte: startDate } } },
    {
      $group: {
        _id: { year: { $year: "$lastLoginAt" }, month: { $month: "$lastLoginAt" } },
        count: { $sum: 1 }
      }
    }
  ]);

const calculateSafetyScore = ({ totalWork, completedWork, totalHazards, closedHazards }) => {
  const completionFactor = totalWork === 0 ? 100 : (completedWork / totalWork) * 100;
  const hazardFactor = totalHazards === 0 ? 100 : (closedHazards / totalHazards) * 100;
  return Math.min(100, Math.round(completionFactor * 0.6 + hazardFactor * 0.4));
};

const getDashboardSummary = async () => {
  const monthlyStart = getMonthlyStartDate();
  const pendingWorkStatuses = [
    "Pending",
    "Under Review",
    "Pending Check",
    "Pending Recommendation",
    "Pending Approval",
    "Pending Final Approval"
  ];
  const completedWorkStatuses = ["Completed", "Partially Completed"];
  const returnedWorkStatuses = ["Returned for Correction", "Rejected"];

  const [
    totalUsers,
    activeUsers,
    totalWorkApprovals,
    pendingWork,
    approvedWork,
    completedWork,
    partiallyCompletedWork,
    returnedWork,
    totalHazards,
    openHazards,
    closedHazards,
    trainingRecords,
    workMonthly,
    hazardMonthly,
    trainingCompletionMonthly,
    userLoginMonthly,
    activities
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: "active" }),
    WorkApproval.countDocuments(),
    WorkApproval.countDocuments({ status: { $in: pendingWorkStatuses } }),
    WorkApproval.countDocuments({ status: "Approved" }),
    WorkApproval.countDocuments({ status: { $in: completedWorkStatuses } }),
    WorkApproval.countDocuments({ status: "Partially Completed" }),
    WorkApproval.countDocuments({ status: { $in: returnedWorkStatuses } }),
    Hazard.countDocuments(),
    Hazard.countDocuments({ status: { $ne: "Closed" } }),
    Hazard.countDocuments({ status: "Closed" }),
    Training.countDocuments(),
    aggregateCreatedByMonth(WorkApproval, monthlyStart),
    aggregateCreatedByMonth(Hazard, monthlyStart),
    aggregateTrainingCompletionsByMonth(monthlyStart),
    aggregateUserLoginsByMonth(monthlyStart),
    AuditLog.find().sort({ createdAt: -1 }).limit(15)
  ]);

  const workStatus = [
    { name: "Pending", value: pendingWork },
    { name: "Approved", value: approvedWork },
    { name: "Completed", value: completedWork },
    { name: "Partially Completed", value: partiallyCompletedWork },
    { name: "Returned", value: returnedWork }
  ];

  const hazardStatus = [
    { name: "Open", value: openHazards },
    { name: "Closed", value: closedHazards }
  ];

  const monthlyTrend = buildMonthlyBuckets();
  applyAggregateCounts(monthlyTrend, workMonthly, "work");
  applyAggregateCounts(monthlyTrend, hazardMonthly, "hazards");
  applyAggregateCounts(monthlyTrend, trainingCompletionMonthly, "trainingCompletions");

  const userActivityBuckets = buildMonthlyBuckets().map((month) => ({ ...month, logins: 0 }));
  applyAggregateCounts(userActivityBuckets, userLoginMonthly, "logins");
  const userActivity = userActivityBuckets.map((month) => ({
    month: month.label,
    logins: month.logins
  }));

  const safetyPerformanceScore = calculateSafetyScore({
    totalWork: totalWorkApprovals,
    completedWork,
    totalHazards,
    closedHazards
  });

  return {
    kpis: {
      totalUsers,
      activeUsers,
      totalWorkApprovals,
      pendingWork,
      approvedWork,
      completedWork,
      partiallyCompletedWork,
      totalHazards,
      openHazards,
      closedHazards,
      trainingRecords
    },
    charts: {
      workStatus,
      hazardStatus,
      monthlyTrend: monthlyTrend.map((item) => ({
        month: item.label,
        work: item.work,
        hazards: item.hazards,
        trainingCompletions: item.trainingCompletions
      })),
      userActivity,
      safetyPerformanceScore
    },
    activities: activities.map((log) => ({
      id: log._id,
      action: log.action,
      module: log.module,
      entityId: log.entityId,
      message: `${log.module} ${log.action}`,
      timestamp: log.createdAt
    }))
  };
};

module.exports = {
  getDashboardSummary
};
