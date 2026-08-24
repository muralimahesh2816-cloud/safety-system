const field = (name, label, type = "text", options = {}) => ({ name, label, type, ...options });

const commonDetails = {
  incident: [
    field("incidentType", "Incident type", "select", { options: ["Injury", "Property Damage", "Environmental", "Fire", "Vehicle", "Security", "Other"] }),
    field("personInvolved", "Person involved"),
    field("immediateAction", "Immediate action", "textarea"),
    field("rootCause", "Root cause", "textarea")
  ],
  permit: [
    field("contractor", "Contractor"), field("workersCount", "Workers", "number"),
    field("hazards", "Work hazards", "textarea"), field("controlMeasures", "Control measures", "textarea"), field("requiredPpe", "Required PPE"),
    field("fireWatch", "Fire watch person", "text", { showWhen: { field: "category", value: "Hot Work" }, required: true }),
    field("gasTestReference", "Gas test reference", "text", { showWhen: { field: "category", value: "Confined Space" }, required: true }),
    field("rescuePlan", "Rescue plan", "textarea", { showWhen: { field: "category", values: ["Confined Space", "Height Work"] }, required: true }),
    field("isolationReference", "Isolation / LOTO reference", "text", { showWhen: { field: "category", value: "Electrical Isolation" }, required: true }),
    field("excavationDepth", "Excavation depth (m)", "number", { showWhen: { field: "category", value: "Excavation" }, required: true }),
    field("liftingPlan", "Lifting plan reference", "text", { showWhen: { field: "category", value: "Lifting" }, required: true })
  ],
  inspection: [field("inspectionArea", "Inspection area"), field("inspector", "Lead inspector"), field("overallFinding", "Overall finding", "textarea")],
  toolbox: [field("facilitator", "Facilitator"), field("crew", "Crew / contractor"), field("attendanceCount", "Attendance", "number"), field("keyPoints", "Key points", "textarea")],
  emergency: [field("activationTime", "Activation time", "datetime-local"), field("responseLead", "Response lead"), field("personsAffected", "Persons affected", "number"), field("agenciesInvolved", "Agencies involved"), field("responseActions", "Response actions", "textarea")],
  compliance: [field("legalReference", "Legal / standard reference"), field("responsibleDepartment", "Responsible department"), field("frequency", "Frequency"), field("evidenceRequired", "Evidence required", "textarea")],
};

const define = ({ key, label, singular, phase, description, statuses, categories, dateFields = ["businessDate"], severity = false, details = [], checklist = false, documents = false }) => ({
  key,
  slug: key,
  label,
  singular,
  phase,
  description,
  statuses,
  categories,
  dateFields,
  severity,
  details,
  checklist,
  documents
});

export const ENTERPRISE_HSE_MODULES = [
  define({ key: "incidents", label: "Incident Management", singular: "Incident", phase: 1, description: "Investigate events, establish causes, and verify corrective action.", statuses: ["Reported", "Initial Review", "Investigation", "Corrective Action", "Verification", "Closed"], categories: ["Injury", "Property Damage", "Environmental", "Fire", "Vehicle", "Security", "Other"], severity: true, details: commonDetails.incident }),
  define({ key: "permits", label: "Permit to Work", singular: "Permit", phase: 1, description: "Issue and govern high-risk work permits from draft through closure.", statuses: ["Draft", "Submitted", "Safety Review", "Final Approval", "Active", "Suspended", "Closed", "Cancelled"], categories: ["Hot Work", "Height Work", "Confined Space", "Electrical Isolation", "Excavation", "Lifting", "Road Work", "General"], dateFields: ["startDate", "expiryDate"], severity: true, details: commonDetails.permit, checklist: true }),
  define({ key: "inspections", label: "Safety Inspections", singular: "Inspection", phase: 1, description: "Run reusable checklists, assign findings, and verify close-out.", statuses: ["Planned", "In Progress", "Submitted", "Action Required", "Verified", "Closed"], categories: ["Site", "Facility", "Electrical", "Fire", "PPE", "Housekeeping", "Traffic Management"], details: commonDetails.inspection, checklist: true }),
  define({ key: "toolbox-talks", label: "Toolbox Talks", singular: "Toolbox Talk", phase: 1, description: "Schedule briefings, record attendance, and retain discussion evidence.", statuses: ["Scheduled", "Conducted", "Attendance Verified", "Closed"], categories: ["Daily Briefing", "High-Risk Work", "Weather", "Traffic", "Emergency", "Lessons Learned"], details: commonDetails.toolbox }),
  define({ key: "emergency-logs", label: "Emergency Response Log", singular: "Emergency Log", phase: 1, description: "Time-stamp emergency activation, response actions, stand-down, and debrief.", statuses: ["Activated", "Responding", "Under Control", "Stand Down", "Debriefed", "Closed"], categories: ["Fire", "Medical", "Chemical Spill", "Vehicle", "Security", "Natural Event", "Evacuation"], severity: true, details: commonDetails.emergency }),
  define({ key: "compliance-calendar", label: "Compliance Calendar", singular: "Compliance Event", phase: 2, description: "Plan legal, permit, audit, certification, and reporting obligations.", statuses: ["Planned", "Due Soon", "Evidence Pending", "Completed", "Verified", "Overdue"], categories: ["Legal", "Permit", "Audit", "Inspection", "Training", "Certification", "Reporting"], dateFields: ["dueDate"], details: commonDetails.compliance, documents: true }),
];

// Modules retired from the portal.
//
// These were removed from the navigation, routes and breadcrumbs — they are
// not hidden, their definitions are gone, so nothing renders or routes to
// them. Their *backend* collections are intentionally left in place: they may
// hold existing production records, and the enterprise HSE dashboard/alerts
// endpoints aggregate across every collection. Treat the corresponding server
// models as deprecated (no new writes) rather than dropping them, and use this
// list to filter retired modules out of aggregate responses.
export const DEPRECATED_HSE_MODULE_KEYS = Object.freeze([
  "observations",
  "capa",
  "first-aid",
  "contractors",
  "competency-matrix",
  "environmental-observations",
  "waste-records",
  "documents",
  "vehicle-inspections",
  "road-conditions",
  "toll-incidents",
  "fire-inspections",
  "equipment-inspections",
  "ppe"
]);

export const isDeprecatedHseModule = (key) => DEPRECATED_HSE_MODULE_KEYS.includes(key);

export const ENTERPRISE_HSE_KEYS = ENTERPRISE_HSE_MODULES.map((module) => module.key);
// Returns null (not undefined) for an unknown or retired key, so callers can
// null-check a lookup result without caring which of the two they got back.
export const getEnterpriseModule = (key) =>
  ENTERPRISE_HSE_MODULES.find((module) => module.key === key) || null;

export const NAV_GROUPS = [
  { key: "overview", label: "Overview", items: [{ key: "dashboard", label: "Dashboard", icon: "dashboard" }] },
  { key: "operational", label: "Operational Control", items: [
    { key: "work", label: "Work Approvals", icon: "work" },
    { key: "permits", label: "Permit to Work", icon: "permits" },
    { key: "inspections", label: "Safety Inspections", icon: "inspections" },
    { key: "toolbox-talks", label: "Toolbox Talks", icon: "toolbox-talks" }
  ] },
  { key: "risk", label: "Incident & Risk", items: [
    { key: "hazards", label: "Hazards / Near Miss", icon: "hazards" },
    { key: "incidents", label: "Incident Management", icon: "incidents" },
    { key: "emergency-logs", label: "Emergency Response", icon: "emergency-logs" },
  ] },
  { key: "people", label: "People & Training", items: [
    { key: "training", label: "Training", icon: "training" },
  ] },
  { key: "environment", label: "Compliance", items: [
    { key: "compliance-calendar", label: "Compliance Calendar", icon: "compliance-calendar" },
  ] },
  { key: "analytics", label: "Analytics & Administration", items: [
    { key: "reports", label: "Reports", icon: "reports" },
    { key: "users", label: "Users", icon: "users" },
    { key: "health", label: "System Health", icon: "health" },
    { key: "settings", label: "Settings", icon: "settings" }
  ] }
];
