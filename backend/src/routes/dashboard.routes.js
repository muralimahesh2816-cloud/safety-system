const express = require("express");
const asyncHandler = require("../utils/async-handler");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const { getDashboardSummary } = require("../services/dashboard.service");

const router = express.Router();

router.get(
  "/summary",
  authMiddleware,
  authorizePermission("dashboard", "view"),
  asyncHandler(async (req, res) => {
    const summary = await getDashboardSummary(req.user);
    res.json({
      success: true,
      ...summary
    });
  })
);

module.exports = router;
