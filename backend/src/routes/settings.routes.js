const express = require("express");
const multer = require("multer");
const asyncHandler = require("../utils/async-handler");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const validate = require("../middleware/validate.middleware");
const audit = require("../middleware/audit.middleware");
const ApiError = require("../utils/api-error");
const CompanySettings = require("../models/CompanySettings");
const { profileSchema, brandingSchema, securitySchema } = require("../validators/settings.validators");
const { uploadAsset } = require("../utils/uploads");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const ensureSettings = async () => {
  const settings = await CompanySettings.findOne();
  if (settings) return settings;
  return CompanySettings.create({});
};

router.get(
  "/",
  authMiddleware,
  authorizePermission("settings", "view"),
  asyncHandler(async (_req, res) => {
    const settings = await ensureSettings();
    res.json({ success: true, settings });
  })
);

router.put(
  "/profile",
  authMiddleware,
  authorizePermission("settings", "update"),
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const settings = await ensureSettings();
    Object.assign(settings, req.body, { updatedBy: req.user.id });
    await settings.save();
    await audit(req, "update_profile", "settings", req.body, settings._id);
    res.json({ success: true, settings });
  })
);

router.put(
  "/branding",
  authMiddleware,
  authorizePermission("settings", "update"),
  validate(brandingSchema),
  asyncHandler(async (req, res) => {
    const settings = await ensureSettings();
    settings.branding = {
      ...settings.branding,
      ...req.body
    };
    settings.updatedBy = req.user.id;
    await settings.save();
    await audit(req, "update_branding", "settings", req.body, settings._id);
    res.json({ success: true, settings });
  })
);

router.put(
  "/security",
  authMiddleware,
  authorizePermission("settings", "update"),
  validate(securitySchema),
  asyncHandler(async (req, res) => {
    const settings = await ensureSettings();
    settings.security = {
      ...settings.security,
      ...req.body,
      passwordPolicy: {
        ...settings.security.passwordPolicy,
        ...req.body.passwordPolicy
      }
    };
    settings.updatedBy = req.user.id;
    await settings.save();
    await audit(req, "update_security", "settings", req.body, settings._id);
    res.json({ success: true, settings });
  })
);

router.post(
  "/logo",
  authMiddleware,
  authorizePermission("settings", "update"),
  upload.single("logo"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, "Logo file is required");
    }
    const settings = await ensureSettings();
    settings.logo = await uploadAsset(req.file, "safety-hse/company/logo", "image");
    settings.updatedBy = req.user.id;
    await settings.save();
    await audit(req, "upload_logo", "settings", {}, settings._id);
    res.json({ success: true, settings });
  })
);

router.post(
  "/branding-assets",
  authMiddleware,
  authorizePermission("settings", "update"),
  upload.fields([
    { name: "dashboardBanner", maxCount: 1 },
    { name: "loginBackground", maxCount: 1 }
  ]),
  asyncHandler(async (req, res) => {
    const settings = await ensureSettings();
    const banner = req.files?.dashboardBanner?.[0];
    const loginBg = req.files?.loginBackground?.[0];
    if (banner) {
      const uploaded = await uploadAsset(
        banner,
        "safety-hse/company/dashboard-banner",
        "image"
      );
      settings.branding.dashboardBanner = uploaded.url;
    }
    if (loginBg) {
      const uploaded = await uploadAsset(
        loginBg,
        "safety-hse/company/login-bg",
        "image"
      );
      settings.branding.loginBackground = uploaded.url;
    }
    settings.updatedBy = req.user.id;
    await settings.save();
    await audit(req, "upload_branding_assets", "settings", {}, settings._id);
    res.json({ success: true, settings });
  })
);

module.exports = router;
