const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true },
    module: { type: String, required: true },
    entityId: { type: String, default: null },
    metadata: { type: Object, default: {} }
  },
  { timestamps: true }
);

auditLogSchema.index({ module: 1, createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
