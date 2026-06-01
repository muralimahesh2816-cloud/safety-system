const crypto = require("crypto");
const { isProduction } = require("../config/env");
const ApiError = require("../utils/api-error");

const CSRF_COOKIE_NAME = "hse_csrf_token";
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

const generateCsrfToken = () => crypto.randomBytes(24).toString("hex");

const issueCsrfToken = (res) => {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/"
  });
  return token;
};

const csrfProtection = (req, _res, next) => {
  if (SAFE_METHODS.includes(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];
  const headerToken = req.headers["x-csrf-token"];
  const hasBearerToken = String(req.headers.authorization || "").startsWith("Bearer ");

  if (hasBearerToken) {
    next();
    return;
  }

  if (!headerToken || !cookieToken || cookieToken !== headerToken) {
    next(new ApiError(403, "CSRF token validation failed"));
    return;
  }

  next();
};

module.exports = {
  CSRF_COOKIE_NAME,
  issueCsrfToken,
  csrfProtection
};
