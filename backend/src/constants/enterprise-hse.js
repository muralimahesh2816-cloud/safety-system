const defineModule = ({
  key,
  slug,
  label,
  singular,
  prefix,
  collection,
  phase,
  statuses,
  required = ["title", "site"],
  dateField = "businessDate",
  categories = [],
  severities = ["Low", "Medium", "High", "Critical"],
  aliases = []
}) => ({
  key,
  slug,
  label,
  singular,
  prefix,
  collection,
  phase,
  statuses,
  required,
  dateField,
  categories,
  severities,
  aliases
});

const ENTERPRISE_HSE_MODULES = [
  defineModule({
    key: "incidents", slug: "incidents", label: "Incident Management", singular: "Incident",
    prefix: "INC", collection: "hse_incidents", phase: 1,
    statuses: ["Reported", "Initial Review", "Investigation", "Corrective Action", "Verification", "Closed"],
    required: ["title", "site", "category", "severity", "businessDate", "description"],
    categories: ["Injury", "Property Damage", "Environmental", "Fire", "Vehicle", "Security", "Other"]
  }),
  defineModule({
    key: "observations", slug: "observations", label: "Safety Observations", singular: "Observation",
    prefix: "OBS", collection: "hse_observations", phase: 1,
    statuses: ["Open", "Assigned", "In Progress", "Resolved", "Verified", "Closed"],
    required: ["title", "site", "category", "severity", "businessDate", "description"],
    categories: ["Safe Act", "Unsafe Act", "Unsafe Condition", "Positive Practice", "Housekeeping", "PPE"],
    aliases: ["safety-observations"]
  }),
  defineModule({
    key: "capa", slug: "capa", label: "CAPA", singular: "Corrective Action",
    prefix: "CAP", collection: "hse_capa", phase: 1,
    statuses: ["Open", "Assigned", "In Progress", "Pending Verification", "Verified", "Closed", "Overdue"],
    required: ["title", "site", "priority", "dueDate", "description"],
    dateField: "dueDate",
    categories: ["Corrective", "Preventive", "Audit Finding", "Incident", "Observation", "Inspection"]
  }),
  defineModule({
    key: "permits", slug: "permits", label: "Permit to Work", singular: "Permit",
    prefix: "PTW", collection: "hse_permits", phase: 1,
    statuses: ["Draft", "Submitted", "Safety Review", "Final Approval", "Active", "Suspended", "Closed", "Cancelled"],
    required: ["title", "site", "category", "startDate", "expiryDate", "description"],
    dateField: "startDate",
    categories: ["Hot Work", "Height Work", "Confined Space", "Electrical Isolation", "Excavation", "Lifting", "Road Work", "General"]
  }),
  defineModule({
    key: "inspections", slug: "inspections", label: "Safety Inspections", singular: "Inspection",
    prefix: "INS", collection: "hse_inspections", phase: 1,
    statuses: ["Planned", "In Progress", "Submitted", "Action Required", "Verified", "Closed"],
    required: ["title", "site", "category", "businessDate"],
    categories: ["Site", "Facility", "Electrical", "Fire", "PPE", "Housekeeping", "Traffic Management"]
  }),
  defineModule({
    key: "toolbox-talks", slug: "toolbox-talks", label: "Toolbox Talks", singular: "Toolbox Talk",
    prefix: "TBT", collection: "hse_toolbox_talks", phase: 1,
    statuses: ["Scheduled", "Conducted", "Attendance Verified", "Closed"],
    required: ["title", "site", "businessDate", "description"],
    categories: ["Daily Briefing", "High-Risk Work", "Weather", "Traffic", "Emergency", "Lessons Learned"]
  }),
  defineModule({
    key: "ppe", slug: "ppe", label: "PPE Register", singular: "PPE Record",
    prefix: "PPE", collection: "hse_ppe_register", phase: 1,
    statuses: ["In Stock", "Issued", "Due for Inspection", "Damaged", "Returned", "Disposed"],
    required: ["title", "site", "category", "businessDate"],
    categories: ["Helmet", "Safety Shoes", "Gloves", "Eye Protection", "Hearing Protection", "Harness", "Respiratory"]
  }),
  defineModule({
    key: "contractors", slug: "contractors", label: "Contractor Register", singular: "Contractor",
    prefix: "CTR", collection: "hse_contractors", phase: 1,
    statuses: ["Prequalified", "Pending Documents", "Approved", "Suspended", "Expired", "Closed"],
    required: ["title", "site", "category", "expiryDate"],
    dateField: "expiryDate",
    categories: ["Civil", "Electrical", "Mechanical", "Maintenance", "Security", "Transport", "Specialist"]
  }),
  defineModule({
    key: "emergency-logs", slug: "emergency-logs", label: "Emergency Response Log", singular: "Emergency Log",
    prefix: "ERL", collection: "hse_emergency_logs", phase: 1,
    statuses: ["Activated", "Responding", "Under Control", "Stand Down", "Debriefed", "Closed"],
    required: ["title", "site", "category", "severity", "businessDate", "description"],
    categories: ["Fire", "Medical", "Chemical Spill", "Vehicle", "Security", "Natural Event", "Evacuation"],
    aliases: ["emergency-response"]
  }),
  defineModule({
    key: "documents", slug: "documents", label: "Document Library", singular: "Document",
    prefix: "DOC", collection: "hse_documents", phase: 1,
    statuses: ["Draft", "Under Review", "Approved", "Published", "Archived"],
    required: ["title", "category", "expiryDate"],
    dateField: "expiryDate",
    categories: ["Policy", "Procedure", "SOP", "Checklist", "Form", "Standard", "Legal Register", "Drawing"]
  }),
  defineModule({
    key: "vehicle-inspections", slug: "vehicle-inspections", label: "Vehicle Safety Inspection", singular: "Vehicle Inspection",
    prefix: "VEH", collection: "hse_vehicle_inspections", phase: 2,
    statuses: ["Planned", "In Progress", "Defect Found", "Repair Assigned", "Verified", "Closed"],
    required: ["title", "site", "businessDate", "category"],
    categories: ["Light Vehicle", "Heavy Vehicle", "Emergency Vehicle", "Contractor Vehicle", "Plant"]
  }),
  defineModule({
    key: "road-conditions", slug: "road-conditions", label: "Road Condition Report", singular: "Road Condition",
    prefix: "RCD", collection: "hse_road_conditions", phase: 2,
    statuses: ["Reported", "Assessed", "Action Assigned", "Rectified", "Verified", "Closed"],
    required: ["title", "site", "severity", "businessDate", "description"],
    categories: ["Pothole", "Surface Damage", "Drainage", "Signage", "Lighting", "Obstruction", "Weather"]
  }),
  defineModule({
    key: "toll-incidents", slug: "toll-incidents", label: "Toll Lane Incident", singular: "Toll Incident",
    prefix: "TLI", collection: "hse_toll_incidents", phase: 2,
    statuses: ["Reported", "Lane Secured", "Investigation", "Action Required", "Verified", "Closed"],
    required: ["title", "site", "category", "severity", "businessDate", "description"],
    categories: ["Collision", "Barrier Strike", "Vehicle Breakdown", "Spill", "Customer Event", "Equipment Failure"]
  }),
  defineModule({
    key: "fire-inspections", slug: "fire-inspections", label: "Fire Safety Inspection", singular: "Fire Inspection",
    prefix: "FIR", collection: "hse_fire_inspections", phase: 2,
    statuses: ["Planned", "In Progress", "Defect Found", "Action Required", "Verified", "Closed"],
    required: ["title", "site", "businessDate", "category"],
    categories: ["Extinguisher", "Hydrant", "Alarm", "Emergency Exit", "Suppression System", "Fire Load"]
  }),
  defineModule({
    key: "first-aid", slug: "first-aid", label: "First Aid Register", singular: "First Aid Record",
    prefix: "FAI", collection: "hse_first_aid", phase: 2,
    statuses: ["Reported", "Treated", "Referred", "Follow Up", "Closed"],
    required: ["title", "site", "businessDate", "description"],
    categories: ["Minor Injury", "Illness", "Exposure", "Burn", "Sprain", "Other"]
  }),
  defineModule({
    key: "equipment-inspections", slug: "equipment-inspections", label: "Equipment Inspection", singular: "Equipment Inspection",
    prefix: "EQI", collection: "hse_equipment_inspections", phase: 2,
    statuses: ["Planned", "In Progress", "Defect Found", "Isolated", "Repaired", "Verified", "Closed"],
    required: ["title", "site", "category", "businessDate"],
    categories: ["Lifting", "Electrical", "Power Tool", "Plant", "Pressure System", "Access Equipment"]
  }),
  defineModule({
    key: "environmental-observations", slug: "environmental-observations", label: "Environmental Observation", singular: "Environmental Observation",
    prefix: "ENV", collection: "hse_environmental_observations", phase: 2,
    statuses: ["Open", "Assessed", "Action Assigned", "Resolved", "Verified", "Closed"],
    required: ["title", "site", "category", "severity", "businessDate", "description"],
    categories: ["Air", "Water", "Noise", "Spill", "Dust", "Biodiversity", "Resource Use"]
  }),
  defineModule({
    key: "waste-records", slug: "waste-records", label: "Waste Management", singular: "Waste Record",
    prefix: "WST", collection: "hse_waste_records", phase: 2,
    statuses: ["Generated", "Stored", "Collected", "Transferred", "Disposed", "Verified"],
    required: ["title", "site", "category", "businessDate"],
    categories: ["General", "Recyclable", "Hazardous", "Electronic", "Oil", "Construction"]
  }),
  defineModule({
    key: "compliance-calendar", slug: "compliance-calendar", label: "Compliance Calendar", singular: "Compliance Event",
    prefix: "CMP", collection: "hse_compliance_calendar", phase: 2,
    statuses: ["Planned", "Due Soon", "Evidence Pending", "Completed", "Verified", "Overdue"],
    required: ["title", "category", "dueDate"],
    dateField: "dueDate",
    categories: ["Legal", "Permit", "Audit", "Inspection", "Training", "Certification", "Reporting"]
  }),
  defineModule({
    key: "competency-matrix", slug: "competency-matrix", label: "Competency Matrix", singular: "Competency Record",
    prefix: "COM", collection: "hse_competency_matrix", phase: 2,
    statuses: ["Gap Identified", "Training Planned", "In Progress", "Competent", "Expiring", "Expired"],
    required: ["title", "category", "assignedTo", "expiryDate"],
    dateField: "expiryDate",
    categories: ["Induction", "Technical", "Permit", "Emergency", "First Aid", "Driving", "Leadership"]
  })
];

const ENTERPRISE_HSE_KEYS = ENTERPRISE_HSE_MODULES.map((module) => module.key);
const findHseModule = (value = "") => ENTERPRISE_HSE_MODULES.find((module) =>
  module.key === value || module.slug === value || module.aliases.includes(value)
);

const canTransition = (module, currentStatus, nextStatus) => {
  if (!module || !module.statuses.includes(nextStatus) || currentStatus === nextStatus) return false;
  if (nextStatus === "Overdue") return false;
  if (currentStatus === "Overdue") {
    if (module.key === "capa") return ["In Progress", "Pending Verification"].includes(nextStatus);
    if (module.key === "compliance-calendar") return ["Evidence Pending", "Completed"].includes(nextStatus);
  }
  if (module.key === "permits") {
    if (currentStatus === "Active" && ["Suspended", "Closed", "Cancelled"].includes(nextStatus)) return true;
    if (currentStatus === "Suspended" && ["Active", "Closed", "Cancelled"].includes(nextStatus)) return true;
    if (nextStatus === "Cancelled" && !["Closed", "Cancelled"].includes(currentStatus)) return true;
  }
  const currentIndex = module.statuses.indexOf(currentStatus);
  const nextIndex = module.statuses.indexOf(nextStatus);
  return currentIndex >= 0 && nextIndex === currentIndex + 1;
};

module.exports = {
  ENTERPRISE_HSE_MODULES,
  ENTERPRISE_HSE_KEYS,
  findHseModule,
  canTransition
};
