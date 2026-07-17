const AuditLog = require("../models/AuditLog");

const getActionType = (action = "") => {
  const normalized = String(action || "").toLowerCase();
  if (normalized.includes("login") || normalized.includes("logout") || normalized.includes("otp")) return "authentication";
  if (normalized.includes("upload")) return "upload";
  if (normalized.includes("delete") || normalized.includes("remove")) return "delete";
  if (normalized.includes("create")) return "create";
  if (normalized.includes("update") || normalized.includes("edit") || normalized.includes("reset")) return "update";
  if (normalized.includes("approve") || normalized.includes("check") || normalized.includes("recommend") || normalized.includes("return") || normalized.includes("complete")) return "workflow";
  if (normalized.includes("export") || normalized.includes("report")) return "report";
  return "activity";
};

const audit = async (req, action, module, metadata = {}, entityId = null, changes = {}) => {
  try {
    const actor = req.user?.id || (module === "auth" ? entityId : null) || metadata.actorId || null;
    await AuditLog.create({
      actor,
      actorName: req.user?.name || metadata.actorName || "",
      actorRole: req.user?.role || metadata.actorRole || "",
      action,
      actionType: changes.actionType || metadata.actionType || getActionType(action),
      module,
      entityId,
      metadata,
      previousValue: changes.previousValue || metadata.previousValue || null,
      newValue: changes.newValue || metadata.newValue || null,
      requestId: req.id || "",
      ip: req.ip || "",
      userAgent: req.headers?.["user-agent"] || ""
    });
  } catch (_error) {
    // Audit logging should never block user operations.
  }
};

module.exports = audit;
