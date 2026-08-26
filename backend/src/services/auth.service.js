const crypto = require("crypto");
const ApiError = require("../utils/api-error");
const { env } = require("../config/env");
const logger = require("../utils/logger");
const { sendOtpEmail } = require("./email.service");
const { sendMessage } = require("./whatsapp.service");
const { maskPhone } = require("../utils/phone");
const templates = require("./message-templates");

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

const setOtpForUser = async (user, { force = false, channel = "email" } = {}) => {
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

  // Deliver on the channel the user actually signed in with: a mobile-number
  // sign-in must put the code on that phone, not in a mailbox they may not
  // have. `auto` picks by sign-in method; an explicit OTP_CHANNEL overrides it.
  const configured = env.otpChannel === "auto" ? channel : env.otpChannel;
  const useWhatsApp = configured === "whatsapp" && Boolean(user.mobileNumber);

  let deliveredVia = "email";
  if (useWhatsApp) {
    const result = await sendMessage({
      to: user.mobileNumber,
      event: "login_otp",
      body: templates.loginOtp({ name: user.name, otp, expiresInMinutes: OTP_TTL_MS / 60000 }),
      templateName: env.whatsapp.otpTemplate || "",
      templateVariables: env.whatsapp.otpTemplate ? [otp] : []
    });
    deliveredVia = result.ok && !result.skipped ? "whatsapp" : "whatsapp_unavailable";

    // If WhatsApp could not carry it, fall back to email rather than leaving
    // the user with no code at all — but only when we actually have an address.
    if (!result.ok || result.skipped) {
      const emailed = user.email
        ? await sendOtpEmail({ to: user.email, name: user.name, otp })
            .then(() => true)
            .catch((error) => {
              logger.warn("OTP email fallback failed", { message: error.message });
              return false;
            })
        : false;

      // Only claim the channel that actually carried the code. Reporting
      // `email` regardless meant a user whose delivery had failed on both
      // channels still saw "we sent you a code", so they waited for something
      // that was never coming and spent their resend budget finding out.
      deliveredVia = emailed ? "email" : "unavailable";

      if (!emailed) {
        logger.warn("OTP could not be delivered on any channel", { userId: String(user._id) });
        throw new ApiError(
          502,
          "We could not deliver your verification code right now. Please try again shortly or contact your administrator."
        );
      }
    }
  } else {
    await sendOtpEmail({ to: user.email, name: user.name, otp });
  }

  return {
    pendingOtp: true,
    expiresInSeconds: OTP_TTL_MS / 1000,
    resendAfterSeconds: OTP_RESEND_MS / 1000,
    // Both are masked. The client shows whichever matches the sign-in method.
    maskedEmail: maskEmail(user.email),
    maskedMobile: maskPhone(user.mobileNumber),
    deliveredVia
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
