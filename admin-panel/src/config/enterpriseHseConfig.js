const field = (name, label, type = "text", options = {}) => ({ name, label, type, ...options });

const commonDetails = {
  incident: [
    field("incidentType", "Incident type", "select", { options: ["Injury", "Property Damage", "Environmental", "Fire", "Vehicle", "Security", "Other"] }),
    field("personInvolved", "Person involved"),
    field("immediateAction", "Immediate action", "textarea"),
    field("rootCause", "Root cause", "textarea")
  ],
  observation: [field("observedActivity", "Observed activity"), field("recommendedAction", "Recommended action", "textarea")],
  capa: [field("sourceReference", "Source reference"), field("actionPlan", "Action plan", "textarea"), field("verificationMethod", "Verification method")],
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
  ppe: [field("employeeName", "Employee / custodian"), field("employeeId", "Employee ID"), field("serialNumber", "Serial / batch number"), field("quantity", "Quantity", "number"), field("condition", "Condition", "select", { options: ["New", "Good", "Serviceable", "Damaged", "Disposed"] })],
  contractor: [field("companyName", "Legal company name"), field("contactPerson", "Contact person"), field("contactNumber", "Contact number"), field("scopeOfWork", "Scope of work", "textarea"), field("insuranceReference", "Insurance reference")],
  emergency: [field("activationTime", "Activation time", "datetime-local"), field("responseLead", "Response lead"), field("personsAffected", "Persons affected", "number"), field("agenciesInvolved", "Agencies involved"), field("responseActions", "Response actions", "textarea")],
  document: [field("documentNumber", "Document number"), field("revision", "Revision"), field("ownerDepartment", "Owner department"), field("reviewFrequency", "Review frequency"), field("keywords", "Keywords")],
  vehicle: [field("vehicleNumber", "Vehicle number"), field("driverName", "Driver"), field("odometer", "Odometer", "number"), field("defects", "Defects", "textarea")],
  road: [field("chainageFrom", "Chainage from"), field("chainageTo", "Chainage to"), field("lane", "Lane / carriageway"), field("trafficImpact", "Traffic impact", "textarea")],
  toll: [field("laneNumber", "Lane number"), field("vehicleNumber", "Vehicle number"), field("trafficImpact", "Traffic impact"), field("immediateAction", "Immediate action", "textarea")],
  fire: [field("equipmentNumber", "Equipment number"), field("lastServiceDate", "Last service date", "date"), field("defects", "Defects", "textarea")],
  firstAid: [field("personTreated", "Person treated"), field("treatment", "Treatment provided", "textarea"), field("firstAider", "First aider"), field("referral", "Referral / follow-up")],
  equipment: [field("equipmentNumber", "Equipment number"), field("manufacturer", "Manufacturer"), field("isolationRequired", "Isolation required", "select", { options: ["No", "Yes"] }), field("defects", "Defects", "textarea")],
  environmental: [field("aspect", "Environmental aspect"), field("potentialImpact", "Potential impact", "textarea"), field("containment", "Containment / control", "textarea")],
  waste: [field("wasteType", "Waste type"), field("quantity", "Quantity", "number"), field("unit", "Unit"), field("transporter", "Transporter"), field("manifestNumber", "Manifest number"), field("disposalFacility", "Disposal facility")],
  compliance: [field("legalReference", "Legal / standard reference"), field("responsibleDepartment", "Responsible department"), field("frequency", "Frequency"), field("evidenceRequired", "Evidence required", "textarea")],
  competency: [field("employeeName", "Employee name"), field("employeeId", "Employee ID"), field("competency", "Required competency"), field("currentLevel", "Current level", "select", { options: ["Not Trained", "Awareness", "Supervised", "Competent", "Trainer"] }), field("certificateNumber", "Certificate number")]
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
  define({ key: "observations", label: "Safety Observations", singular: "Observation", phase: 1, description: "Capture safe and unsafe acts or conditions and follow them through verification.", statuses: ["Open", "Assigned", "In Progress", "Resolved", "Verified", "Closed"], categories: ["Safe Act", "Unsafe Act", "Unsafe Condition", "Positive Practice", "Housekeeping", "PPE"], severity: true, details: commonDetails.observation }),
  define({ key: "capa", label: "CAPA", singular: "Corrective Action", phase: 1, description: "Control corrective and preventive actions with ownership, due dates, and verification.", statuses: ["Open", "Assigned", "In Progress", "Pending Verification", "Verified", "Closed", "Overdue"], categories: ["Corrective", "Preventive", "Audit Finding", "Incident", "Observation", "Inspection"], dateFields: ["dueDate"], details: commonDetails.capa }),
  define({ key: "permits", label: "Permit to Work", singular: "Permit", phase: 1, description: "Issue and govern high-risk work permits from draft through closure.", statuses: ["Draft", "Submitted", "Safety Review", "Final Approval", "Active", "Suspended", "Closed", "Cancelled"], categories: ["Hot Work", "Height Work", "Confined Space", "Electrical Isolation", "Excavation", "Lifting", "Road Work", "General"], dateFields: ["startDate", "expiryDate"], severity: true, details: commonDetails.permit, checklist: true }),
  define({ key: "inspections", label: "Safety Inspections", singular: "Inspection", phase: 1, description: "Run reusable checklists, assign findings, and verify close-out.", statuses: ["Planned", "In Progress", "Submitted", "Action Required", "Verified", "Closed"], categories: ["Site", "Facility", "Electrical", "Fire", "PPE", "Housekeeping", "Traffic Management"], details: commonDetails.inspection, checklist: true }),
  define({ key: "toolbox-talks", label: "Toolbox Talks", singular: "Toolbox Talk", phase: 1, description: "Schedule briefings, record attendance, and retain discussion evidence.", statuses: ["Scheduled", "Conducted", "Attendance Verified", "Closed"], categories: ["Daily Briefing", "High-Risk Work", "Weather", "Traffic", "Emergency", "Lessons Learned"], details: commonDetails.toolbox }),
  define({ key: "ppe", label: "PPE Register", singular: "PPE Record", phase: 1, description: "Track stock, issue, condition, inspection, return, and disposal.", statuses: ["In Stock", "Issued", "Due for Inspection", "Damaged", "Returned", "Disposed"], categories: ["Helmet", "Safety Shoes", "Gloves", "Eye Protection", "Hearing Protection", "Harness", "Respiratory"], details: commonDetails.ppe }),
  define({ key: "contractors", label: "Contractor Register", singular: "Contractor", phase: 1, description: "Control contractor prequalification, documents, insurance, and approval status.", statuses: ["Prequalified", "Pending Documents", "Approved", "Suspended", "Expired", "Closed"], categories: ["Civil", "Electrical", "Mechanical", "Maintenance", "Security", "Transport", "Specialist"], dateFields: ["expiryDate"], details: commonDetails.contractor, documents: true }),
  define({ key: "emergency-logs", label: "Emergency Response Log", singular: "Emergency Log", phase: 1, description: "Time-stamp emergency activation, response actions, stand-down, and debrief.", statuses: ["Activated", "Responding", "Under Control", "Stand Down", "Debriefed", "Closed"], categories: ["Fire", "Medical", "Chemical Spill", "Vehicle", "Security", "Natural Event", "Evacuation"], severity: true, details: commonDetails.emergency }),
  define({ key: "documents", label: "Document Library", singular: "Document", phase: 1, description: "Govern HSE policies, procedures, revisions, reviews, and expiry.", statuses: ["Draft", "Under Review", "Approved", "Published", "Archived"], categories: ["Policy", "Procedure", "SOP", "Checklist", "Form", "Standard", "Legal Register", "Drawing"], dateFields: ["expiryDate"], details: commonDetails.document, documents: true }),
  define({ key: "vehicle-inspections", label: "Vehicle Safety Inspection", singular: "Vehicle Inspection", phase: 2, description: "Inspect project and contractor vehicles and control defects.", statuses: ["Planned", "In Progress", "Defect Found", "Repair Assigned", "Verified", "Closed"], categories: ["Light Vehicle", "Heavy Vehicle", "Emergency Vehicle", "Contractor Vehicle", "Plant"], details: commonDetails.vehicle, checklist: true }),
  define({ key: "road-conditions", label: "Road Condition Report", singular: "Road Condition", phase: 2, description: "Report chainage-based road conditions and follow rectification.", statuses: ["Reported", "Assessed", "Action Assigned", "Rectified", "Verified", "Closed"], categories: ["Pothole", "Surface Damage", "Drainage", "Signage", "Lighting", "Obstruction", "Weather"], severity: true, details: commonDetails.road }),
  define({ key: "toll-incidents", label: "Toll Lane Incident", singular: "Toll Incident", phase: 2, description: "Control toll-lane events, traffic impacts, and corrective actions.", statuses: ["Reported", "Lane Secured", "Investigation", "Action Required", "Verified", "Closed"], categories: ["Collision", "Barrier Strike", "Vehicle Breakdown", "Spill", "Customer Event", "Equipment Failure"], severity: true, details: commonDetails.toll }),
  define({ key: "fire-inspections", label: "Fire Safety Inspection", singular: "Fire Inspection", phase: 2, description: "Inspect fire systems, equipment, exits, and service readiness.", statuses: ["Planned", "In Progress", "Defect Found", "Action Required", "Verified", "Closed"], categories: ["Extinguisher", "Hydrant", "Alarm", "Emergency Exit", "Suppression System", "Fire Load"], details: commonDetails.fire, checklist: true }),
  define({ key: "first-aid", label: "First Aid Register", singular: "First Aid Record", phase: 2, description: "Record first-aid treatment, referral, and follow-up.", statuses: ["Reported", "Treated", "Referred", "Follow Up", "Closed"], categories: ["Minor Injury", "Illness", "Exposure", "Burn", "Sprain", "Other"], severity: true, details: commonDetails.firstAid }),
  define({ key: "equipment-inspections", label: "Equipment Inspection", singular: "Equipment Inspection", phase: 2, description: "Inspect equipment, isolate defects, and verify repairs.", statuses: ["Planned", "In Progress", "Defect Found", "Isolated", "Repaired", "Verified", "Closed"], categories: ["Lifting", "Electrical", "Power Tool", "Plant", "Pressure System", "Access Equipment"], details: commonDetails.equipment, checklist: true }),
  define({ key: "environmental-observations", label: "Environmental Observation", singular: "Environmental Observation", phase: 2, description: "Track environmental aspects, impacts, controls, and closure.", statuses: ["Open", "Assessed", "Action Assigned", "Resolved", "Verified", "Closed"], categories: ["Air", "Water", "Noise", "Spill", "Dust", "Biodiversity", "Resource Use"], severity: true, details: commonDetails.environmental }),
  define({ key: "waste-records", label: "Waste Management", singular: "Waste Record", phase: 2, description: "Maintain waste quantities, manifests, transfer, and disposal evidence.", statuses: ["Generated", "Stored", "Collected", "Transferred", "Disposed", "Verified"], categories: ["General", "Recyclable", "Hazardous", "Electronic", "Oil", "Construction"], details: commonDetails.waste, documents: true }),
  define({ key: "compliance-calendar", label: "Compliance Calendar", singular: "Compliance Event", phase: 2, description: "Plan legal, permit, audit, certification, and reporting obligations.", statuses: ["Planned", "Due Soon", "Evidence Pending", "Completed", "Verified", "Overdue"], categories: ["Legal", "Permit", "Audit", "Inspection", "Training", "Certification", "Reporting"], dateFields: ["dueDate"], details: commonDetails.compliance, documents: true }),
  define({ key: "competency-matrix", label: "Competency Matrix", singular: "Competency Record", phase: 2, description: "Identify role competency gaps and monitor training and certificate expiry.", statuses: ["Gap Identified", "Training Planned", "In Progress", "Competent", "Expiring", "Expired"], categories: ["Induction", "Technical", "Permit", "Emergency", "First Aid", "Driving", "Leadership"], dateFields: ["expiryDate"], details: commonDetails.competency, documents: true })
];

export const ENTERPRISE_HSE_KEYS = ENTERPRISE_HSE_MODULES.map((module) => module.key);
export const getEnterpriseModule = (key) => ENTERPRISE_HSE_MODULES.find((module) => module.key === key);

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
    { key: "observations", label: "Safety Observations", icon: "observations" },
    { key: "capa", label: "CAPA", icon: "capa" },
    { key: "emergency-logs", label: "Emergency Response", icon: "emergency-logs" },
    { key: "first-aid", label: "First Aid", icon: "first-aid" }
  ] },
  { key: "assets", label: "Assets, Road & Facilities", items: [
    { key: "vehicle-inspections", label: "Vehicle Inspection", icon: "vehicle-inspections" },
    { key: "road-conditions", label: "Road Conditions", icon: "road-conditions" },
    { key: "toll-incidents", label: "Toll Lane Incidents", icon: "toll-incidents" },
    { key: "fire-inspections", label: "Fire Inspection", icon: "fire-inspections" },
    { key: "equipment-inspections", label: "Equipment Inspection", icon: "equipment-inspections" },
    { key: "ppe", label: "PPE Register", icon: "ppe" }
  ] },
  { key: "people", label: "People & Contractors", items: [
    { key: "training", label: "Training", icon: "training" },
    { key: "contractors", label: "Contractor Register", icon: "contractors" },
    { key: "competency-matrix", label: "Competency Matrix", icon: "competency-matrix" }
  ] },
  { key: "environment", label: "Environment & Compliance", items: [
    { key: "environmental-observations", label: "Environmental Observations", icon: "environmental-observations" },
    { key: "waste-records", label: "Waste Management", icon: "waste-records" },
    { key: "compliance-calendar", label: "Compliance Calendar", icon: "compliance-calendar" },
    { key: "documents", label: "Document Library", icon: "documents" }
  ] },
  { key: "analytics", label: "Analytics & Administration", items: [
    { key: "reports", label: "Reports", icon: "reports" },
    { key: "users", label: "Users", icon: "users" },
    { key: "health", label: "System Health", icon: "health" },
    { key: "settings", label: "Settings", icon: "settings" }
  ] }
];
