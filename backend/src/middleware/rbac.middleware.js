const ApiError = require("../utils/api-error");
const { canAccessModule } = require("./permission.middleware");

const authorizeRoles = (...roles) => (req, _res, next) => {
  if (!req.user) {
    next(new ApiError(401, "Unauthorized"));
    return;
  }

  if (!roles.includes(req.user.role)) {
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

  if (req.user.role === "super_admin") {
    next();
    return;
  }

  const allowed = canAccessModule(req.user.permissions, moduleName, action);
  if (!allowed) {
    next(new ApiError(403, "Permission denied for this action"));
    return;
  }

  next();
};

module.exports = {
  authorizeRoles,
  authorizePermission
};
