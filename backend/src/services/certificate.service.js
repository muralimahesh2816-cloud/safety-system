const crypto = require("crypto");
const Certificate = require("../models/Certificate");
const CompanySettings = require("../models/CompanySettings");

const DEFAULT_SIGNATORY_TITLE = "Authorized Signatory - HSE Department";

const buildCertificateNumber = (sequence) => {
  const year = new Date().getFullYear();
  return `UTPL-CERT-${year}-${String(sequence).padStart(5, "0")}`;
};

const buildVerificationCode = () => crypto.randomBytes(6).toString("hex").toUpperCase();

const resolveSignatory = async () => {
  const settings = await CompanySettings.findOne().select("certificateSignatory");
  const name = settings?.certificateSignatory?.name || "";
  const title = settings?.certificateSignatory?.title || DEFAULT_SIGNATORY_TITLE;
  return { name, title };
};

/**
 * Issue a certificate for a completed training, or return the existing one.
 * Idempotent: (training, user) has a unique index, so calling this more
 * than once for the same completion is safe and cheap.
 */
const issueCertificateForCompletion = async ({
  trainingId,
  trainingTitle,
  trainingCategory,
  userId,
  userName,
  completedAt
}) => {
  const existing = await Certificate.findOne({ training: trainingId, user: userId });
  if (existing) return existing;

  const signatory = await resolveSignatory();

  // Retry a handful of times in case two completions race on the same
  // certificate number (no dedicated counters collection in this codebase,
  // so we optimistically count and back off on a duplicate key).
  let attempt = 0;
  let lastError = null;
  while (attempt < 5) {
    attempt += 1;
    try {
      const sequence = (await Certificate.countDocuments()) + 1 + attempt - 1;
      // eslint-disable-next-line no-await-in-loop
      const created = await Certificate.create({
        certificateNumber: buildCertificateNumber(sequence),
        verificationCode: buildVerificationCode(),
        user: userId,
        userName,
        training: trainingId,
        trainingTitle,
        trainingCategory: trainingCategory || "",
        completedAt,
        signatoryName: signatory.name,
        signatoryTitle: signatory.title
      });
      return created;
    } catch (error) {
      lastError = error;
      // 11000 = duplicate key (certificateNumber, verificationCode, or the
      // training+user unique index if a concurrent request beat us to it).
      if (error?.code === 11000) {
        // If it was the training+user index, someone else already issued it.
        // eslint-disable-next-line no-await-in-loop
        const raceWinner = await Certificate.findOne({ training: trainingId, user: userId });
        if (raceWinner) return raceWinner;
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("Failed to issue certificate after retries");
};

module.exports = {
  issueCertificateForCompletion,
  DEFAULT_SIGNATORY_TITLE
};
