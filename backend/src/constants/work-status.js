const WORK_STAGES = Object.freeze({
  PENDING_CHECK: "Pending Check",
  PENDING_RECOMMENDATION: "Pending Recommendation",
  PENDING_FINAL_APPROVAL: "Pending Final Approval",
  APPROVED: "Approved",
  WORK_IN_PROGRESS: "Work In Progress",
  PARTIALLY_COMPLETED: "Partially Completed",
  RETURNED: "Returned for Correction",
  COMPLETED: "Completed",
  UNKNOWN: "Unknown"
});

const WORK_STAGE_VALUES = Object.freeze([
  WORK_STAGES.PENDING_CHECK,
  WORK_STAGES.PENDING_RECOMMENDATION,
  WORK_STAGES.PENDING_FINAL_APPROVAL,
  WORK_STAGES.APPROVED,
  WORK_STAGES.WORK_IN_PROGRESS,
  WORK_STAGES.PARTIALLY_COMPLETED,
  WORK_STAGES.RETURNED,
  WORK_STAGES.COMPLETED
]);

const LEGACY_STAGE_MAP = Object.freeze({
  Pending: WORK_STAGES.PENDING_CHECK,
  "Under Review": WORK_STAGES.PENDING_CHECK,
  "Pending Approval": WORK_STAGES.PENDING_FINAL_APPROVAL,
  "Final Approved": WORK_STAGES.APPROVED,
  Rejected: WORK_STAGES.RETURNED,
  complete: WORK_STAGES.COMPLETED,
  COMPLETED: WORK_STAGES.COMPLETED,
  "Work Completed": WORK_STAGES.COMPLETED,
  "Final Completed": WORK_STAGES.COMPLETED
});

const POST_APPROVAL_STAGES = new Set([
  WORK_STAGES.APPROVED,
  WORK_STAGES.WORK_IN_PROGRESS,
  WORK_STAGES.PARTIALLY_COMPLETED,
  WORK_STAGES.COMPLETED
]);

const normalizeWorkStage = (workOrStatus = {}) => {
  if (typeof workOrStatus === "string") {
    if (WORK_STAGE_VALUES.includes(workOrStatus)) return workOrStatus;
    return LEGACY_STAGE_MAP[workOrStatus] || WORK_STAGES.UNKNOWN;
  }

  const work = workOrStatus || {};
  const rawStage = work.workflowStage || work.status || "";
  if (rawStage) {
    const normalized = normalizeWorkStage(String(rawStage));
    if (normalized !== WORK_STAGES.UNKNOWN) return normalized;
  }
  if (work.completedAt || work.completedBy) return WORK_STAGES.COMPLETED;
  if (work.approvedAt || work.approvedBy) return WORK_STAGES.APPROVED;
  if (work.recommendedAt || work.recommendedBy) return WORK_STAGES.PENDING_FINAL_APPROVAL;
  if (work.checkedAt || work.checkedBy) return WORK_STAGES.PENDING_RECOMMENDATION;
  if (!rawStage) return WORK_STAGES.PENDING_CHECK;
  return WORK_STAGES.UNKNOWN;
};

const isPostApprovalStage = (workOrStatus = {}) =>
  POST_APPROVAL_STAGES.has(normalizeWorkStage(workOrStatus));

module.exports = {
  LEGACY_STAGE_MAP,
  POST_APPROVAL_STAGES,
  WORK_STAGES,
  WORK_STAGE_VALUES,
  isPostApprovalStage,
  normalizeWorkStage
};
