const crypto = require("crypto");
const { isProduction } = require("../config/env");
const ApiError = require("../utils/api-error");
const logger = require("../utils/logger");

const CSRF_COOKIE_NAME = "hse_csrf_token";
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];

const generateCsrfToken = () => crypto.randomBytes(24).toString("hex");

const partitionedCookieOptions = isProduction
  ? {
      // Frontend/backend are currently on separate Render hostnames. Partitioned
      // keeps the readable double-submit token compatible with modern Firefox/Chrome
      // third-party cookie partitioning without weakening CSRF validation.
      partitioned: true
    }
  : {};

const issueCsrfToken = (res) => {
  const token = generateCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    ...partitionedCookieOptions
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
  const hasRefreshCookie = Boolean(req.cookies?.refreshToken);

  if (!hasBearerToken && !hasRefreshCookie) {
    next();
    return;
  }

  if (!headerToken || !cookieToken) {
    logger.warn("CSRF token missing", {
      route: req.originalUrl,
      method: req.method,
      origin: req.headers.origin || "",
      userId: req.user?.id || ""
    });
    next(new ApiError(403, "Invalid or missing CSRF token", null, "CSRF_INVALID"));
    return;
  }

  const headerBuffer = Buffer.from(String(headerToken));
  const cookieBuffer = Buffer.from(String(cookieToken));
  const isValid =
    headerBuffer.length === cookieBuffer.length &&
    crypto.timingSafeEqual(headerBuffer, cookieBuffer);

  if (!isValid) {
    logger.warn("CSRF token mismatch", {
      route: req.originalUrl,
      method: req.method,
      origin: req.headers.origin || "",
      userId: req.user?.id || ""
    });
    next(new ApiError(403, "Invalid or missing CSRF token", null, "CSRF_INVALID"));
    return;
  }

  next();
};

module.exports = {
  CSRF_COOKIE_NAME,
  issueCsrfToken,
  csrfProtection
};
