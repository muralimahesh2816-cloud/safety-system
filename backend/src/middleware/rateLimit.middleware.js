const rateLimit = require("express-rate-limit");
const { normalizePhone } = require("../utils/phone");

/**
 * Login rate limiting.
 *
 * Two layers, because they defend against different things and one cannot
 * substitute for the other:
 *
 *  - **Per IP** stops one attacker probing many accounts from one place.
 *  - **Per mobile number** stops one *person* being OTP-bombed or brute-forced,
 *    no matter how many addresses the attempts come from. This is the control
 *    that actually protects an individual account, and it is the one that was
 *    missing.
 *
 * The per-IP budget is also now configurable with a larger default. A single
 * toll plaza office NATs its whole shift behind one address: at the previous
 * fixed 8-per-10-minutes, the ninth person to sign in at shift change was
 * locked out of the safety system for ten minutes. Widening the IP window while
 * adding a strict per-identity limit makes the system both more usable and
 * harder to attack than it was.
 */
const windowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const ipMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 40);

const OTP_WINDOW_MS = Number(process.env.OTP_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const OTP_MAX_PER_NUMBER = Number(process.env.OTP_RATE_LIMIT_MAX || 5);

const authRateLimiter = rateLimit({
  windowMs,
  max: ipMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "Too many attempts. Please try again later."
  }
});

/**
 * Keyed by the normalised mobile number so every spelling of one number shares
 * a single budget — otherwise an attacker cycles `9876543210`,
 * `+919876543210`, `09876543210` and gets a fresh allowance each time.
 *
 * Falls back to the IP when the body has no usable number, so a malformed
 * flood is still bounded.
 */
const otpRequestRateLimiter = rateLimit({
  windowMs: OTP_WINDOW_MS,
  max: OTP_MAX_PER_NUMBER,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const parsed = normalizePhone(req.body?.mobile || "");
    return parsed.ok ? `otp:${parsed.e164}` : `otp-ip:${req.ip}`;
  },
  message: {
    success: false,
    code: "RATE_LIMITED",
    message: "Too many attempts. Please try again later."
  }
});

module.exports = {
  authRateLimiter,
  otpRequestRateLimiter
};
