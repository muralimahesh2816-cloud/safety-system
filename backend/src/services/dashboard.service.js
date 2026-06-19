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

const buildMonthlyTrend = (workList, hazardList, trainingList) => {
  const bucket = buildMonthlyBuckets();
  const indexMap = new Map(bucket.map((item, idx) => [item.key, idx]));

  const mark = (date, key) => {
    const d = new Date(date);
    const mapKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const idx = indexMap.get(mapKey);
    if (idx === undefined) return;
    bucket[idx][key] += 1;
  };

  workList.forEach((item) => mark(item.createdAt, "work"));
  hazardList.forEach((item) => mark(item.createdAt, "hazards"));
  trainingList.forEach((item) =>
    (item.completions || []).forEach((completion) => {
      if (completion.isCompleted && completion.completedAt) {
        mark(completion.completedAt, "trainingCompletions");
      }
    })
  );

  return bucket;
};

const calculateSafetyScore = ({ totalWork, completedWork, totalHazards, closedHazards }) => {
  const completionFactor = totalWork === 0 ? 100 : (completedWork / totalWork) * 100;
  const hazardFactor = totalHazards === 0 ? 100 : (closedHazards / totalHazards) * 100;
  return Math.min(100, Math.round(completionFactor * 0.6 + hazardFactor * 0.4));
};

const getDashboardSummary = async () => {
  const [users, work, hazards, trainings, activities] = await Promise.all([
    User.find().select("_id status role createdAt lastLoginAt"),
    WorkApproval.find().select("_id status createdAt updatedAt"),
    Hazard.find().select("_id status severity createdAt updatedAt"),
    Training.find().select("_id category completions createdAt"),
    AuditLog.find().sort({ createdAt: -1 }).limit(15)
  ]);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.status === "active").length;
  const totalWorkApprovals = work.length;
  const pendingWork = work.filter((item) => item.status === "Pending").length;
  const approvedWork = work.filter((item) => item.status === "Approved").length;
  const completedWork = work.filter((item) => item.status === "Completed").length;
  const totalHazards = hazards.length;
  const openHazards = hazards.filter((item) => item.status === "Open").length;
  const closedHazards = hazards.filter((item) => item.status === "Closed").length;
  const trainingRecords = trainings.length;

  const workStatus = [
    { name: "Pending", value: pendingWork },
    { name: "Approved", value: approvedWork },
    { name: "Completed", value: completedWork },
    {
      name: "Rejected",
      value: work.filter((item) => item.status === "Rejected").length
    }
  ];

  const hazardStatus = [
    { name: "Open", value: openHazards },
    {
      name: "In Progress",
      value: hazards.filter((item) => item.status === "In Progress").length
    },
    { name: "Closed", value: closedHazards }
  ];

  const monthlyTrend = buildMonthlyTrend(work, hazards, trainings);
  const userActivity = buildMonthlyBuckets(6).map((month) => ({
    month: month.label,
    logins: users.filter((user) => {
      if (!user.lastLoginAt) return false;
      const d = new Date(user.lastLoginAt);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      return key === month.key;
    }).length
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
