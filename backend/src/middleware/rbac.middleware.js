const ApiError = require("../utils/api-error");
const { ROLES, normalizeRole } = require("../constants/roles");
const { canAccessModule } = require("./permission.middleware");
const logger = require("../utils/logger");

const authorizeRoles = (...roles) => (req, _res, next) => {
  if (!req.user) {
    next(new ApiError(401, "Authentication required", null, "AUTH_REQUIRED"));
    return;
  }

  const userRole = normalizeRole(req.user.role);
  const allowedRoles = roles.map(normalizeRole);
  if (!allowedRoles.includes(userRole)) {
    logger.warn("Role denied", {
      route: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      role: userRole,
      allowedRoles
    });
    next(new ApiError(403, "You do not have permission to perform this action", null, "ROLE_DENIED"));
    return;
  }
  next();
};

const authorizePermission = (moduleName, action) => (req, _res, next) => {
  if (!req.user) {
    next(new ApiError(401, "Authentication required", null, "AUTH_REQUIRED"));
    return;
  }

  const userRole = normalizeRole(req.user.role);
  if (userRole === ROLES.SUPER_ADMIN) {
    next();
    return;
  }

  const allowed = canAccessModule(req.user.permissions, moduleName, action);
  if (!allowed && !(userRole === ROLES.ADMIN && action === "delete" && ["work", "hazards"].includes(moduleName))) {
    logger.warn("Permission denied", {
      route: req.originalUrl,
      method: req.method,
      userId: req.user?.id,
      role: userRole,
      permission: `${moduleName}.${action}`
    });
    next(new ApiError(403, "You do not have permission to perform this action", null, "PERMISSION_DENIED"));
    return;
  }

  next();
};

module.exports = {
  authorizeRoles,
  authorizePermission
};
