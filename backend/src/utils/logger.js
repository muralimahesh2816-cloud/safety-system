/* eslint-disable no-console */
const levels = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR"
};

const stamp = () => new Date().toISOString();

const log = (level, message, metadata) => {
  const payload = metadata ? ` ${JSON.stringify(metadata)}` : "";
  console.log(`[${stamp()}] ${levels[level]} ${message}${payload}`);
};

module.exports = {
  info: (message, metadata) => log("info", message, metadata),
  warn: (message, metadata) => log("warn", message, metadata),
  error: (message, metadata) => log("error", message, metadata)
};
