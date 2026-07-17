export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  EMPLOYEE: "employee",
  USER: "user",
  VIEWER: "viewer",
  SAFETY_OFFICER: "safety_officer",
  SAFETY_ENGINEER: "safety_engineer",
  SITE_ENGINEER: "site_engineer",
  PROJECT_ENGINEER: "project_engineer",
  MAINTENANCE_ENGINEER: "maintenance_engineer",
  PROJECT_MANAGER: "project_manager",
  CONSTRUCTION_MANAGER: "construction_manager",
  OPERATIONS_MANAGER: "operations_manager",
  MAINTENANCE_MANAGER: "maintenance_manager",
  SAFETY_MANAGER: "safety_manager",
  SUPERVISOR: "supervisor"
};

export const ROLE_LABELS = {
  [ROLES.EMPLOYEE]: "Employee",
  [ROLES.USER]: "User",
  [ROLES.VIEWER]: "Viewer",
  [ROLES.ADMIN]: "Admin",
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.SAFETY_OFFICER]: "Safety Officer",
  [ROLES.SAFETY_ENGINEER]: "Safety Engineer",
  [ROLES.SITE_ENGINEER]: "Site Engineer",
  [ROLES.PROJECT_ENGINEER]: "Project Engineer",
  [ROLES.MAINTENANCE_ENGINEER]: "Maintenance Engineer",
  [ROLES.PROJECT_MANAGER]: "Project Manager",
  [ROLES.CONSTRUCTION_MANAGER]: "Construction Manager",
  [ROLES.OPERATIONS_MANAGER]: "Operations Manager",
  [ROLES.MAINTENANCE_MANAGER]: "Maintenance Manager",
  [ROLES.SAFETY_MANAGER]: "Safety Manager",
  [ROLES.SUPERVISOR]: "Supervisor (Legacy)"
};

export const ROLE_GROUPS = [
  {
    label: "General Roles",
    roles: [ROLES.EMPLOYEE, ROLES.USER, ROLES.VIEWER, ROLES.ADMIN, ROLES.SUPER_ADMIN]
  },
  {
    label: "Checking Roles",
    roles: [
      ROLES.SAFETY_OFFICER,
      ROLES.SAFETY_ENGINEER,
      ROLES.SITE_ENGINEER,
      ROLES.PROJECT_ENGINEER,
      ROLES.MAINTENANCE_ENGINEER
    ]
  },
  {
    label: "Recommending Roles",
    roles: [
      ROLES.PROJECT_MANAGER,
      ROLES.CONSTRUCTION_MANAGER,
      ROLES.OPERATIONS_MANAGER,
      ROLES.MAINTENANCE_MANAGER,
      ROLES.SAFETY_MANAGER
    ]
  }
];

export const MODULE_PERMISSIONS = {
  dashboard: "view",
  users: "view",
  work: "view",
  hazards: "view",
  training: "view",
  reports: "view",
  settings: "view",
  notifications: "view"
};
