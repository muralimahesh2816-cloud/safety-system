const crypto = require("crypto");
const ApiError = require("../utils/api-error");
const { sendOtpEmail } = require("./email.service");

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

const maskEmail = (email = "") => {
  const [name = "", domain = ""] = String(email).split("@");
  if (!domain) return "";
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
};

const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");

const setOtpForUser = async (user, { force = false } = {}) => {
  if (
    !force &&
    user.lastOtpSentAt &&
    Date.now() - new Date(user.lastOtpSentAt).getTime() < OTP_RESEND_MS
  ) {
    const seconds = Math.ceil(
      (OTP_RESEND_MS - (Date.now() - new Date(user.lastOtpSentAt).getTime())) / 1000
    );
    throw new ApiError(429, `Please wait ${seconds} seconds before requesting another OTP`);
  }

  const otp = generateOtp();
  user.otpHash = hashOtp(otp);
  user.otpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
  user.otpAttempts = 0;
  user.lastOtpSentAt = new Date();
  user.otpVerified = false;
  await user.save();
  await sendOtpEmail({ to: user.email, name: user.name, otp });

  return {
    pendingOtp: true,
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendAfterSeconds: OTP_RESEND_MS / 1000,
    maskedEmail: maskEmail(user.email)
  };
};

const verifyOtpForUser = async (user, otp) => {
  if (!user || !user.otpHash) {
    throw new ApiError(401, "Invalid or expired OTP");
  }
  if (user.loginLockedUntil && user.loginLockedUntil > new Date()) {
    throw new ApiError(423, "Login temporarily locked. Please try again later");
  }
  if (!user.otpExpiresAt || user.otpExpiresAt < new Date()) {
    throw new ApiError(401, "Invalid or expired OTP");
  }
  if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
    user.loginLockedUntil = new Date(Date.now() + LOGIN_LOCK_MS);
    await user.save();
    throw new ApiError(423, "Too many OTP attempts. Please try again later");
  }

  const valid = user.otpHash === hashOtp(otp);
  if (!valid) {
    user.otpAttempts += 1;
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      user.loginLockedUntil = new Date(Date.now() + LOGIN_LOCK_MS);
    }
    await user.save();
    throw new ApiError(401, "Invalid or expired OTP");
  }

  user.otpHash = "";
  user.otpExpiresAt = null;
  user.otpAttempts = 0;
  user.loginLockedUntil = null;
  user.otpVerified = true;
  return user;
};

module.exports = {
  setOtpForUser,
  verifyOtpForUser,
  maskEmail,
  OTP_RESEND_MS
};
