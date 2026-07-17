const express = require("express");
const asyncHandler = require("../utils/async-handler");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const audit = require("../middleware/audit.middleware");
const { getBackupReadiness } = require("../services/backup.service");

const router = express.Router();

router.get(
  "/readiness",
  authMiddleware,
  authorizePermission("settings", "view"),
  asyncHandler(async (req, res) => {
    const readiness = getBackupReadiness();
    await audit(req, "backup_readiness_view", "settings", {
      backupProvider: readiness.backupProvider
    });
    res.json(readiness);
  })
);

module.exports = router;
