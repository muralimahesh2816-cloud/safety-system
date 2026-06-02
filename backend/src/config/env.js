const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 5000),
  backendPublicUrl:
    process.env.BACKEND_PUBLIC_URL || `http://localhost:${Number(process.env.PORT || 5000)}`,
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
  mongoUri: process.env.MONGODB_URI || "",
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || "access-secret-change-me",
  jwtRefreshSecret:
    process.env.JWT_REFRESH_SECRET || "refresh-secret-change-me",
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX || 300),
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    uploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || "uploads"
  },
  sessionTimeoutMinutes: Number(process.env.SESSION_TIMEOUT_MINUTES || 30)
};

const isProduction = env.nodeEnv === "production";
const hasCloudinary = Boolean(
  env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret
);

module.exports = {
  env,
  isProduction,
  hasCloudinary
};
