const crypto = require("crypto");
const { env, isProduction } = require("../config/env");
const ApiError = require("../utils/api-error");
const logger = require("../utils/logger");

const CSRF_COOKIE_NAME = "hse_csrf_token";
const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"];
const CSRF_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const getCsrfSecret = () =>
  env.jwtAccessSecret || env.jwtRefreshSecret || "csrf-development-secret";

const timingSafeStringEqual = (left = "", right = "") => {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
};

const signCsrfPayload = (payload) =>
  crypto.createHmac("sha256", getCsrfSecret()).update(payload).digest("base64url");

const generateCsrfToken = () => {
  const payload = `${Date.now()}.${crypto.randomBytes(24).toString("hex")}`;
  return `${payload}.${signCsrfPayload(payload)}`;
};

const isSignedCsrfTokenValid = (token = "") => {
  const parts = String(token).split(".");
  if (parts.length !== 3) return false;

  const [timestamp, random, signature] = parts;
  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt) || Date.now() - issuedAt > CSRF_TOKEN_TTL_MS) {
    return false;
  }

  const payload = `${timestamp}.${random}`;
  return timingSafeStringEqual(signature, signCsrfPayload(payload));
};

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

  if (!headerToken) {
    logger.warn("CSRF token missing", {
      route: req.originalUrl,
      method: req.method,
      origin: req.headers.origin || "",
      userId: req.user?.id || ""
    });
    next(new ApiError(403, "Invalid or missing CSRF token", null, "CSRF_INVALID"));
    return;
  }

  const isValid =
    isSignedCsrfTokenValid(headerToken) ||
    (cookieToken && timingSafeStringEqual(headerToken, cookieToken));

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
