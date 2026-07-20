const ROLES = {
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

const ROLE_ALIASES = {
  super_admin: ROLES.SUPER_ADMIN,
  superadmin: ROLES.SUPER_ADMIN,
  "super admin": ROLES.SUPER_ADMIN,
  admin: ROLES.ADMIN,
  administrator: ROLES.ADMIN,
  employee: ROLES.EMPLOYEE,
  worker: ROLES.EMPLOYEE,
  user: ROLES.USER,
  viewer: ROLES.VIEWER,
  safety_officer: ROLES.SAFETY_OFFICER,
  "safety officer": ROLES.SAFETY_OFFICER,
  safety_engineer: ROLES.SAFETY_ENGINEER,
  "safety engineer": ROLES.SAFETY_ENGINEER,
  site_engineer: ROLES.SITE_ENGINEER,
  "site engineer": ROLES.SITE_ENGINEER,
  project_engineer: ROLES.PROJECT_ENGINEER,
  "project engineer": ROLES.PROJECT_ENGINEER,
  maintenance_engineer: ROLES.MAINTENANCE_ENGINEER,
  "maintenance engineer": ROLES.MAINTENANCE_ENGINEER,
  project_manager: ROLES.PROJECT_MANAGER,
  "project manager": ROLES.PROJECT_MANAGER,
  project_manger: ROLES.PROJECT_MANAGER,
  "project manger": ROLES.PROJECT_MANAGER,
  construction_manager: ROLES.CONSTRUCTION_MANAGER,
  "construction manager": ROLES.CONSTRUCTION_MANAGER,
  operations_manager: ROLES.OPERATIONS_MANAGER,
  "operations manager": ROLES.OPERATIONS_MANAGER,
  maintenance_manager: ROLES.MAINTENANCE_MANAGER,
  "maintenance manager": ROLES.MAINTENANCE_MANAGER,
  maintance_manager: ROLES.MAINTENANCE_MANAGER,
  "maintance manager": ROLES.MAINTENANCE_MANAGER,
  maintainance_manager: ROLES.MAINTENANCE_MANAGER,
  "maintainance manager": ROLES.MAINTENANCE_MANAGER,
  safety_manager: ROLES.SAFETY_MANAGER,
  "safety manager": ROLES.SAFETY_MANAGER,
  safety_manger: ROLES.SAFETY_MANAGER,
  "safety manger": ROLES.SAFETY_MANAGER,
  supervisor: ROLES.SUPERVISOR
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

const getRoleQueryValues = (roles = []) => {
  const normalizedRoles = new Set(roles.map((role) => normalizeRole(role)));
  return [...new Set([
    ...normalizedRoles,
    ...Object.entries(ROLE_ALIASES)
      .filter(([, canonical]) => normalizedRoles.has(canonical))
      .map(([alias]) => alias)
  ])];
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

const emptyWorkPermissions = () =>
  createPermissionSet({
    view: true,
    create: false,
    update: false,
    remove: false,
    check: false,
    recommend: false,
    approve: false,
    complete: false,
    return: false
  });

const workPermissions = (overrides = {}) => ({
  ...emptyWorkPermissions(),
  ...overrides
});

const readOnly = () =>
  createPermissionSet({
    view: true,
    create: false,
    update: false,
    remove: false
  });

const noAccess = () =>
  createPermissionSet({
    view: false,
    create: false,
    update: false,
    remove: false
  });

const operate = () =>
  createPermissionSet({
    view: true,
    create: true,
    update: true,
    remove: false
  });

const manage = () =>
  createPermissionSet({
    view: true,
    create: true,
    update: true,
    remove: true
  });

const basePermissions = ({
  users = noAccess(),
  work = workPermissions({ create: true }),
  hazards = operate(),
  training = readOnly(),
  reports = noAccess(),
  settings = noAccess(),
  notifications = readOnly()
} = {}) => ({
  dashboard: readOnly(),
  users,
  work,
  hazards,
  training,
  reports,
  settings,
  notifications
});

const checkerWork = () =>
  workPermissions({
    create: true,
    update: false,
    check: true,
    return: true
  });

const recommenderWork = () =>
  workPermissions({
    create: true,
    update: true,
    recommend: true,
    return: true
  });

const approverWork = (extra = {}) =>
  workPermissions({
    create: true,
    update: true,
    approve: true,
    return: true,
    ...extra
  });

const ROLE_DEFAULT_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: MODULES.reduce((acc, moduleName) => {
    acc[moduleName] = createPermissionSet({
      view: true,
      create: true,
      update: true,
      remove: true,
      check: true,
      recommend: true,
      approve: true,
      complete: true,
      return: true
    });
    return acc;
  }, {}),
  [ROLES.ADMIN]: basePermissions({
    users: manage(),
    work: workPermissions({ create: true, update: true, remove: true }),
    hazards: manage(),
    training: manage(),
    reports: readOnly(),
    settings: createPermissionSet({
      view: true,
      create: false,
      update: true,
      remove: false
    }),
    notifications: operate()
  }),
  [ROLES.EMPLOYEE]: basePermissions(),
  [ROLES.USER]: basePermissions(),
  [ROLES.VIEWER]: basePermissions({
    work: emptyWorkPermissions(),
    hazards: readOnly(),
    training: readOnly(),
    reports: readOnly()
  }),
  [ROLES.SAFETY_OFFICER]: basePermissions({ work: checkerWork() }),
  [ROLES.SAFETY_ENGINEER]: basePermissions({ work: checkerWork() }),
  [ROLES.SITE_ENGINEER]: basePermissions({ work: checkerWork() }),
  [ROLES.PROJECT_ENGINEER]: basePermissions({ work: checkerWork() }),
  [ROLES.MAINTENANCE_ENGINEER]: basePermissions({ work: checkerWork() }),
  [ROLES.PROJECT_MANAGER]: basePermissions({
    work: approverWork()
  }),
  [ROLES.CONSTRUCTION_MANAGER]: basePermissions(),
  [ROLES.OPERATIONS_MANAGER]: basePermissions(),
  [ROLES.MAINTENANCE_MANAGER]: basePermissions({
    work: approverWork()
  }),
  [ROLES.SAFETY_MANAGER]: basePermissions({
    work: recommenderWork(),
    training: manage()
  }),
  [ROLES.SUPERVISOR]: basePermissions()
};

module.exports = {
  ROLES,
  MODULES,
  ROLE_DEFAULT_PERMISSIONS,
  normalizeRole,
  getRoleQueryValues
};
