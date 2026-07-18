const { ROLES, ROLE_DEFAULT_PERMISSIONS, normalizeRole } = require("../constants/roles");

const PAGE_KEYS = [
  "dashboard",
  "work",
  "hazard",
  "training",
  "reports",
  "users",
  "settings"
];

const normalizeModuleKey = (moduleName = "") => {
  if (moduleName === "hazards") return "hazard";
  return moduleName;
};

const getModuleCandidates = (moduleName = "") => {
  const normalized = normalizeModuleKey(moduleName);
  if (normalized === "hazard") return ["hazard", "hazards"];
  return [normalized];
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

const allTruePermissions = () =>
  PAGE_KEYS.reduce((acc, key) => {
    acc[key] = true;
    return acc;
  }, {});

const roleDefaultsFromLegacy = (role = ROLES.USER) => {
  const resolvedRole = normalizeRole(role);
  if (resolvedRole === ROLES.SUPER_ADMIN || resolvedRole === ROLES.ADMIN) {
    return allTruePermissions();
  }

  const defaults = PAGE_KEYS.reduce((acc, key) => {
    acc[key] = false;
    return acc;
  }, {});

  const legacy = ROLE_DEFAULT_PERMISSIONS[resolvedRole] || ROLE_DEFAULT_PERMISSIONS[ROLES.USER] || {};
  PAGE_KEYS.forEach((key) => {
    const legacyKey = key === "hazard" ? "hazards" : key;
    defaults[key] = Boolean(legacy?.[legacyKey]?.view);
  });
  return defaults;
};

const normalizePagePermissions = (permissions = {}, role = ROLES.USER) => {
  const resolvedRole = normalizeRole(role);
  const normalized = roleDefaultsFromLegacy(resolvedRole);
  if (!permissions || typeof permissions !== "object") {
    return normalized;
  }

  PAGE_KEYS.forEach((key) => {
    const candidateKeys = getModuleCandidates(key);
    for (let index = 0; index < candidateKeys.length; index += 1) {
      const raw = permissions[candidateKeys[index]];
      const value = toBooleanPermission(raw);
      if (typeof value === "boolean") {
        normalized[key] = value;
        break;
      }
    }
  });

  if (resolvedRole === ROLES.SUPER_ADMIN) {
    return allTruePermissions();
  }

  return normalized;
};

const toActionPermissions = (permissions = {}, role = ROLES.USER) => {
  const resolvedRole = normalizeRole(role);
  const legacyDefaults = ROLE_DEFAULT_PERMISSIONS[resolvedRole] || ROLE_DEFAULT_PERMISSIONS[ROLES.USER] || {};
  const actionKeys = ["view", "create", "update", "delete", "check", "approve", "complete", "return"];
  const modules = {
    dashboard: "dashboard",
    work: "work",
    hazards: "hazard",
    training: "training",
    reports: "reports",
    users: "users",
    settings: "settings",
    notifications: "notifications"
  };

  const resolved = Object.entries(modules).reduce((acc, [moduleName, pageKey]) => {
    const legacyEntry = legacyDefaults[moduleName] || {};
    acc[moduleName] = actionKeys.reduce((moduleAcc, action) => {
      moduleAcc[action] = Boolean(legacyEntry[action]);
      return moduleAcc;
    }, {});

    const candidateKeys =
      pageKey === "hazard" ? ["hazard", "hazards"] : [pageKey];

    for (let index = 0; index < candidateKeys.length; index += 1) {
      const raw = permissions[candidateKeys[index]];
      if (typeof raw === "boolean") {
        if (!raw) {
          acc[moduleName] = actionKeys.reduce((moduleAcc, action) => {
            moduleAcc[action] = false;
            return moduleAcc;
          }, {});
        } else {
          acc[moduleName] = actionKeys.reduce((moduleAcc, action) => {
            moduleAcc[action] = action === "view" ? true : Boolean(legacyEntry[action]);
            return moduleAcc;
          }, {});
        }
        break;
      }
      if (raw && typeof raw === "object") {
        actionKeys.forEach((action) => {
          if (typeof raw[action] === "boolean") {
            acc[moduleName][action] = raw[action];
          }
        });
        break;
      }
    }
    return acc;
  }, {});

  if (resolvedRole === ROLES.SUPER_ADMIN) {
    Object.keys(resolved).forEach((moduleName) => {
      resolved[moduleName] = actionKeys.reduce((moduleAcc, action) => {
        moduleAcc[action] = true;
        return moduleAcc;
      }, {});
    });
  }

  return resolved;
};

const canAccessModule = (permissions = {}, moduleName, action = "view") => {
  if (!permissions || !moduleName) return false;

  const candidateKeys = getModuleCandidates(moduleName);
  for (let index = 0; index < candidateKeys.length; index += 1) {
    const entry = permissions[candidateKeys[index]];
    if (typeof entry === "boolean") {
      return entry;
    }
    if (entry && typeof entry === "object") {
      if (typeof entry[action] === "boolean") return entry[action];
      if (typeof entry.view === "boolean") return entry.view;
    }
  }

  return false;
};

module.exports = {
  PAGE_KEYS,
  normalizeModuleKey,
  normalizePagePermissions,
  toActionPermissions,
  canAccessModule,
  roleDefaultsFromLegacy
};
