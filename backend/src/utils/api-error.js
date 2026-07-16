class ApiError extends Error {
  constructor(statusCode, message, details = null, code = "") {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.errorCode = code;
  }
}

module.exports = ApiError;
