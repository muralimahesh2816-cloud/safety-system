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

const applySecurityMiddleware = (app) => {
  const allowedOrigins = env.frontendUrl
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("CORS policy denied this origin"));
      },
      credentials: true
    })
  );
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: "cross-origin" }
    })
  );
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
