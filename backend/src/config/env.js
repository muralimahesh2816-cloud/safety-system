const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// First origin of FRONTEND_URL, which is a comma-separated CORS allow-list.
const resolvePublicAppUrl = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0] || "http://localhost:3000";

const env = {
  appName: process.env.APP_NAME || "Safety Management System",
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  backendPublicUrl:
    process.env.BACKEND_PUBLIC_URL || `http://localhost:${Number(process.env.PORT || 5000)}`,
  // The raw value, which is a comma-separated allow-list used for CORS.
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  // The single canonical origin to build user-facing links from. FRONTEND_URL
  // legitimately holds several origins (app domain + custom domain), so using
  // it whole produced links like "https://a.com,https://b.com/work?record=1".
  // Every link builder must use this; only CORS wants the full list.
  publicAppUrl: resolvePublicAppUrl(process.env.FRONTEND_URL),
  mongoUri: process.env.MONGODB_URI || "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "access-secret-change-me",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || "refresh-secret-change-me",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  // WhatsApp Business Cloud API (or another approved corporate provider).
  //
  // `enabled` is the master switch: with it off — which is the default, and the
  // state of every environment until real credentials are issued — the queue
  // still runs and still records delivery attempts, it just resolves them
  // through the `log` provider instead of calling out. That means the whole
  // assignment -> notification -> delivery path is exercised in development and
  // in tests without a live Meta account, and turning it on is a config change
  // rather than a code change.
  whatsapp: {
    enabled: String(process.env.WHATSAPP_ENABLED || "").toLowerCase() === "true",
    provider: process.env.WHATSAPP_PROVIDER || "log",
    accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "",
    apiVersion: process.env.WHATSAPP_API_VERSION || "v21.0",
    // Meta requires a pre-approved template for business-initiated messages.
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en",
    otpTemplate: process.env.WHATSAPP_OTP_TEMPLATE || "",
    assignmentTemplate: process.env.WHATSAPP_ASSIGNMENT_TEMPLATE || ""
  },
  // Which channel carries the login OTP. Mobile login needs it on the phone;
  // email remains available so an existing email-based sign-in keeps working.
  otpChannel: process.env.OTP_CHANNEL || "auto",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || "uploads"
  },
  smtp: {
    host: process.env.SMTP_HOST || "",
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.SMTP_FROM || process.env.SMTP_USER || ""
  },
  sessionTimeoutMinutes: Number(process.env.SESSION_TIMEOUT_MINUTES || 30),
  enforceOtpAuth: process.env.ENFORCE_OTP_AUTH === "true",
  workflowAdminOverrideEnabled: process.env.WORKFLOW_ADMIN_OVERRIDE_ENABLED === "true",
  allowLocalUploadsInProduction: process.env.ALLOW_LOCAL_UPLOADS_IN_PRODUCTION === "true",
  media: {
    gpsPolicy: ["optional", "required", "required_camera"].includes(process.env.GPS_EVIDENCE_POLICY)
      ? process.env.GPS_EVIDENCE_POLICY
      : "optional",
    accuracyWarningMeters: Number(process.env.MAX_ACCEPTABLE_GPS_ACCURACY_METERS || 100),
    locationRetentionDays: Number(process.env.MEDIA_LOCATION_RETENTION_DAYS || 0),
    mapProvider: process.env.MAP_PROVIDER || "none",
    reverseGeocodingProvider: process.env.REVERSE_GEOCODING_PROVIDER || (process.env.GOOGLE_GEOCODING_API_KEY ? "google" : "none"),
    reverseGeocodingApiUrl: process.env.REVERSE_GEOCODING_API_URL || (process.env.GOOGLE_GEOCODING_API_KEY ? "https://maps.googleapis.com/maps/api/geocode/json" : ""),
    reverseGeocodingApiKey: process.env.REVERSE_GEOCODING_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY || "",
    reverseGeocodingTimeoutMs: Number(process.env.GOOGLE_GEOCODING_TIMEOUT_MS || process.env.REVERSE_GEOCODING_TIMEOUT_MS || 10000)
  },
  backup: {
    provider: process.env.BACKUP_PROVIDER || "manual",
    storageUriConfigured: Boolean(process.env.BACKUP_STORAGE_URI),
    retentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 30)
  }
};

const isProduction = env.nodeEnv === "production";
const hasCloudinary = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

const validateEnvironment = () => {
  const errors = [];
  const warnings = [];

  if (!env.mongoUri) errors.push("MONGODB_URI is required.");
  if (!env.frontendUrl) errors.push("FRONTEND_URL is required.");
  if (!env.backendPublicUrl) errors.push("BACKEND_PUBLIC_URL is required.");

  if (
    !process.env.JWT_ACCESS_SECRET ||
    !process.env.JWT_REFRESH_SECRET ||
    env.jwtAccessSecret.includes("change-me") ||
    env.jwtRefreshSecret.includes("change-me")
  ) {
    const message = "JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be strong non-default values.";
    if (isProduction) errors.push(message);
    else warnings.push(message);
  }

  if (env.bcryptRounds < 10) {
    warnings.push("BCRYPT_ROUNDS should be at least 10.");
  }

  if (env.whatsapp.enabled) {
    // Fail loudly at boot rather than silently dropping every notification.
    if (env.whatsapp.provider === "meta" && (!env.whatsapp.accessToken || !env.whatsapp.phoneNumberId)) {
      errors.push(
        "WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are required when WHATSAPP_ENABLED=true with the meta provider."
      );
    }
  }

  if (isProduction) {
    if (!env.smtp.host || !env.smtp.user || !env.smtp.pass || !env.smtp.from) {
      errors.push("SMTP_HOST, SMTP_USER, SMTP_PASS, and SMTP_FROM are required in production for OTP/email delivery.");
    }
    if (!hasCloudinary && !env.allowLocalUploadsInProduction) {
      errors.push("Cloudinary credentials are required in production unless ALLOW_LOCAL_UPLOADS_IN_PRODUCTION=true.");
    }
  }

  if (errors.length) {
    throw new Error(`Environment validation failed: ${errors.join(" ")}`);
  }

  if (warnings.length) {
    // eslint-disable-next-line no-console
    console.warn(`Environment validation warnings: ${warnings.join(" ")}`);
  }
};

validateEnvironment();

module.exports = {
  env,
  isProduction,
  hasCloudinary,
  validateEnvironment,
  resolvePublicAppUrl
};
