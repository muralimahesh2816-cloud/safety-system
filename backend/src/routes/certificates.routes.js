const express = require("express");
const asyncHandler = require("../utils/async-handler");
const ApiError = require("../utils/api-error");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission, authorizeRoles } = require("../middleware/rbac.middleware");
const validate = require("../middleware/validate.middleware");
const audit = require("../middleware/audit.middleware");
const Certificate = require("../models/Certificate");
const Training = require("../models/Training");
const User = require("../models/User");
const {
  checkCertificateEligibility,
  issueCertificateForCompletion,
  toCertificateView
} = require("../services/certificate.service");
const { sendMailWithRetry } = require("../services/email.service");
const { env } = require("../config/env");
const logger = require("../utils/logger");
const {
  generateCertificateSchema,
  revokeCertificateSchema,
  logCertificateActionSchema
} = require("../validators/certificate.validators");

const router = express.Router();

const MANAGE_ROLES = ["safety_manager", "admin", "super_admin"];

const buildVerifyUrl = (verificationCode) =>
  `${(env.frontendUrl || "").replace(/\/+$/, "")}/verify?code=${verificationCode}`;

const findCompletion = (training, userId) =>
  training.completions.find((completion) => completion.user?.toString() === String(userId));

// A user may view/manage a certificate if: it's their own, they're the
// assigned trainer for that training, or they hold a management role.
// Used to gate /mine-adjacent single-certificate actions (log-action,
// send) without duplicating this check in every handler.
const canManageCertificate = async (req, certificate) => {
  if (MANAGE_ROLES.includes(req.user.role)) return true;
  if (String(certificate.user) === req.user.id) return true;
  const training = await Training.findById(certificate.training).select("trainer");
  return Boolean(training?.trainer && String(training.trainer) === req.user.id);
};

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
    res.json({ success: true, certificates: certificates.map(toCertificateView) });
  })
);

// Certificate history / list. Safety Manager, Admin and Super Admin see
// everything (optionally filtered); a Trainer sees only certificates for
// trainings where they are the assigned trainer. Everyone else is denied —
// this is the "Certificate History" view from section 11 of the spec.
router.get(
  "/",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const { status, trainingId, userId } = req.query;
    const query = {};
    if (status) query.status = status;
    if (trainingId) query.training = trainingId;
    if (userId) query.user = userId;

    if (!MANAGE_ROLES.includes(req.user.role)) {
      const trainerTrainingIds = await Training.find({ trainer: req.user.id }).distinct("_id");
      if (trainerTrainingIds.length === 0) {
        throw new ApiError(403, "You do not have permission to view certificate history", null, "PERMISSION_DENIED");
      }
      query.training = query.training
        ? trainerTrainingIds.find((id) => String(id) === String(query.training)) || null
        : { $in: trainerTrainingIds };
      if (query.training === null) {
        res.json({ success: true, certificates: [] });
        return;
      }
    }

    const certificates = await Certificate.find(query).sort({ issuedAt: -1 }).select("-__v");
    res.json({ success: true, certificates: certificates.map(toCertificateView) });
  })
);

// Manual, backend-validated certificate generation. Employees may only
// generate their own; Safety Manager/Admin/Super Admin may generate on
// behalf of any eligible employee. Eligibility (Completed status + passing
// assessment score if configured) is re-checked here regardless of what
// the frontend already inferred — there is no frontend-only bypass.
router.post(
  "/generate",
  authMiddleware,
  authorizePermission("training", "view"),
  validate(generateCertificateSchema),
  asyncHandler(async (req, res) => {
    const { trainingId, userId } = req.body;
    const targetUserId = userId || req.user.id;

    if (targetUserId !== req.user.id && !MANAGE_ROLES.includes(req.user.role)) {
      throw new ApiError(403, "Only a Safety Manager or Admin can generate a certificate for another employee", null, "PERMISSION_DENIED");
    }

    const training = await Training.findById(trainingId).populate("trainer", "name");
    if (!training) throw new ApiError(404, "Training record not found");

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) throw new ApiError(404, "Employee record not found");

    const completion = findCompletion(training, targetUserId);
    const eligibility = checkCertificateEligibility({ training, completion });
    if (!eligibility.eligible) {
      throw new ApiError(400, eligibility.reason || "Not eligible for a certificate", null, "CERTIFICATE_NOT_ELIGIBLE");
    }

    const generatedByUser = await User.findById(req.user.id).select("name");
    const certificate = await issueCertificateForCompletion({
      training,
      user: targetUser,
      completion,
      generatedByUser,
      generationMode: "manual"
    });

    await audit(
      req,
      "certificate_generated",
      "certificates",
      { trainingId, targetUserId, certificateNumber: certificate.certificateNumber },
      certificate._id
    );
    res.status(201).json({ success: true, certificate: toCertificateView(certificate) });
  })
);

router.post(
  "/:id/revoke",
  authMiddleware,
  authorizeRoles(...MANAGE_ROLES),
  validate(revokeCertificateSchema),
  asyncHandler(async (req, res) => {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) throw new ApiError(404, "Certificate not found");
    if (certificate.status === "revoked") {
      res.json({ success: true, certificate: toCertificateView(certificate) });
      return;
    }

    certificate.status = "revoked";
    certificate.revokedAt = new Date();
    certificate.revokedReason = req.body.reason;
    certificate.revokedBy = req.user.id;
    certificate.revokedByName = req.user.name;
    await certificate.save();

    await audit(
      req,
      "certificate_revoked",
      "certificates",
      { certificateNumber: certificate.certificateNumber, reason: req.body.reason },
      certificate._id
    );
    res.json({ success: true, certificate: toCertificateView(certificate) });
  })
);

// Fire-and-forget "Send Certificate" email. Reuses the existing
// email.service.js retry queue (see services/email.service.js) so SMTP
// credentials never leave the backend and the request doesn't block on
// mail delivery. No PDF attachment is generated server-side (certificate
// PDFs are rendered client-side with jsPDF, see
// utils/certificatePdf.js) — the email instead links to the public
// verification page, which is the "secure download link" option the spec
// explicitly allows as an alternative to an attachment.
router.post(
  "/:id/send",
  authMiddleware,
  authorizeRoles(...MANAGE_ROLES),
  asyncHandler(async (req, res) => {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) throw new ApiError(404, "Certificate not found");

    const recipient = await User.findById(certificate.user).select("email name");
    if (!recipient?.email) throw new ApiError(400, "This employee has no email address on file");

    const verifyUrl = buildVerifyUrl(certificate.verificationCode);
    const mailOptions = {
      from: env.smtp.from,
      to: recipient.email,
      subject: `Your ${env.appName} training certificate - ${certificate.trainingTitle}`,
      text: `Hello ${recipient.name},\n\nYour training completion certificate is ready.\n\nEmployee: ${certificate.userName}\nTraining: ${certificate.trainingTitle}\nCompletion Date: ${new Date(certificate.completedAt).toDateString()}\nCertificate Number: ${certificate.certificateNumber}\n\nView and verify this certificate: ${verifyUrl}`,
      html: `<div style="font-family:Arial,sans-serif;color:#151719;padding:24px">
        <h2 style="margin:0 0 12px">Training Completion Certificate</h2>
        <p>Hello ${recipient.name},</p>
        <p>Your training completion certificate is ready.</p>
        <table style="margin:16px 0;font-size:13px">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Employee</td><td>${certificate.userName}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Training</td><td>${certificate.trainingTitle}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Completion Date</td><td>${new Date(certificate.completedAt).toDateString()}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Certificate Number</td><td>${certificate.certificateNumber}</td></tr>
        </table>
        <p><a href="${verifyUrl}" style="color:#9b1400">View / verify this certificate</a></p>
      </div>`
    };

    // Non-blocking: respond immediately, deliver in the background. Errors
    // are logged (and retried by sendMailWithRetry's own queue) rather than
    // surfaced to the UI thread.
    res.json({ success: true, queued: true });
    sendMailWithRetry(mailOptions).catch((error) => {
      logger.error("Certificate email failed to send", { certificateNumber: certificate.certificateNumber, message: error.message });
    });

    await audit(
      req,
      "certificate_sent",
      "certificates",
      { certificateNumber: certificate.certificateNumber, to: recipient.email },
      certificate._id
    );
  })
);

// Lightweight audit-only endpoint the frontend calls when a certificate is
// viewed, downloaded, or printed client-side (those actions themselves
// have no other backend round-trip). Never logs tokens or credentials.
router.post(
  "/:id/log-action",
  authMiddleware,
  validate(logCertificateActionSchema),
  asyncHandler(async (req, res) => {
    const certificate = await Certificate.findById(req.params.id);
    if (!certificate) throw new ApiError(404, "Certificate not found");

    if (!(await canManageCertificate(req, certificate))) {
      throw new ApiError(403, "You do not have permission to access this certificate", null, "PERMISSION_DENIED");
    }

    await audit(
      req,
      `certificate_${req.body.action}`,
      "certificates",
      { certificateNumber: certificate.certificateNumber },
      certificate._id
    );
    res.json({ success: true });
  })
);

// Public verification lookup — this is what a QR code / verification link
// on a printed certificate resolves to. No auth: anyone holding a
// certificate (or scanning its code) can confirm it's genuine. Only the
// minimum fields already printed on the certificate itself are echoed
// back — no employee ID, department, plaza, score, or other internal
// detail (see section 9 of the spec: "Do not expose sensitive employee
// information on the public verification page").
router.get(
  "/verify/:code",
  asyncHandler(async (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    if (!code) throw new ApiError(400, "Verification code is required");

    const certificate = await Certificate.findOne({ verificationCode: code });
    if (!certificate) {
      await audit(req, "certificate_verified", "certificates", { code, found: false }, null);
      res.json({ success: true, valid: false });
      return;
    }

    const view = toCertificateView(certificate);
    await audit(
      req,
      "certificate_verified",
      "certificates",
      { certificateNumber: certificate.certificateNumber, effectiveStatus: view.effectiveStatus },
      certificate._id
    );

    res.json({
      success: true,
      valid: view.effectiveStatus === "valid",
      certificate: {
        certificateNumber: view.certificateNumber,
        status: view.effectiveStatus.toUpperCase(),
        userName: view.userName,
        trainingTitle: view.trainingTitle,
        completedAt: view.completedAt,
        issuedBy: env.appName
      }
    });
  })
);

module.exports = router;
