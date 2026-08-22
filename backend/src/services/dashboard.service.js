const User = require("../models/User");
const WorkApproval = require("../models/WorkApproval");
const Hazard = require("../models/Hazard");
const Training = require("../models/Training");
const AuditLog = require("../models/AuditLog");
const { WORK_STAGES } = require("../constants/work-status");

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

// Effective workflow stage for a record: `workflowStage` when present, else the
// legacy `status` field. Expressed once here and reused by the grouping below.
const EFFECTIVE_STAGE = {
  $cond: [
    {
      $and: [
        { $ne: [{ $ifNull: ["$workflowStage", ""] }, ""] },
        { $ne: ["$workflowStage", null] }
      ]
    },
    "$workflowStage",
    "$status"
  ]
};

// Every historical spelling that maps onto each KPI bucket. Kept as data so
// the mapping is auditable in one place rather than spread across nine
// separate aggregation stages.
const STAGE_BUCKETS = {
  pendingCheck: ["Pending", "Under Review", WORK_STAGES.PENDING_CHECK],
  pendingRecommendation: [WORK_STAGES.PENDING_RECOMMENDATION],
  pendingFinalApproval: ["Pending Approval", WORK_STAGES.PENDING_FINAL_APPROVAL],
  approved: ["Final Approved", WORK_STAGES.APPROVED],
  workInProgress: [WORK_STAGES.WORK_IN_PROGRESS],
  completed: [
    WORK_STAGES.COMPLETED,
    "COMPLETED",
    "complete",
    "Work Completed",
    "Final Completed"
  ],
  partiallyCompleted: [WORK_STAGES.PARTIALLY_COMPLETED],
  returnedForCorrection: [WORK_STAGES.RETURNED, "Rejected"]
};

const STAGE_TO_BUCKET = new Map(
  Object.entries(STAGE_BUCKETS).flatMap(([bucket, stages]) =>
    stages.map((stage) => [stage, bucket])
  )
);

/**
 * Work-approval KPI counts.
 *
 * This used to run a `$facet` of nine `$match` stages, each wrapping its
 * predicate in `$expr`. `$expr` cannot use an index, so every one of those
 * nine branches was a full collection scan of WorkApproval — nine scans per
 * dashboard load, per user, on a 30-second poll.
 *
 * It is now a single `$group` that counts documents per effective stage; the
 * (small, bounded) result is folded into the KPI buckets in JS.
 */
const aggregateWorkKpis = async () => {
  const rows = await WorkApproval.aggregate([
    { $group: { _id: EFFECTIVE_STAGE, count: { $sum: 1 } } }
  ]);

  const counts = Object.fromEntries(Object.keys(STAGE_BUCKETS).map((key) => [key, 0]));
  let total = 0;

  rows.forEach((row) => {
    const count = row.count || 0;
    total += count;
    const bucket = STAGE_TO_BUCKET.get(row._id);
    if (bucket) counts[bucket] += count;
  });

  return { total, ...counts };
};

const buildAssignedTasks = async (user = {}) => {
  const userId = user?.id;
  const checks = [];
  const itemQueries = [];

  if (userId) {
    checks.push(["pendingCheck", WorkApproval.countDocuments({ workflowStage: "Pending Check", assignedChecker: userId })]);
    itemQueries.push(
      WorkApproval.find({ workflowStage: "Pending Check", assignedChecker: userId })
        .select("title workType location workflowStage priority createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
    );
  } else {
    checks.push(["pendingCheck", Promise.resolve(0)]);
  }

  if (userId) {
    checks.push(["pendingRecommendation", WorkApproval.countDocuments({ workflowStage: "Pending Recommendation", assignedRecommender: userId })]);
  } else {
    checks.push(["pendingRecommendation", Promise.resolve(0)]);
  }

  if (userId) {
    checks.push([
      "pendingApproval",
      WorkApproval.countDocuments({
        workflowStage: { $in: ["Pending Approval", "Pending Final Approval"] },
        assignedFinalApprover: userId
      })
    ]);
  } else {
    checks.push(["pendingApproval", Promise.resolve(0)]);
  }

  checks.push([
    "returnedWork",
    userId
      ? WorkApproval.countDocuments({ createdBy: userId, workflowStage: "Returned for Correction" })
      : Promise.resolve(0)
  ]);
  checks.push([
    "incompleteWork",
    userId
      ? WorkApproval.countDocuments({
          $or: [{ createdBy: userId }, { assignedTo: userId }],
          workflowStage: { $in: ["Approved", "Partially Completed"] }
        })
      : Promise.resolve(0)
  ]);

  if (userId) {
    itemQueries.push(
      WorkApproval.find({ workflowStage: "Pending Recommendation", assignedRecommender: userId })
        .select("title workType location workflowStage priority createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
    );
  }
  if (userId) {
    itemQueries.push(
      WorkApproval.find({
        workflowStage: { $in: ["Pending Approval", "Pending Final Approval"] },
        assignedFinalApprover: userId
      })
        .select("title workType location workflowStage priority createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
    );
  }
  if (userId) {
    itemQueries.push(
      WorkApproval.find({
        $or: [
          { createdBy: userId, workflowStage: "Returned for Correction" },
          {
            $or: [{ createdBy: userId }, { assignedTo: userId }],
            workflowStage: { $in: ["Approved", "Partially Completed"] }
          }
        ]
      })
        .select("title workType location workflowStage priority createdAt")
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(5)
    );
  }

  const [countPairs, itemGroups] = await Promise.all([
    Promise.all(checks.map(async ([key, promise]) => [key, await promise])),
    Promise.all(itemQueries)
  ]);

  const counts = Object.fromEntries(countPairs);
  const items = Array.from(
    new Map(
      itemGroups
        .flat()
        .map((item) => [
          String(item._id),
          {
            id: item._id,
            title: item.title || item.workType || "Work Approval",
            location: item.location || "-",
            status: item.workflowStage,
            priority: item.priority || "Medium",
            url: `/work-approvals/${item._id}`,
            createdAt: item.createdAt
          }
        ])
    ).values()
  ).slice(0, 8);

  return {
    counts,
    total:
      counts.pendingCheck +
      counts.pendingRecommendation +
      counts.pendingApproval +
      counts.returnedWork +
      counts.incompleteWork,
    items
  };
};

const getDashboardSummary = async (user = {}) => {
  const monthlyStart = getMonthlyStartDate();
  const [
    totalUsers,
    activeUsers,
    workKpis,
    totalHazards,
    openHazards,
    closedHazards,
    trainingRecords,
    workMonthly,
    hazardMonthly,
    trainingCompletionMonthly,
    userLoginMonthly,
    activities,
    assignedTasks,
    hazardsAwaitClosure,
    trainingPending
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: "active" }),
    aggregateWorkKpis(),
    Hazard.countDocuments(),
    Hazard.countDocuments({ status: { $ne: "Closed" } }),
    Hazard.countDocuments({ status: "Closed" }),
    Training.countDocuments(),
    aggregateCreatedByMonth(WorkApproval, monthlyStart),
    aggregateCreatedByMonth(Hazard, monthlyStart),
    aggregateTrainingCompletionsByMonth(monthlyStart),
    aggregateUserLoginsByMonth(monthlyStart),
    AuditLog.find().sort({ createdAt: -1 }).limit(15),
    buildAssignedTasks(user),
    Hazard.countDocuments({ status: { $ne: "Closed" } }),
    Training.countDocuments({
      isPublished: true,
      completions: {
        $not: {
          $elemMatch: {
            user: user?.id,
            isCompleted: true
          }
        }
      }
    })
  ]);

  const totalWorkApprovals = workKpis.total;
  const pendingWork =
    workKpis.pendingCheck + workKpis.pendingRecommendation + workKpis.pendingFinalApproval;
  const approvedWork = workKpis.approved + workKpis.workInProgress;
  const completedWork = workKpis.completed;
  const partiallyCompletedWork = workKpis.partiallyCompleted;
  const returnedWork = workKpis.returnedForCorrection;

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
      workInProgress: workKpis.workInProgress,
      completedWork,
      partiallyCompleted: workKpis.partiallyCompleted,
      partiallyCompletedWork,
      pendingCheck: workKpis.pendingCheck,
      pendingRecommendation: workKpis.pendingRecommendation,
      pendingFinalApproval: workKpis.pendingFinalApproval,
      returnedForCorrection: workKpis.returnedForCorrection,
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
    assignedTasks,
    alerts: [
      assignedTasks.total > 0
        ? {
            type: "work",
            title: `${assignedTasks.total} Work Approval${assignedTasks.total === 1 ? "" : "s"} Need Attention`,
            priority: "high",
            module: "work"
          }
        : null,
      hazardsAwaitClosure > 0
        ? {
            type: "hazard",
            title: `${hazardsAwaitClosure} Hazard${hazardsAwaitClosure === 1 ? "" : "s"} Await Closure`,
            priority: "urgent",
            module: "hazards"
          }
        : null,
      trainingPending > 0
        ? {
            type: "training",
            title: `${trainingPending} Training Item${trainingPending === 1 ? "" : "s"} Pending`,
            priority: "medium",
            module: "training"
          }
        : null
    ].filter(Boolean),
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
