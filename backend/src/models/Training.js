const mongoose = require("mongoose");

// Per-user completion status, kept separate from `isCompleted`/`progress`
// (both retained as-is for backward compatibility with existing frontend
// reads). `status` gives the richer Assigned/In Progress/Completed/Failed
// lifecycle the certificate workflow needs; it is derived alongside
// isCompleted rather than replacing it. assessmentScore/plaza are optional
// and default to null/"" so old completion records keep working — display
// layers should render "Not Available" for missing values rather than
// guessing at them.
const completionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    progress: { type: Number, default: 0 },
    isCompleted: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["assigned", "in_progress", "completed", "failed", "expired"],
      default: "assigned"
    },
    completedAt: Date,
    certificateUrl: String,
    assessmentScore: { type: Number, default: null, min: 0, max: 100 },
    // Snapshot of the employee's site/plaza at completion time, so a
    // certificate keeps reading correctly even if the employee is later
    // reassigned. Falls back to the live User.plaza when blank.
    plaza: { type: String, default: "" },
    watchHistory: [
      {
        watchedAt: { type: Date, default: Date.now },
        seconds: Number
      }
    ]
  },
  { _id: false }
);

const trainingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    // Optional finer-grained sub-topic shown on the certificate as
    // "Training Concept" alongside the broader category. Defaults to ""
    // (rendered as "Not Available") for existing training records.
    concept: { type: String, default: "" },
    thumbnail: {
      url: String,
      publicId: String,
      storage: String,
      originalName: String,
      mimeType: String,
      size: Number,
      fileHash: String
    },
    video: {
      url: String,
      publicId: String,
      storage: String,
      originalName: String,
      mimeType: String,
      size: Number,
      fileHash: String
    },
    tags: [String],
    durationMinutes: Number,
    isPublished: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    recommendedForRoles: [String],
    // Instructor of record. `trainer` links to a real user account when the
    // trainer has a login (used for the Trainer certificate-visibility
    // scope); `trainerName` is a free-text fallback for trainers without an
    // account, or for legacy records. Certificate issuance snapshots
    // whichever is available.
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    trainerName: { type: String, default: "" },
    // If set, a completion's assessmentScore must be >= passingScore for
    // certificate eligibility (backend-enforced, see
    // certificate.service.js#checkCertificateEligibility). Leave unset for
    // trainings with no graded assessment.
    passingScore: { type: Number, default: null, min: 0, max: 100 },
    // Optional certificate validity window in months; issuance stamps
    // Certificate.expiresAt = completedAt + validityMonths when set.
    validityMonths: { type: Number, default: null, min: 1 },
    completions: [completionSchema]
  },
  { timestamps: true }
);

trainingSchema.index({ category: 1, isPublished: 1 });
trainingSchema.index({ isPublished: 1, createdAt: -1 });
trainingSchema.index({ createdBy: 1, createdAt: -1 });
trainingSchema.index({ recommendedForRoles: 1, isPublished: 1 });
trainingSchema.index({ "completions.user": 1, "completions.isCompleted": 1 });
trainingSchema.index({ trainer: 1 });

module.exports = mongoose.model("Training", trainingSchema);
