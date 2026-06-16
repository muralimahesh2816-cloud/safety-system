const allPermissions = {
  dashboard: true,
  work: true,
  hazards: true,
  hazard: true,
  training: true,
  reports: true,
  users: true,
  settings: true,
  notifications: true
};

const employeePermissions = {
  dashboard: true,
  work: true,
  hazards: true,
  hazard: true,
  training: true,
  reports: false,
  users: false,
  settings: true,
  notifications: true
};

const supervisorPermissions = {
  ...employeePermissions,
  reports: true
};

export const normalizeRole = (role = "") => String(role || "").toLowerCase().replace(/\s+/g, "_");

export const normalizePermissions = (permissions = {}, role = "") => {
  const normalizedRole = normalizeRole(role);
  if (["super_admin", "admin"].includes(normalizedRole)) return allPermissions;
  const base =
    normalizedRole === "supervisor" || normalizedRole === "safety_manager"
      ? supervisorPermissions
      : employeePermissions;
  return {
    ...base,
    ...(permissions || {}),
    hazards: permissions?.hazards ?? permissions?.hazard ?? base.hazards,
    hazard: permissions?.hazard ?? permissions?.hazards ?? base.hazard
  };
};

export const canAccess = (user, key) => {
  if (!user) return false;
  const role = normalizeRole(user.role);
  if (["super_admin", "admin"].includes(role)) return true;
  const permissions = normalizePermissions(user.permissions, role);
  if (key === "hazards") return Boolean(permissions.hazards || permissions.hazard);
  if (key === "hazard") return Boolean(permissions.hazard || permissions.hazards);
  return Boolean(permissions[key]);
};

export const canManage = (user) =>
  ["super_admin", "admin", "supervisor", "safety_manager"].includes(normalizeRole(user?.role));

export const canAdmin = (user) => ["super_admin", "admin"].includes(normalizeRole(user?.role));
