const mongoose = require("mongoose");

/**
 * A training-completion certificate. One certificate per (training, user)
 * pair — issuance is idempotent, see services/certificate.service.js.
 *
 * userName / trainingTitle / trainingCategory are snapshotted at issuance
 * time so a certificate keeps reading correctly even if the user is later
 * renamed or the training record is edited/unpublished.
 */
const certificateSchema = new mongoose.Schema(
  {
    certificateNumber: { type: String, required: true, unique: true, index: true },
    verificationCode: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userName: { type: String, required: true },
    training: { type: mongoose.Schema.Types.ObjectId, ref: "Training", required: true },
    trainingTitle: { type: String, required: true },
    trainingCategory: { type: String, default: "" },
    completedAt: { type: Date, required: true },
    issuedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    signatoryName: { type: String, default: "" },
    signatoryTitle: { type: String, default: "Authorized Signatory - HSE Department" },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: "" }
  },
  { timestamps: true }
);

certificateSchema.index({ user: 1, createdAt: -1 });
certificateSchema.index({ training: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("Certificate", certificateSchema);
