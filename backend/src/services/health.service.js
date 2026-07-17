const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const SessionToken = require("../models/SessionToken");
const { env, hasCloudinary, isProduction } = require("../config/env");
const { getEmailQueueStatus } = require("./email.service");

const packageJson = require("../../../package.json");

const connectionStates = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting"
};

const canAccessStorage = async () => {
  const uploadRoot = path.resolve(process.cwd(), "uploads");
  try {
    await fs.promises.mkdir(uploadRoot, { recursive: true });
    await fs.promises.access(uploadRoot, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (_error) {
    return false;
  }
};

const getHealthStatus = async () => {
  const mongoState = connectionStates[mongoose.connection.readyState] || "unknown";
  const storageWritable = await canAccessStorage();
  const now = new Date();
  let activeSessions = null;

  try {
    activeSessions = await SessionToken.countDocuments({
      revokedAt: null,
      expiresAt: { $gt: now }
    });
  } catch (_error) {
    activeSessions = null;
  }

  const checks = {
    backend: "ok",
    mongodb: mongoState,
    uploadService: hasCloudinary ? "cloudinary_configured" : storageWritable ? "local_storage_ready" : "storage_unavailable",
    emailService: env.smtp.host && env.smtp.user ? "configured" : "not_configured",
    storage: storageWritable ? "writable" : "unavailable"
  };

  const healthy =
    mongoState === "connected" &&
    checks.backend === "ok" &&
    checks.storage !== "unavailable";

  return {
    success: healthy,
    status: healthy ? "ok" : "degraded",
    service: "Safety HSE Enterprise API",
    timestamp: now.toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: env.nodeEnv,
    production: isProduction,
    buildVersion: process.env.RENDER_GIT_COMMIT || process.env.BUILD_VERSION || packageJson.version,
    apiVersion: packageJson.version,
    activeSessions,
    emailQueue: getEmailQueueStatus(),
    checks
  };
};

module.exports = {
  getHealthStatus
};
