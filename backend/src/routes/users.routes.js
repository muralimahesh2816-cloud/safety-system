const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission, authorizeRoles } = require("../middleware/rbac.middleware");
const validate = require("../middleware/validate.middleware");
const audit = require("../middleware/audit.middleware");
const User = require("../models/User");
const {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema
} = require("../validators/users.validators");
const { env } = require("../config/env");
const { uploadAsset } = require("../utils/uploads");
const { createMemoryUpload } = require("../utils/multer");
const { ROLES, getRoleQueryValues } = require("../constants/roles");
const {
  normalizeAssignmentStage,
  getEligibleAssigneeRoles
} = require("../constants/work-assignment");
const { buildQrPayload, generateWorkerCode } = require("../services/worker-qr.service");
const {
  normalizePagePermissions,
  toActionPermissions
} = require("../middleware/permission.middleware");
const { updateUserPermissions } = require("../controllers/users.controller");
const { createNotification } = require("../services/notifications.service");
const {
  escapeRegex,
  getPagination,
  buildPaginationMeta,
  hasPagination
} = require("../utils/pagination");

const router = express.Router();
const upload = createMemoryUpload({ maxFileSizeMb: 5, maxFiles: 1 });

router.get(
  "/",
  authMiddleware,
  authorizePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const filters = {};
    const { role, status, search } = req.query;
    if (role) filters.role = role;
    if (status) filters.status = status;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filters.$or = [
        { name: regex },
        { email: regex },
        { mobile: regex },
        { employeeId: regex },
        { department: regex }
      ];
    }

    const shouldPaginate = hasPagination(req.query);
    const pagination = getPagination(req.query);
    let query = User.find(filters)
      .select("-password")
      .sort({ createdAt: -1 });
    if (shouldPaginate) {
      query = query.skip(pagination.skip).limit(pagination.limit);
    }

    const [users, total] = await Promise.all([
      query,
      User.countDocuments(filters)
    ]);
    const mappedUsers = users.map((user) => {
      const pagePermissions = normalizePagePermissions(user.permissions, user.role);
      return {
        ...user.toObject(),
        permissions: pagePermissions,
        permissionMatrix: toActionPermissions(pagePermissions, user.role)
      };
    });
    res.json({
      success: true,
      users: mappedUsers,
      pagination: shouldPaginate
        ? buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total })
        : { total, unpaginated: true }
    });
    await audit(req, "view", "users");
  })
);

router.get(
  "/eligible-assignees",
  authMiddleware,
  authorizePermission("work", "view"),
  asyncHandler(async (req, res) => {
    const stage = normalizeAssignmentStage(req.query.stage);
    const eligibleRoles = getEligibleAssigneeRoles(stage);
    if (!stage || eligibleRoles.length === 0) {
      throw new ApiError(400, "A valid assignment stage is required");
    }

    const filters = {
      status: "active",
      role: { $in: getRoleQueryValues(eligibleRoles) }
    };
    const excludedIds = [
      req.query.excludeUserId,
      ...String(req.query.excludeUserIds || "").split(",")
    ]
      .map((value) => String(value || "").trim())
      .filter((value) => mongoose.Types.ObjectId.isValid(value));
    if (excludedIds.length) filters._id = { $nin: excludedIds };
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      filters.$or = [
        { name: regex },
        { email: regex },
        { employeeId: regex }
      ];
    }

    const users = await User.find(filters)
      .select("name employeeId role")
      .sort({ name: 1 })
      .limit(100)
      .lean();

    res.json({ success: true, stage, users });
  })
);

router.post(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(createUserSchema),
  asyncHandler(async (req, res) => {
    const exists = await User.findOne({ email: req.body.email });
    if (exists) {
      throw new ApiError(409, "Email already in use");
    }
    const hash = await bcrypt.hash(req.body.password, env.bcryptRounds);
    const role = req.body.role || ROLES.USER;
    const pagePermissions = normalizePagePermissions(req.body.permissions, role);
    const user = await User.create({
      ...req.body,
      role,
      password: hash,
      permissions: pagePermissions
    });

    await createNotification({
      userId: user._id,
      type: "user",
      title: "Account Created",
      message: "Your HSE account has been created"
    });

    await audit(req, "create", "users", { email: user.email }, user._id);

    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  })
);

router.put(
  "/:id",
  authMiddleware,
  authorizePermission("users", "update"),
  validate(updateUserSchema),
  asyncHandler(async (req, res) => {
    const existing = await User.findById(req.params.id);
    if (!existing) throw new ApiError(404, "User not found");

    const updates = { ...req.body };
    const role = updates.role || existing.role || ROLES.USER;
    if (updates.role || updates.permissions) {
      updates.permissions = normalizePagePermissions(updates.permissions, role);
    }

    // Captured before the write so the audit entry can state what actually
    // changed. Recording only the new value makes an access-control audit
    // nearly useless after the fact — "who granted this, and what did they take
    // away?" is the question it exists to answer.
    const previousRole = existing.role;
    const previousPermissions = existing.permissions || {};

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true
    }).select("-password");

    const roleChanged = Boolean(updates.role) && updates.role !== previousRole;
    const permissionsChanged = Boolean(updates.permissions);

    if (roleChanged || permissionsChanged) {
      // Access changes get their own audit action so they can be filtered out
      // of the general update noise during a review.
      const granted = [];
      const revoked = [];
      if (permissionsChanged) {
        Object.entries(updates.permissions).forEach(([key, value]) => {
          const before = Boolean(previousPermissions[key]);
          if (value && !before) granted.push(key);
          if (!value && before) revoked.push(key);
        });
      }

      await audit(
        req,
        roleChanged ? "role_changed" : "permissions_changed",
        "settings",
        {
          targetUser: user.name,
          targetEmail: user.email,
          previousRole,
          newRole: user.role,
          granted,
          revoked
        },
        user._id,
        {
          previousValue: { role: previousRole, permissions: previousPermissions },
          newValue: { role: user.role, permissions: user.permissions }
        }
      );
    }

    await audit(req, "update", "users", updates, user._id);
    res.json({
      success: true,
      user
    });
  })
);

router.put(
  "/:id/permissions",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(updateUserPermissions)
);

router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new ApiError(404, "User not found");
    await User.findByIdAndDelete(req.params.id);
    await audit(req, "delete", "users", { email: user.email }, user._id);
    res.json({ success: true, message: "User deleted" });
  })
);

router.post(
  "/:id/reset-password",
  authMiddleware,
  authorizePermission("users", "update"),
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const hash = await bcrypt.hash(req.body.newPassword, env.bcryptRounds);
    await User.findByIdAndUpdate(req.params.id, { password: hash });
    await audit(req, "reset_password", "users", {}, req.params.id);
    res.json({ success: true, message: "Password reset successful" });
  })
);

router.post(
  "/:id/block",
  authMiddleware,
  authorizePermission("users", "update"),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "blocked" },
      { new: true }
    ).select("-password");
    if (!user) throw new ApiError(404, "User not found");
    await audit(req, "block", "users", {}, user._id);
    res.json({ success: true, user });
  })
);

router.post(
  "/:id/activate",
  authMiddleware,
  authorizePermission("users", "update"),
  asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { status: "active" },
      { new: true }
    ).select("-password");
    if (!user) throw new ApiError(404, "User not found");
    await audit(req, "activate", "users", {}, user._id);
    res.json({ success: true, user });
  })
);

router.post(
  "/:id/profile-photo",
  authMiddleware,
  authorizePermission("users", "update"),
  upload.single("profilePhoto"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "Profile photo is required");
    const asset = await uploadAsset(req.file, "safety-hse/users", "image");
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { profilePhoto: asset },
      { new: true }
    ).select("-password");
    if (!user) throw new ApiError(404, "User not found");
    await audit(req, "profile_photo_upload", "users", {}, user._id);
    res.json({ success: true, user });
  })
);

router.get(
  "/:id/login-history",
  authMiddleware,
  authorizePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select("loginHistory name email");
    if (!user) throw new ApiError(404, "User not found");
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      },
      history: user.loginHistory || []
    });
  })
);

/* ------------------------------------------------------- worker QR badge */

// Who may look at whose badge: your own always; anyone else's only with the
// users:view permission. A badge is a physical credential, so handing one out
// is a privileged action even though the payload itself carries no personal
// data.
const canViewWorkerQr = (req, targetId) =>
  String(req.user.id) === String(targetId) ||
  ["super_admin", "admin", "safety_manager"].includes(req.user.role);

/**
 * Returns the worker's QR payload, minting one on first request.
 *
 * The payload is generated server-side and never accepted from a client — the
 * signature is only meaningful because the server is the sole issuer.
 */
router.get(
  "/:id/worker-qr",
  authMiddleware,
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid user id");
    }
    if (!canViewWorkerQr(req, req.params.id)) {
      throw new ApiError(403, "You can only view your own worker QR badge.", null, "PERMISSION_DENIED");
    }

    const user = await User.findById(req.params.id).select(
      "+workerCode name employeeId role status department plaza workerCodeIssuedAt"
    );
    if (!user) throw new ApiError(404, "User not found");

    // Minted lazily so existing users get a badge the first time one is asked
    // for, with no migration step.
    if (!user.workerCode) {
      user.workerCode = generateWorkerCode();
      user.workerCodeIssuedAt = new Date();
      await user.save();
      await audit(req, "worker_qr_issued", "users", { name: user.name }, user._id);
    }

    res.json({
      success: true,
      worker: {
        id: user._id,
        name: user.name,
        employeeId: user.employeeId || "",
        role: user.role,
        department: user.department || "",
        plaza: user.plaza || "",
        status: user.status
      },
      // The QR string itself. Rendering it to an image is the client's job.
      qrPayload: buildQrPayload(user.workerCode),
      issuedAt: user.workerCodeIssuedAt
    });
  })
);

/**
 * Rotates the worker code, immediately invalidating every printed badge for
 * this worker. This is the recovery path for a lost or copied badge, so it is
 * restricted to administrators and safety management — a worker cannot rotate
 * their own badge and silently invalidate attendance evidence tooling.
 */
router.post(
  "/:id/worker-qr/regenerate",
  authMiddleware,
  authorizeRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.SAFETY_MANAGER),
  asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      throw new ApiError(400, "Invalid user id");
    }

    const user = await User.findById(req.params.id).select("+workerCode name employeeId role status");
    if (!user) throw new ApiError(404, "User not found");

    user.workerCode = generateWorkerCode();
    user.workerCodeIssuedAt = new Date();
    await user.save();

    await audit(
      req,
      "worker_qr_regenerated",
      "users",
      { name: user.name, employeeId: user.employeeId },
      user._id
    );

    res.json({
      success: true,
      message: "Worker QR badge regenerated. Previously printed badges no longer work.",
      qrPayload: buildQrPayload(user.workerCode),
      issuedAt: user.workerCodeIssuedAt
    });
  })
);

module.exports = router;
