const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    notificationId: { type: String, unique: true, sparse: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, default: "" },
    type: { type: String, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    icon: { type: String, default: "bell" },
    color: { type: String, default: "blue" },
    module: { type: String, default: "" },
    relatedModule: { type: String, default: "" },
    relatedRecordId: { type: mongoose.Schema.Types.ObjectId },
    url: { type: String, default: "" },
    data: { type: Object, default: {} },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium"
    },
    read: { type: Boolean, default: false },
    readAt: Date,
    archived: { type: Boolean, default: false },
    archivedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expiresAt: Date,
    deliveryChannels: {
      inApp: { type: Boolean, default: true },
      email: { type: Boolean, default: false },
      pushReady: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

notificationSchema.pre("validate", function assignNotificationId() {
  if (!this.notificationId && this._id) {
    this.notificationId = `NTF-${String(this._id).slice(-10).toUpperCase()}`;
  }
  if (!this.relatedModule && this.module) this.relatedModule = this.module;
});

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ relatedModule: 1, relatedRecordId: 1 });
notificationSchema.index({ archived: 1, expiresAt: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
