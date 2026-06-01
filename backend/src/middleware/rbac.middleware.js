const ApiError = require("../utils/api-error");
const { ROLES, normalizeRole } = require("../constants/roles");
const { canAccessModule } = require("./permission.middleware");

const authorizeRoles = (...roles) => (req, _res, next) => {
  if (!req.user) {
    next(new ApiError(401, "Unauthorized"));
    return;
  }

  const userRole = normalizeRole(req.user.role);
  const allowedRoles = roles.map(normalizeRole);
  if (!allowedRoles.includes(userRole)) {
    next(new ApiError(403, "Insufficient role permissions"));
    return;
  }
  next();
};

const authorizePermission = (moduleName, action) => (req, _res, next) => {
  if (!req.user) {
    next(new ApiError(401, "Unauthorized"));
    return;
  }

  const userRole = normalizeRole(req.user.role);
  if (userRole === ROLES.SUPER_ADMIN) {
    next();
    return;
  }

  const allowed = canAccessModule(req.user.permissions, moduleName, action);
  if (!allowed && !(userRole === ROLES.ADMIN && action === "delete" && ["work", "hazards"].includes(moduleName))) {
    next(new ApiError(403, "Permission denied for this action"));
    return;
  }

  next();
};

module.exports = {
  authorizeRoles,
  authorizePermission
};
