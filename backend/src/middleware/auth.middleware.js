const ApiError = require("../utils/api-error");
const { verifyAccessToken } = require("../utils/tokens");
const User = require("../models/User");
const { toActionPermissions } = require("./permission.middleware");
const { normalizeRole } = require("../constants/roles");

const authMiddleware = async (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.substring(7)
    : null;

  if (!token) {
    next(new ApiError(401, "Authentication token missing"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = await User.findById(payload.sub).select("-password");

    if (!user) {
      next(new ApiError(401, "Invalid authentication token"));
      return;
    }

    if (user.status === "blocked") {
      next(new ApiError(403, "User is blocked"));
      return;
    }

    const role = normalizeRole(user.role);

    req.user = {
      id: user._id.toString(),
      role,
      email: user.email,
      name: user.name,
      permissions: toActionPermissions(user.permissions || {}, role)
    };
    next();
  } catch (error) {
    next(new ApiError(401, "Invalid or expired authentication token"));
  }
};

module.exports = authMiddleware;
