const AuditLog = require("../models/AuditLog");
const { getHseModel } = require("../models/EnterpriseHseRecord");
const { createNotification } = require("./notifications.service");
const logger = require("../utils/logger");

const DAY_MS = 24 * 60 * 60 * 1000;

const governanceRules = (now) => [
  {
    module: "capa",
    query: { dueDate: { $lt: now }, status: { $nin: ["Verified", "Closed", "Overdue"] }, isArchived: false },
    status: "Overdue",
    label: "CAPA target date passed"
  },
  {
    module: "compliance-calendar",
    query: { dueDate: { $lt: now }, status: { $nin: ["Completed", "Verified", "Overdue"] }, isArchived: false },
    status: "Overdue",
    label: "Compliance obligation overdue"
  },
  {
    module: "compliance-calendar",
    query: { dueDate: { $gte: now, $lte: new Date(now.getTime() + 30 * DAY_MS) }, status: "Planned", isArchived: false },
    status: "Due Soon",
    label: "Compliance obligation due within 30 days"
  },
  {
    module: "contractors",
    query: { expiryDate: { $lt: now }, status: { $nin: ["Closed", "Expired"] }, isArchived: false },
    status: "Expired",
    label: "Contractor approval or document expired"
  },
  {
    module: "competency-matrix",
    query: { expiryDate: { $lt: now }, status: { $ne: "Expired" }, isArchived: false },
    status: "Expired",
    label: "Competency expired"
  },
  {
    module: "competency-matrix",
    query: { expiryDate: { $gte: now, $lte: new Date(now.getTime() + 30 * DAY_MS) }, status: "Competent", isArchived: false },
    status: "Expiring",
    label: "Competency expires within 30 days"
  }
];

const applyRule = async (rule, now) => {
  const Model = getHseModel(rule.module);
  const records = await Model.find(rule.query).select("_id recordId title status assignedTo").limit(1000).lean();
  if (!records.length) return 0;

  await Model.bulkWrite(records.map((record) => ({
    updateOne: {
      filter: { _id: record._id, status: record.status },
      update: {
        $set: { status: rule.status },
        $inc: { version: 1 },
        $push: {
          history: {
            $each: [{
            action: "System Status Transition",
            fromStatus: record.status,
            toStatus: rule.status,
            note: rule.label,
            actorName: "HSE Governance Engine",
            at: now
            }],
            $slice: -100
          }
        }
      }
    }
  })));

  await AuditLog.insertMany(records.map((record) => ({
    actorName: "HSE Governance Engine",
    actorRole: "system",
    action: "system_status_transition",
    actionType: "workflow",
    module: rule.module,
    entityId: String(record._id),
    metadata: { recordId: record.recordId, reason: rule.label },
    previousValue: { status: record.status },
    newValue: { status: rule.status }
  })));

  records.filter((record) => record.assignedTo).forEach((record) => {
    createNotification({
      userId: record.assignedTo,
      type: "hse_governance",
      title: `${record.recordId} is ${rule.status}`,
      message: `${record.title}: ${rule.label}`,
      module: rule.module,
      relatedRecordId: record._id,
      priority: rule.status === "Overdue" || rule.status === "Expired" ? "urgent" : "high",
      data: { recordId: record._id, status: rule.status }
    }).catch(() => undefined);
  });
  return records.length;
};

const refreshHseGovernance = async (now = new Date()) => {
  const counts = {};
  for (const rule of governanceRules(now)) {
    counts[`${rule.module}:${rule.status}`] = await applyRule(rule, now);
  }
  return counts;
};

const startHseGovernanceScheduler = ({ intervalMs = 15 * 60 * 1000 } = {}) => {
  const run = () => refreshHseGovernance().then((counts) => {
    const changed = Object.values(counts).reduce((sum, count) => sum + count, 0);
    if (changed) logger.info("HSE governance statuses refreshed", { changed, counts });
  }).catch((error) => logger.error("HSE governance refresh failed", { message: error.message }));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref?.();
  return timer;
};

module.exports = {
  governanceRules,
  refreshHseGovernance,
  startHseGovernanceScheduler
};
