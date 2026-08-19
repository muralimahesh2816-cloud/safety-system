const crypto = require("crypto");
const Certificate = require("../models/Certificate");
const CompanySettings = require("../models/CompanySettings");

const DEFAULT_SIGNATORY_TITLE = "Authorized Signatory - HSE Department";
const DEFAULT_NUMBER_PREFIX = "UTPL-HSE-TRN";

const buildCertificateNumber = (sequence, prefix = DEFAULT_NUMBER_PREFIX) => {
  const year = new Date().getFullYear();
  return `${prefix}-${year}-${String(sequence).padStart(6, "0")}`;
};

const buildVerificationCode = () => crypto.randomBytes(6).toString("hex").toUpperCase();

const resolveCertificateSettings = async () => {
  const settings = await CompanySettings.findOne().select("certificateSignatory certificateNumberPrefix");
  return {
    signatory: {
      name: settings?.certificateSignatory?.name || "",
      title: settings?.certificateSignatory?.title || DEFAULT_SIGNATORY_TITLE
    },
    numberPrefix: settings?.certificateNumberPrefix || DEFAULT_NUMBER_PREFIX
  };
};

/**
 * Backend-enforced eligibility check — the ONLY place that decides whether
 * a certificate may be generated for a given (training, completion) pair.
 * The frontend also hides the "Generate Certificate" button when this
 * would fail, but that's a UX convenience only: every generation request
 * re-runs this check server-side, so there is no frontend-only bypass.
 *
 * A training only requires an assessment when its `passingScore` was
 * explicitly configured (Case A). Everything else — including every
 * legacy training record created before this field existed — falls
 * through to Case B ("no assessment configured") and is never blocked on
 * a missing score. Each failure carries a stable `code` so the frontend
 * can show a distinct, accurate message per case (spec: never show a
 * generic "fill required fields" error for a real business-rule reason).
 */
const checkCertificateEligibility = ({ training, completion }) => {
  if (!training || !completion) {
    return {
      eligible: false,
      code: "NO_COMPLETION",
      reason: "No training completion record found for this user."
    };
  }
  if (!completion.isCompleted || Number(completion.progress || 0) < 100) {
    return {
      eligible: false,
      code: "NOT_COMPLETED",
      reason: "Certificate cannot be issued because this training is not completed."
    };
  }
  const hasPassingScore = training.passingScore !== null && training.passingScore !== undefined;
  if (hasPassingScore) {
    if (completion.assessmentScore === null || completion.assessmentScore === undefined) {
      return {
        eligible: false,
        code: "SCORE_REQUIRED",
        reason: "An assessment is configured for this training, but no score is available yet."
      };
    }
    if (Number(completion.assessmentScore) < Number(training.passingScore)) {
      return {
        eligible: false,
        code: "SCORE_FAILED",
        reason: `Certificate cannot be issued because the assessment score (${completion.assessmentScore}%) is below the required passing score (${training.passingScore}%).`
      };
    }
  }
  return { eligible: true, code: "ELIGIBLE", reason: "" };
};

const resolveResult = ({ training, completion }) => {
  const hasPassingScore = training.passingScore !== null && training.passingScore !== undefined;
  const hasScore = completion.assessmentScore !== null && completion.assessmentScore !== undefined;
  if (!hasPassingScore || !hasScore) return "Not Assessed";
  return Number(completion.assessmentScore) >= Number(training.passingScore) ? "Passed" : "Failed";
};

/**
 * Issue a certificate for a completed, eligible training, or return the
 * existing one. Idempotent: (training, user) has a unique index, so
 * calling this more than once for the same completion is safe and cheap.
 * Callers MUST run checkCertificateEligibility first (see
 * routes/certificates.routes.js) — this function trusts its inputs.
 */
const issueCertificateForCompletion = async ({
  training,
  user,
  completion,
  generatedByUser,
  generationMode = "manual"
}) => {
  const existing = await Certificate.findOne({ training: training._id, user: user._id });
  if (existing) return existing;

  const { signatory, numberPrefix } = await resolveCertificateSettings();
  const trainingDate = completion.watchHistory?.[0]?.watchedAt || completion.completedAt;
  const result = resolveResult({ training, completion });
  const expiresAt = training.validityMonths
    ? new Date(new Date(completion.completedAt).setMonth(new Date(completion.completedAt).getMonth() + training.validityMonths))
    : null;

  const doc = {
    user: user._id,
    userName: user.name,
    employeeId: user.employeeId || "",
    employeeRole: user.role || "",
    department: user.department || "",
    plaza: completion.plaza || user.plaza || "",

    training: training._id,
    trainingTitle: training.title,
    trainingCategory: training.category || "",
    trainingConcept: training.concept || "",
    trainerName: training.trainer?.name || training.trainerName || "",
    durationMinutes: training.durationMinutes ?? null,

    trainingDate,
    completedAt: completion.completedAt,
    completionPercentage: completion.progress ?? 100,
    assessmentScore: completion.assessmentScore ?? null,
    passingScore: training.passingScore ?? null,
    result,

    expiresAt,
    validityMonths: training.validityMonths ?? null,
    signatoryName: signatory.name,
    signatoryTitle: signatory.title,

    generatedBy: generatedByUser?._id || null,
    generatedByName: generatedByUser?.name || "",
    generationMode
  };

  // Retry a handful of times in case two requests race on the same
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
        ...doc,
        certificateNumber: buildCertificateNumber(sequence, numberPrefix),
        verificationCode: buildVerificationCode()
      });
      return created;
    } catch (error) {
      lastError = error;
      // 11000 = duplicate key (certificateNumber, verificationCode, or the
      // training+user unique index if a concurrent request beat us to it).
      if (error?.code === 11000) {
        // If it was the training+user index, someone else already issued it.
        // eslint-disable-next-line no-await-in-loop
        const raceWinner = await Certificate.findOne({ training: training._id, user: user._id });
        if (raceWinner) return raceWinner;
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error("Failed to issue certificate after retries");
};

/**
 * Derives the read-time VALID / EXPIRED / REVOKED state from the persisted
 * `status` + `expiresAt` fields (see the model comment on why "expired" is
 * never itself persisted), and strips nothing else — callers that need the
 * minimal public-verify shape build that separately in the route handler.
 */
const toCertificateView = (certificateDoc) => {
  const certificate = certificateDoc.toObject ? certificateDoc.toObject() : certificateDoc;
  let effectiveStatus = "valid";
  if (certificate.status === "revoked") {
    effectiveStatus = "revoked";
  } else if (certificate.expiresAt && new Date(certificate.expiresAt).getTime() < Date.now()) {
    effectiveStatus = "expired";
  }
  return { ...certificate, effectiveStatus };
};

module.exports = {
  buildCertificateNumber,
  buildVerificationCode,
  resolveCertificateSettings,
  checkCertificateEligibility,
  issueCertificateForCompletion,
  toCertificateView,
  DEFAULT_SIGNATORY_TITLE,
  DEFAULT_NUMBER_PREFIX
};
