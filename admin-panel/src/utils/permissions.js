const ACCESS_MODULES = ["dashboard", "work", "hazard", "training", "reports", "users", "settings"];

const DEFAULT_ROLE_PERMISSIONS = {
  super_admin: {
    dashboard: true,
    work: true,
    hazard: true,
    training: true,
    reports: true,
    users: true,
    settings: true
  },
  admin: {
    dashboard: true,
    work: true,
    hazard: true,
    training: true,
    reports: true,
    users: true,
    settings: true
  },
  safety_manager: {
    dashboard: true,
    work: true,
    hazard: true,
    training: true,
    reports: true,
    users: true,
    settings: false
  },
  supervisor: {
    dashboard: true,
    work: true,
    hazard: true,
    training: true,
    reports: true,
    users: false,
    settings: false
  },
  viewer: {
    dashboard: true,
    work: true,
    hazard: true,
    training: true,
    reports: true,
    users: false,
    settings: false
  },
  user: {
    dashboard: true,
    work: true,
    hazard: true,
    training: true,
    reports: false,
    users: false,
    settings: false
  }
};

const moduleAliases = {
  hazard: "hazard",
  hazards: "hazard",
  work: "work",
  dashboard: "dashboard",
  training: "training",
  reports: "reports",
  users: "users",
  settings: "settings"
};

const emptyPermissions = () =>
  ACCESS_MODULES.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

const getDefaultPermissionsForRole = (role = "user") => {
  const defaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.user;
  return { ...emptyPermissions(), ...defaults };
};

const toBooleanPermission = (value) => {
  if (typeof value === "boolean") return value;
  if (value && typeof value === "object") {
    if (typeof value.view === "boolean") return value.view;
    if (typeof value.access === "boolean") return value.access;
    if (typeof value.read === "boolean") return value.read;
  }
  return undefined;
};

export const normalizePermissions = (permissions, role = "user") => {
  const normalized = getDefaultPermissionsForRole(role);
  if (!permissions || typeof permissions !== "object") {
    return normalized;
  }

  Object.entries(permissions).forEach(([moduleName, value]) => {
    const key = moduleAliases[moduleName];
    if (!key) return;
    const boolValue = toBooleanPermission(value);
    if (typeof boolValue === "boolean") normalized[key] = boolValue;
  });

  if (role === "super_admin") {
    return getDefaultPermissionsForRole("super_admin");
  }

  return normalized;
};

export const normalizeUserPermissions = (user) =>
  normalizePermissions(user?.permissions || {}, user?.role || "user");

export const canAccessModule = (user, moduleKey) => {
  if (user?.role === "super_admin") return true;
  const normalized = normalizeUserPermissions(user);
  const key = moduleAliases[moduleKey] || moduleKey;
  return Boolean(normalized[key]);
};

export const toPermissionPayload = (permissions = {}) =>
  ACCESS_MODULES.reduce((acc, key) => {
    acc[key] = Boolean(permissions[key]);
    return acc;
  }, {});

export { ACCESS_MODULES };

