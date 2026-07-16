const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SAFETY_MANAGER: "safety_manager",
  SUPERVISOR: "supervisor",
  USER: "user",
  VIEWER: "viewer"
};

const ROLE_ALIASES = {
  super_admin: ROLES.SUPER_ADMIN,
  superadmin: ROLES.SUPER_ADMIN,
  "super admin": ROLES.SUPER_ADMIN,
  admin: ROLES.ADMIN,
  administrator: ROLES.ADMIN,
  safety_manager: ROLES.SAFETY_MANAGER,
  "safety manager": ROLES.SAFETY_MANAGER,
  supervisor: ROLES.SUPERVISOR,
  user: ROLES.USER,
  viewer: ROLES.VIEWER
};

const normalizeRole = (role = ROLES.USER) => {
  const normalized = String(role || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/\s+/g, " ");
  const snakeCase = normalized.replace(/\s+/g, "_");
  return ROLE_ALIASES[normalized] || ROLE_ALIASES[snakeCase] || ROLES.USER;
};

const MODULES = [
  "dashboard",
  "users",
  "work",
  "hazards",
  "training",
  "reports",
  "settings",
  "notifications"
];

const createPermissionSet = ({ view, create, update, remove, ...extra }) => ({
  view,
  create,
  update,
  delete: remove,
  ...extra
});

const ROLE_DEFAULT_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: MODULES.reduce((acc, moduleName) => {
    acc[moduleName] = createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: true
    });
    return acc;
  }, {}),
  [ROLES.ADMIN]: {
    dashboard: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    users: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: true
    }),
    work: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: true,
      check: true,
      recommend: true,
      approve: true,
      complete: true,
      return: true
    }),
    hazards: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: true
    }),
    training: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: true
    }),
    reports: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    settings: createPermissionSet({
      view: true,
      create: false,
      update: true,
      remove: false
    }),
    notifications: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: false
    })
  },
  [ROLES.SAFETY_MANAGER]: {
    dashboard: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    users: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    work: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: false,
      check: true,
      recommend: true,
      approve: false,
      complete: true,
      return: true
    }),
    hazards: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: false
    }),
    training: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: false
    }),
    reports: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    settings: createPermissionSet({
      view: false,
      create: false,
      update: false,
      remove: false
    }),
    notifications: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: false
    })
  },
  [ROLES.SUPERVISOR]: {
    dashboard: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    users: createPermissionSet({
      view: false,
      create: false,
      update: false,
      remove: false
    }),
    work: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: false,
      check: true,
      recommend: false,
      approve: false,
      complete: true,
      return: true
    }),
    hazards: createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: false
    }),
    training: createPermissionSet({
      view: true,
      create: false,
      update: true,
      remove: false
    }),
    reports: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    settings: createPermissionSet({
      view: false,
      create: false,
      update: false,
      remove: false
    }),
    notifications: createPermissionSet({
      view: true,
      create: false,
      update: true,
      remove: false
    })
  },
  [ROLES.USER]: {
    dashboard: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    users: createPermissionSet({
      view: false,
      create: false,
      update: false,
      remove: false
    }),
    work: createPermissionSet({
      view: true,
      create: true,
      update: false,
      remove: false,
      check: false,
      recommend: false,
      approve: false,
      complete: false,
      return: false
    }),
    hazards: createPermissionSet({
      view: true,
      create: true,
      update: false,
      remove: false
    }),
    training: createPermissionSet({
      view: true,
      create: false,
      update: true,
      remove: false
    }),
    reports: createPermissionSet({
      view: false,
      create: false,
      update: false,
      remove: false
    }),
    settings: createPermissionSet({
      view: false,
      create: false,
      update: false,
      remove: false
    }),
    notifications: createPermissionSet({
      view: true,
      create: false,
      update: true,
      remove: false
    })
  },
  [ROLES.VIEWER]: {
    dashboard: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    users: createPermissionSet({
      view: false,
      create: false,
      update: false,
      remove: false
    }),
    work: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false,
      check: false,
      recommend: false,
      approve: false,
      complete: false,
      return: false
    }),
    hazards: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    training: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    reports: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    }),
    settings: createPermissionSet({
      view: false,
      create: false,
      update: false,
      remove: false
    }),
    notifications: createPermissionSet({
      view: true,
      create: false,
      update: false,
      remove: false
    })
  }
};

module.exports = {
  ROLES,
  MODULES,
  ROLE_DEFAULT_PERMISSIONS,
  normalizeRole
};
