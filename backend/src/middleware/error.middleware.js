const logger = require("../utils/logger");

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    code: "ROUTE_NOT_FOUND",
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    details: null,
    requestId: req.id || res.locals.requestId || null
  });
};

const multerMessages = {
  LIMIT_FILE_SIZE: "File size exceeds the allowed limit",
  LIMIT_FILE_COUNT: "Too many files uploaded",
  LIMIT_UNEXPECTED_FILE: "Unexpected upload field"
};

const errorHandler = (error, req, res, _next) => {
  const isMulterError = Boolean(error?.code && multerMessages[error.code]);
  const statusCode = error.statusCode || (isMulterError ? 400 : 500);
  const rawMessage = isMulterError
    ? multerMessages[error.code]
    : error.message || "Internal server error";
  const isProduction = process.env.NODE_ENV === "production";
  const message = statusCode >= 500 && isProduction ? "Internal server error" : rawMessage;
  const responseCode =
    error.errorCode ||
    (isMulterError ? error.code : null) ||
    (statusCode === 401 ? "UNAUTHORIZED" : null) ||
    (statusCode === 403 ? "FORBIDDEN" : null) ||
    (statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_FAILED");

  if (statusCode >= 500) {
    logger.error(rawMessage, {
      requestId: req.id || res.locals.requestId || null,
      route: req.originalUrl,
      method: req.method,
      userId: req.user?.id || "",
      stack: error.stack
    });
  }

  res.status(statusCode).json({
    success: false,
    code: responseCode,
    message,
    details: error.details || null,
    requestId: req.id || res.locals.requestId || null
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
