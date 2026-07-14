const express = require("express");
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
const { ROLES } = require("../constants/roles");
const {
  normalizePagePermissions,
  toActionPermissions
} = require("../middleware/permission.middleware");
const { updateUserPermissions } = require("../controllers/users.controller");
const { createNotification } = require("../services/notifications.service");

const router = express.Router();
const upload = createMemoryUpload({ maxFileSizeMb: 5, maxFiles: 1 });

router.get(
  "/",
  authMiddleware,
  authorizePermission("users", "view"),
  asyncHandler(async (req, res) => {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 });
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
      users: mappedUsers
    });
    await audit(req, "view", "users");
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

    const user = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true
    }).select("-password");

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

module.exports = router;
