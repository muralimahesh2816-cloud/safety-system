const logger = require("../utils/logger");

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
};

const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  if (statusCode >= 500) {
    logger.error(error.message, { stack: error.stack });
  }

  res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    details: error.details || null
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
