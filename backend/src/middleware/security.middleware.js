const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const { env, isProduction } = require("../config/env");
const sanitizeMiddleware = require("./sanitize.middleware");
const ApiError = require("../utils/api-error");
const logger = require("../utils/logger");

const allowedRequestHeaders = [
  "Accept",
  "Content-Type",
  "Authorization",
  "X-CSRF-Token",
  "Idempotency-Key"
];

const getOrigin = (value) => {
  try {
    return value ? new URL(value).origin : "";
  } catch (_error) {
    return "";
  }
};

const applySecurityMiddleware = (app) => {
  const configuredOrigins = env.frontendUrl
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const developmentOrigins = isProduction
    ? []
    : ["http://localhost:3000", "http://127.0.0.1:3000", "http://localhost:3001", "http://127.0.0.1:3001"];
  const allowedOrigins = Array.from(new Set([...configuredOrigins, ...developmentOrigins]));
  const backendOrigin = getOrigin(env.backendPublicUrl);
  const mediaOrigins = Array.from(
    new Set([backendOrigin, "https://res.cloudinary.com"].filter(Boolean))
  );
  const connectOrigins = Array.from(new Set([...allowedOrigins, backendOrigin].filter(Boolean)));

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        logger.warn("CORS origin denied", { origin });
        callback(new ApiError(403, "Origin is not allowed", null, "CORS_BLOCKED"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: allowedRequestHeaders,
      optionsSuccessStatus: 204
    })
  );
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:", ...mediaOrigins],
          mediaSrc: ["'self'", "blob:", ...mediaOrigins],
          connectSrc: ["'self'", ...connectOrigins],
          frameAncestors: ["'self'", ...allowedOrigins]
        }
      }
    })
  );
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(self), geolocation=(self)");
    next();
  });
  app.use(compression());
  app.use(cookieParser());
  app.use(expressJsonLimit());
  app.use(expressUrlEncodedLimit());
  app.use(sanitizeMiddleware);
  app.use(hpp());
  app.use(
    rateLimit({
      windowMs: env.rateLimitWindowMs,
      max: env.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false
    })
  );
  app.use(morgan(isProduction ? "combined" : "dev"));
};

const expressJsonLimit = () => {
  // This helper keeps JSON/body parser configuration in one place.
  // eslint-disable-next-line global-require
  const express = require("express");
  return express.json({ limit: "10mb" });
};

const expressUrlEncodedLimit = () => {
  // eslint-disable-next-line global-require
  const express = require("express");
  return express.urlencoded({ extended: true, limit: "10mb" });
};

module.exports = applySecurityMiddleware;
module.exports.allowedRequestHeaders = allowedRequestHeaders;
