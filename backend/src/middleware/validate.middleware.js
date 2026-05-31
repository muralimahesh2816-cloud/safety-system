const ApiError = require("../utils/api-error");

const validate =
  (schema, target = "body") =>
  (req, _res, next) => {
    const parsed = schema.safeParse(req[target]);
    if (!parsed.success) {
      next(
        new ApiError(400, "Validation failed", {
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message
          }))
        })
      );
      return;
    }

    req[target] = parsed.data;
    next();
  };

module.exports = validate;
