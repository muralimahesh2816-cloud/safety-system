const express = require("express");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const Certificate = require("../models/Certificate");

const router = express.Router();

// The signed-in user's own certificates, for the "My Certificates" /
// training history section of their profile.
router.get(
  "/mine",
  authMiddleware,
  authorizePermission("training", "view"),
  asyncHandler(async (req, res) => {
    const certificates = await Certificate.find({ user: req.user.id })
      .sort({ issuedAt: -1 })
      .select("-__v");
    res.json({ success: true, certificates });
  })
);

// Public verification lookup — this is what a QR code / verification link
// on a printed certificate resolves to. No auth: anyone holding a
// certificate (or scanning its code) can confirm it's genuine. Only the
// fields already printed on the certificate itself are echoed back.
router.get(
  "/verify/:code",
  asyncHandler(async (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) throw new ApiError(400, "Verification code is required");

    const certificate = await Certificate.findOne({ verificationCode: code });
    if (!certificate || certificate.status !== "active") {
      res.json({ success: true, valid: false });
      return;
    }

    res.json({
      success: true,
      valid: true,
      certificate: {
        certificateNumber: certificate.certificateNumber,
        userName: certificate.userName,
        trainingTitle: certificate.trainingTitle,
        completedAt: certificate.completedAt,
        issuedAt: certificate.issuedAt,
        expiresAt: certificate.expiresAt
      }
    });
  })
);

module.exports = router;
