const mongoose = require("mongoose");

const sessionTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    userAgent: String,
    ip: String,
    expiresAt: { type: Date, required: true },
    revokedAt: Date
  },
  { timestamps: true }
);

sessionTokenSchema.index({ user: 1, createdAt: -1 });
sessionTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("SessionToken", sessionTokenSchema);
