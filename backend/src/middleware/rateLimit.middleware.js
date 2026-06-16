const rateLimit = require("express-rate-limit");

const authRateLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many login requests. Please try again later"
  }
});

module.exports = {
  authRateLimiter
};
