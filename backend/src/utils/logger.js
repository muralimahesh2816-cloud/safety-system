/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const levels = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR"
};

const categories = {
  app: "app",
  auth: "auth",
  api: "api",
  upload: "upload",
  error: "error",
  database: "database"
};

const LOG_DIR = process.env.LOG_DIR || path.resolve(process.cwd(), "logs");
const LOG_TO_FILE = String(process.env.LOG_TO_FILE || "true").toLowerCase() !== "false";
const SECRET_KEYS = ["password", "token", "secret", "authorization", "cookie", "otp", "hash"];

const stamp = () => new Date().toISOString();
const dateKey = () => new Date().toISOString().slice(0, 10);

const redact = (value) => {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;

  return Object.entries(value).reduce((acc, [key, entry]) => {
    const lowerKey = key.toLowerCase();
    acc[key] = SECRET_KEYS.some((secret) => lowerKey.includes(secret)) ? "[REDACTED]" : redact(entry);
    return acc;
  }, {});
};

const ensureLogDirectory = () => {
  if (!LOG_TO_FILE) return false;
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    return true;
  } catch (_error) {
    return false;
  }
};

const writeFileLog = (category, payload) => {
  if (!ensureLogDirectory()) return;
  const filePath = path.join(LOG_DIR, `${category}-${dateKey()}.log`);
  fs.promises.appendFile(filePath, `${JSON.stringify(payload)}\n`).catch(() => {
    // File logging should never break request handling.
  });
};

const log = (level, message, metadata = {}, category = categories.app) => {
  const safeMetadata = redact(metadata);
  const payload = {
    at: stamp(),
    level: levels[level],
    category,
    message,
    metadata: safeMetadata || {}
  };

  const line = `[${payload.at}] ${payload.level} ${category} ${message}${
    safeMetadata && Object.keys(safeMetadata).length ? ` ${JSON.stringify(safeMetadata)}` : ""
  }`;

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  writeFileLog(category, payload);
  if (level === "error" && category !== categories.error) {
    writeFileLog(categories.error, payload);
  }
};

module.exports = {
  info: (message, metadata, category = categories.app) => log("info", message, metadata, category),
  warn: (message, metadata, category = categories.app) => log("warn", message, metadata, category),
  error: (message, metadata, category = categories.error) => log("error", message, metadata, category),
  auth: (level, message, metadata) => log(level, message, metadata, categories.auth),
  api: (level, message, metadata) => log(level, message, metadata, categories.api),
  upload: (level, message, metadata) => log(level, message, metadata, categories.upload),
  database: (level, message, metadata) => log(level, message, metadata, categories.database),
  categories
};
