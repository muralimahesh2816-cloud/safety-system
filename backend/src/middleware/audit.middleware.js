const AuditLog = require("../models/AuditLog");

const audit = async (req, action, module, metadata = {}, entityId = null) => {
  try {
    await AuditLog.create({
      actor: req.user?.id || null,
      action,
      module,
      entityId,
      metadata
    });
  } catch (_error) {
    // Audit logging should never block user operations.
  }
};

module.exports = audit;
