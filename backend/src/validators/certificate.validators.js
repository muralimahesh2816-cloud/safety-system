const { z } = require("zod");

const generateCertificateSchema = z.object({
  trainingId: z.string().min(1, "trainingId is required"),
  // Optional: a Safety Manager/Admin/Super Admin generating a certificate
  // on behalf of an employee. Employees may omit this to generate their
  // own; see routes/certificates.routes.js for the permission check that
  // backs this (self vs. others is enforced server-side, not just hidden
  // in the UI).
  userId: z.string().optional()
});

const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(5, "A revocation reason of at least 5 characters is required").max(500)
});

const logCertificateActionSchema = z.object({
  action: z.enum(["viewed", "downloaded", "printed"])
});

const assessmentScoreSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  score: z.coerce.number().min(0).max(100)
});

module.exports = {
  generateCertificateSchema,
  revokeCertificateSchema,
  logCertificateActionSchema,
  assessmentScoreSchema
};
