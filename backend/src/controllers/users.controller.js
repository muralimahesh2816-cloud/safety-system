const ApiError = require("../utils/api-error");
const User = require("../models/User");
const { ROLES } = require("../constants/roles");
const { normalizePagePermissions } = require("../middleware/permission.middleware");
const audit = require("../middleware/audit.middleware");

const updateUserPermissions = async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (user.role === ROLES.SUPER_ADMIN && req.user.role !== ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "Only Super Admin can modify Super Admin permissions", null, "PERMISSION_DENIED");
  }

  const payload = req.body?.permissions || req.body || {};
  const normalizedPermissions = normalizePagePermissions(payload, user.role);
  user.permissions = normalizedPermissions;
  await user.save();
  const sanitizedUser = await User.findById(req.params.id).select("-password");
  await audit(req, "update_permissions", "users", { permissions: normalizedPermissions }, sanitizedUser?._id);

  res.json({
    success: true,
    message: "Permissions updated",
    user: sanitizedUser
  });
};

module.exports = {
  updateUserPermissions
};
