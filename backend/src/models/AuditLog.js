const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorName: { type: String, default: "" },
    actorRole: { type: String, default: "" },
    action: { type: String, required: true },
    actionType: { type: String, default: "" },
    module: { type: String, required: true },
    entityId: { type: String, default: null },
    metadata: { type: Object, default: {} },
    previousValue: { type: Object, default: null },
    newValue: { type: Object, default: null },
    requestId: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" }
  },
  { timestamps: true }
);

auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ requestId: 1 });

const immutableError = (next) => {
  next(new Error("Audit logs are immutable and cannot be modified or deleted."));
};

auditLogSchema.pre("updateOne", immutableError);
auditLogSchema.pre("findOneAndUpdate", immutableError);
auditLogSchema.pre("deleteOne", immutableError);
auditLogSchema.pre("deleteMany", immutableError);
auditLogSchema.pre("findOneAndDelete", immutableError);

module.exports = mongoose.model("AuditLog", auditLogSchema);
