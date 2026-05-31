const ROLES = {
  SUPER_ADMIN: "super_admin",
  ADMIN: "admin",
  SAFETY_MANAGER: "safety_manager",
  SUPERVISOR: "supervisor",
  USER: "user",
  VIEWER: "viewer"
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

const createPermissionSet = ({ view, create, update, remove }) => ({
  view,
  create,
  update,
  delete: remove
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
      remove: false
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
      remove: false
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
      remove: false
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
      remove: false
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
      remove: false
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
  ROLE_DEFAULT_PERMISSIONS
};
