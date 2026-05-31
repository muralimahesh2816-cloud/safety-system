export const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SAFETY_MANAGER: "safety_manager",
  SUPERVISOR: "supervisor",
  USER: "user",
  VIEWER: "viewer"
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.ADMIN]: "Admin",
  [ROLES.SAFETY_MANAGER]: "Safety Manager",
  [ROLES.SUPERVISOR]: "Supervisor",
  [ROLES.USER]: "User",
  [ROLES.VIEWER]: "Viewer"
};

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
