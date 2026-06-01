const express = require("express");
const path = require("path");
const { env, isProduction } = require("./config/env");
const applySecurityMiddleware = require("./middleware/security.middleware");
const { csrfProtection } = require("./middleware/csrf.middleware");
const apiRoutes = require("./routes");
const workRoutes = require("./routes/work.routes");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

applySecurityMiddleware(app);

if (isProduction) {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      res.status(403).json({
        success: false,
        message: "HTTPS is required"
      });
      return;
    }
    next();
  });
}

const allowedOrigins = env.frontendUrl
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  "/uploads",
  (req, res, next) => {
    const requestOrigin = req.headers.origin;
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Vary", "Origin");
    }
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.resolve(process.cwd(), "uploads"))
);

const csrfExemptPaths = [
  "/api/v1/auth/login",
  "/api/v1/auth/register",
  "/api/v1/auth/refresh",
  "/api/v1/auth/csrf"
];

app.use((req, res, next) => {
  const isExempt = csrfExemptPaths.some((pathPrefix) => req.path.startsWith(pathPrefix));
  if (isExempt) {
    next();
    return;
  }
  csrfProtection(req, res, next);
});

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    status: "ok",
    service: "Safety HSE Enterprise API"
  });
});

app.use("/api/v1", apiRoutes);
app.use("/work", workRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
