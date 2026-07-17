const fs = require("fs");
const path = require("path");
const { env, hasCloudinary } = require("../config/env");

const inspectDirectory = (directory) => {
  try {
    fs.accessSync(directory, fs.constants.R_OK);
    return { path: directory, exists: true, readable: true };
  } catch (_error) {
    return { path: directory, exists: fs.existsSync(directory), readable: false };
  }
};

const getLocalUploadDirectories = () =>
  Array.from(
    new Set([
      path.resolve(process.cwd(), "uploads"),
      path.resolve(__dirname, "../../uploads"),
      path.resolve(__dirname, "../uploads")
    ])
  ).map(inspectDirectory);

const getBackupReadiness = () => {
  const localUploadDirectories = getLocalUploadDirectories();
  const hasReadableLocalUploads = localUploadDirectories.some((item) => item.readable);
  const uploadProvider = hasCloudinary ? "cloudinary" : "local";

  return {
    success: true,
    generatedAt: new Date().toISOString(),
    environment: env.nodeEnv,
    backupProvider: env.backup.provider,
    retentionDays: env.backup.retentionDays,
    targets: {
      mongodb: {
        status: env.mongoUri ? "ready" : "missing_configuration",
        source: "MongoDB Atlas",
        uriConfigured: Boolean(env.mongoUri),
        recommendedStrategy: "scheduled mongodump or Atlas scheduled backups"
      },
      uploadedFiles: {
        status: hasCloudinary || hasReadableLocalUploads ? "ready" : "attention_required",
        provider: uploadProvider,
        cloudinaryConfigured: hasCloudinary,
        localDirectories: localUploadDirectories,
        recommendedStrategy: hasCloudinary
          ? "export Cloudinary assets by upload folder/public id"
          : "archive readable local upload directories"
      },
      reports: {
        status: "ready",
        source: "application-generated",
        recommendedStrategy: "regenerate from MongoDB and uploaded media references"
      },
      configuration: {
        status: "ready",
        storageUriConfigured: env.backup.storageUriConfigured,
        secretsExcludedFromApi: true,
        requiredEnvironment: [
          "MONGODB_URI",
          "FRONTEND_URL",
          "BACKEND_PUBLIC_URL",
          "JWT_ACCESS_SECRET",
          "JWT_REFRESH_SECRET",
          "SMTP_HOST",
          "SMTP_USER",
          "SMTP_PASS",
          "CLOUDINARY_CLOUD_NAME",
          "CLOUDINARY_API_KEY",
          "CLOUDINARY_API_SECRET"
        ],
        optionalFutureEnvironment: [
          "BACKUP_PROVIDER",
          "BACKUP_STORAGE_URI",
          "BACKUP_RETENTION_DAYS"
        ]
      }
    },
    migrationContract: {
      storageAgnostic: true,
      infrastructureLockedIn: false,
      notes: [
        "No backup job is executed by this endpoint.",
        "Future HO backup adapters should implement the same target contract."
      ]
    }
  };
};

module.exports = {
  getBackupReadiness
};
