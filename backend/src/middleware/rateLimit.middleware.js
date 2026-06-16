const rateLimit = require("express-rate-limit");

const otpRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many OTP requests. Please try again later"
  }
});

module.exports = {
  otpRateLimiter
};
