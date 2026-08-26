const mongoose = require("mongoose");
const { ROLES } = require("../constants/roles");
const { normalizePagePermissions } = require("../middleware/permission.middleware");
const { normalizePhone } = require("../utils/phone");

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
    // Free-text mobile as originally captured. Kept as-is so nothing that
    // already reads it changes behaviour, and so the number the user typed is
    // still visible on their profile.
    mobile: { type: String, default: "" },
    // Normalised E.164 form (`+919876543210`) — the identity OTP login resolves
    // against. Derived from `mobile` via utils/phone.js, never typed directly,
    // so "9876543210" and "+91 98765 43210" can never become two accounts.
    // Sparse-unique: the many existing users with no number yet must not
    // collide with each other on an empty value.
    mobileNumber: { type: String, default: null },
    mobileVerifiedAt: { type: Date, default: null },
    employeeId: { type: String, default: "", trim: true },
    department: { type: String, default: "", trim: true },
    // Site / toll plaza the employee is primarily attached to. Same field
    // name/shape as WorkApproval's existing `plaza` string so certificates
    // and reports can reuse one convention across modules.
    plaza: { type: String, default: "", trim: true },
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
    // Worker QR identity.
    //
    // A random, rotatable code — never the _id or employeeId — that a printed
    // badge encodes alongside an HMAC of it (see services/worker-qr.service.js).
    // Regenerating it immediately invalidates every previously printed badge
    // for this worker, which is the recovery path for a lost or copied badge.
    // `select: false` keeps it out of every ordinary user response; the QR
    // endpoints select it explicitly.
    workerCode: { type: String, default: "", select: false },
    workerCodeIssuedAt: { type: Date, default: null },
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
      // Defaults on, alongside email and inApp. This was previously `false` as
      // a placeholder for an unimplemented channel — no interface ever exposed
      // the toggle, so a stored `false` records no user decision. Now that
      // assignment messages actually send, the default has to match the
      // business rule: an assignee is told that work is theirs. Anyone who
      // later opts out has that respected, because the funnel only skips on an
      // explicit false.
      whatsapp: { type: Boolean, default: true },
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
// Serves the dashboard's monthly login-activity aggregation.
userSchema.index({ lastLoginAt: -1 });
// Unique per worker, sparse so the many users without a badge yet do not
// collide on "". Serves the QR scan lookup, which is the hot path during a
// site attendance round.
// PARTIAL, not sparse. A sparse index only skips documents where the field is
// *absent* — a stored "" (this field's default) or null is still indexed, so a
// sparse unique index made it impossible to create a second user who had not
// been issued a badge. The partial filter indexes only real, non-empty codes.
userSchema.index(
  { workerCode: 1 },
  { unique: true, partialFilterExpression: { workerCode: { $type: "string", $gt: "" } } }
);
// The OTP login lookup: one indexed equality match per sign-in attempt, and the
// uniqueness guarantee that makes "one number, one account" true rather than
// merely intended.
// Partial for the same reason: `mobileNumber` defaults to null for the many
// users who have no number on file, and null is indexed by a sparse index.
userSchema.index(
  { mobileNumber: 1 },
  { unique: true, partialFilterExpression: { mobileNumber: { $type: "string" } } }
);

/**
 * `mobileNumber` is always derived from `mobile`, never set by a caller.
 *
 * Both hooks exist because the two write paths in this codebase are different:
 * `user.save()` triggers `pre("save")`, while the users route uses
 * `findByIdAndUpdate`, which does not. Deriving it in the model rather than in
 * each route means no future endpoint can create a user whose normalised
 * number is missing or inconsistent with the number on their profile.
 *
 * An unparseable number stores `null` rather than a bad value — `null` is
 * skipped by the sparse unique index, so one invalid entry cannot block every
 * other user without a number.
 */
const deriveMobileNumber = (raw) => {
  if (raw === undefined) return undefined;
  if (!raw) return null;
  const result = normalizePhone(raw);
  return result.ok ? result.e164 : null;
};

// Async form rather than the callback form: Mongoose 9 does not pass `next`
// to these hooks.
userSchema.pre("save", async function normaliseMobile() {
  if (this.isModified("mobile")) {
    this.mobileNumber = deriveMobileNumber(this.mobile);
  }
});

userSchema.pre(["findOneAndUpdate", "updateOne"], async function normaliseMobileOnUpdate() {
  const update = this.getUpdate() || {};
  const raw = update.mobile !== undefined ? update.mobile : update.$set?.mobile;
  if (raw !== undefined) {
    this.set("mobileNumber", deriveMobileNumber(raw));
  }
});

module.exports = mongoose.model("User", userSchema);
