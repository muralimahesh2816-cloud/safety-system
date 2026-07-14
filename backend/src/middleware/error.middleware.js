const logger = require("../utils/logger");

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

const multerMessages = {
  LIMIT_FILE_SIZE: "File size exceeds the allowed limit",
  LIMIT_FILE_COUNT: "Too many files uploaded",
  LIMIT_UNEXPECTED_FILE: "Unexpected upload field"
};

const errorHandler = (error, _req, res, _next) => {
  const isMulterError = Boolean(error?.code && multerMessages[error.code]);
  const statusCode = error.statusCode || (isMulterError ? 400 : 500);
  const message = isMulterError
    ? multerMessages[error.code]
    : error.message || "Internal server error";
  if (statusCode >= 500) {
    logger.error(error.message, { stack: error.stack });
  }

  res.status(statusCode).json({
    success: false,
    message,
    details: error.details || null
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
