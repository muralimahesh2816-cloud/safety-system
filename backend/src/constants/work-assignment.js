const { ROLES, normalizeRole } = require("./roles");

const ASSIGNMENT_STAGES = Object.freeze({
  CHECK: "check",
  RECOMMENDATION: "recommendation",
  FINAL_APPROVAL: "finalApproval"
});

const ASSIGNMENT_ROLE_MAP = Object.freeze({
  [ASSIGNMENT_STAGES.CHECK]: [
    ROLES.SAFETY_OFFICER,
    ROLES.SAFETY_ENGINEER,
    ROLES.SITE_ENGINEER,
    ROLES.PROJECT_ENGINEER,
    ROLES.MAINTENANCE_ENGINEER
  ],
  [ASSIGNMENT_STAGES.RECOMMENDATION]: [ROLES.SAFETY_MANAGER],
  [ASSIGNMENT_STAGES.FINAL_APPROVAL]: [
    ROLES.PROJECT_MANAGER,
    ROLES.MAINTENANCE_MANAGER
  ]
});

const ASSIGNMENT_FIELD_MAP = Object.freeze({
  [ASSIGNMENT_STAGES.CHECK]: "assignedChecker",
  [ASSIGNMENT_STAGES.RECOMMENDATION]: "assignedRecommender",
  [ASSIGNMENT_STAGES.FINAL_APPROVAL]: "assignedFinalApprover"
});

const ASSIGNMENT_STAGE_ALIASES = Object.freeze({
  check: ASSIGNMENT_STAGES.CHECK,
  checker: ASSIGNMENT_STAGES.CHECK,
  pending_check: ASSIGNMENT_STAGES.CHECK,
  recommendation: ASSIGNMENT_STAGES.RECOMMENDATION,
  recommend: ASSIGNMENT_STAGES.RECOMMENDATION,
  recommender: ASSIGNMENT_STAGES.RECOMMENDATION,
  pending_recommendation: ASSIGNMENT_STAGES.RECOMMENDATION,
  final_approval: ASSIGNMENT_STAGES.FINAL_APPROVAL,
  finalapproval: ASSIGNMENT_STAGES.FINAL_APPROVAL,
  approve: ASSIGNMENT_STAGES.FINAL_APPROVAL,
  approver: ASSIGNMENT_STAGES.FINAL_APPROVAL,
  pending_final_approval: ASSIGNMENT_STAGES.FINAL_APPROVAL
});

const normalizeAssignmentStage = (stage = "") => {
  if (Object.values(ASSIGNMENT_STAGES).includes(stage)) return stage;
  const key = String(stage || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return ASSIGNMENT_STAGE_ALIASES[key] || "";
};

const getEligibleAssigneeRoles = (stage) =>
  ASSIGNMENT_ROLE_MAP[normalizeAssignmentStage(stage)] || [];

const getAssignmentField = (stage) =>
  ASSIGNMENT_FIELD_MAP[normalizeAssignmentStage(stage)] || "";

const isEligibleAssigneeRole = (stage, role) =>
  getEligibleAssigneeRoles(stage).includes(normalizeRole(role));

module.exports = {
  ASSIGNMENT_STAGES,
  ASSIGNMENT_ROLE_MAP,
  ASSIGNMENT_FIELD_MAP,
  normalizeAssignmentStage,
  getEligibleAssigneeRoles,
  getAssignmentField,
  isEligibleAssigneeRole
};
