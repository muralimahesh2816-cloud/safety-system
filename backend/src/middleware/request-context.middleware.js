const crypto = require("crypto");
const logger = require("../utils/logger");

const getRequestId = (req) => {
  const incoming = req.headers["x-request-id"];
  const cleanIncoming = String(Array.isArray(incoming) ? incoming[0] : incoming || "")
    .trim()
    .replace(/[^\w-]/g, "")
    .slice(0, 80);
  return cleanIncoming || crypto.randomUUID();
};

const requestContext = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  const requestId = getRequestId(req);

  req.id = requestId;
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    logger.api("info", "request_completed", {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
      ip: req.ip,
      userId: req.user?.id || ""
    });
  });

  next();
};

module.exports = requestContext;
