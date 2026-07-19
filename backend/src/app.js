const express = require("express");
const path = require("path");
const { env, isProduction } = require("./config/env");
const requestContext = require("./middleware/request-context.middleware");
const applySecurityMiddleware = require("./middleware/security.middleware");
const { csrfProtection } = require("./middleware/csrf.middleware");
const apiRoutes = require("./routes");
const workRoutes = require("./routes/work.routes");
const { findCloudinaryAssetByFilename } = require("./utils/uploads");
const { getHealthStatus } = require("./services/health.service");
const { notFoundHandler, errorHandler } = require("./middleware/error.middleware");

const app = express();

app.set("trust proxy", 1);
app.use(requestContext);
applySecurityMiddleware(app);

if (isProduction) {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      res.status(403).json({
        success: false,
        code: "HTTPS_REQUIRED",
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

const uploadDirectories = Array.from(
  new Set([
    path.resolve(process.cwd(), "uploads"),
    path.resolve(__dirname, "../../uploads"),
    path.resolve(__dirname, "../uploads")
  ])
);

const missingImagePlaceholder = (filename = "missing-file") => {
  const safeName = String(filename || "missing-file")
    .replace(/[<>&'"]/g, "")
    .slice(0, 80);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="760" viewBox="0 0 1200 760">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#020617"/>
      <stop offset="52%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#083344"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="18" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1200" height="760" rx="42" fill="url(#bg)"/>
  <circle cx="260" cy="190" r="120" fill="#14b8a6" opacity="0.12" filter="url(#glow)"/>
  <circle cx="960" cy="590" r="170" fill="#38bdf8" opacity="0.10" filter="url(#glow)"/>
  <rect x="260" y="190" width="680" height="380" rx="34" fill="#ffffff" opacity="0.06" stroke="#ffffff" stroke-opacity="0.18"/>
  <path d="M410 485l132-148 92 102 62-70 104 116H410z" fill="#5eead4" opacity="0.82"/>
  <circle cx="747" cy="310" r="45" fill="#f8fafc" opacity="0.72"/>
  <text x="600" y="625" text-anchor="middle" fill="#ecfeff" font-family="Arial, sans-serif" font-size="34" font-weight="700">Image Preview Unavailable</text>
  <text x="600" y="670" text-anchor="middle" fill="#94a3b8" font-family="Arial, sans-serif" font-size="22">${safeName}</text>
</svg>`;
};

const isImageRequest = (url = "") => /\.(png|jpe?g|webp|gif|avif|svg)$/i.test(url);
const isVideoRequest = (url = "") => /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(url);
const cloudinaryLookupCache = new Map();

const cleanUploadRequestPath = (filename = "") =>
  String(filename || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/^uploads\//i, "")
    .replace(/[^\w./-]/g, "");

const encodePathSegments = (value = "") =>
  value
    .split("/")
    .filter(Boolean)
    .map((part) => encodeURIComponent(part))
    .join("/");

const cloudinaryFallbackUrl = (filename = "", resourceType = "image") => {
  if (!env.cloudinary.cloudName) return "";
  const rootFolder = String(env.cloudinary.uploadFolder || "uploads")
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "") || "uploads";
  const relativePath = cleanUploadRequestPath(filename);
  if (!relativePath) return "";
  return `https://res.cloudinary.com/${env.cloudinary.cloudName}/${resourceType}/upload/${encodePathSegments(rootFolder)}/${encodePathSegments(relativePath)}`;
};

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
  ...uploadDirectories.map((directory) =>
    express.static(directory, {
      fallthrough: true,
      index: false,
      maxAge: isProduction ? "7d" : 0
    })
  ),
  async (req, res, next) => {
    const isImage = isImageRequest(req.path);
    const isVideo = isVideoRequest(req.path);
    if (!isImage && !isVideo) {
      next();
      return;
    }

    const resourceType = isVideo ? "video" : "image";
    const cacheKey = `${resourceType}:${req.path}`;
    let cloudinaryUrl = cloudinaryLookupCache.get(cacheKey);

    if (cloudinaryUrl === undefined) {
      cloudinaryUrl = await findCloudinaryAssetByFilename(req.path, resourceType);
      cloudinaryLookupCache.set(cacheKey, cloudinaryUrl || "");
    }

    if (!cloudinaryUrl) {
      cloudinaryUrl = cloudinaryFallbackUrl(req.path, resourceType);
    }

    if (cloudinaryUrl) {
      res.redirect(302, cloudinaryUrl);
      return;
    }

    if (isImage) {
      res.status(200).type("image/svg+xml").send(missingImagePlaceholder(path.basename(req.path)));
      return;
    }

    next();
  }
);

const csrfExemptPaths = [
  "/api/v1/auth/login",
  "/api/v1/auth/verify-otp",
  "/api/v1/auth/resend-otp",
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

const healthHandler = async (_req, res, next) => {
  try {
    const health = await getHealthStatus();
    res.status(health.success ? 200 : 503).json(health);
  } catch (error) {
    next(error);
  }
};

app.get("/health", healthHandler);
app.get("/api/v1/health", healthHandler);

app.get("/version", (_req, res) => {
  res.json({
    success: true,
    service: `${env.appName} API`,
    environment: env.nodeEnv,
    buildVersion: process.env.RENDER_GIT_COMMIT || process.env.BUILD_VERSION || "local"
  });
});

app.use("/api/v1", apiRoutes);
app.use("/work", workRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
