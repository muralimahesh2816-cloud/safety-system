const mongoose = require("mongoose");
const { ROLES } = require("../constants/roles");
const { normalizePagePermissions } = require("../middleware/permission.middleware");

const loginHistorySchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    ip: String,
    userAgent: String,
    successful: Boolean
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    mobile: { type: String, default: "" },
    employeeId: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(ROLES),
      default: ROLES.USER
    },
    status: {
      type: String,
      enum: ["active", "blocked"],
      default: "active"
    },
    profilePhoto: {
      url: String,
      publicId: String,
      storage: String,
      originalName: String,
      mimeType: String,
      size: Number,
      fileHash: String
    },
    permissions: {
      type: Object,
      default() {
        return normalizePagePermissions({}, ROLES.USER);
      }
    },
    lastLoginAt: Date,
    loginHistory: [loginHistorySchema],
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    otpHash: { type: String, default: "" },
    otpExpiresAt: Date,
    otpAttempts: { type: Number, default: 0 },
    lastOtpSentAt: Date,
    loginLockedUntil: Date,
    otpVerified: { type: Boolean, default: false },
    isTwoFactorEnabled: { type: Boolean, default: false },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      push: { type: Boolean, default: false }
    }
  },
  {
    timestamps: true
  }
);

userSchema.index({ role: 1, status: 1 });
userSchema.index({ status: 1, lastLoginAt: -1 });
userSchema.index({ email: 1, status: 1 });
userSchema.index({ employeeId: 1, status: 1 });

module.exports = mongoose.model("User", userSchema);
