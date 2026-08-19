const express = require("express");
const authRoutes = require("./auth.routes");
const dashboardRoutes = require("./dashboard.routes");
const userRoutes = require("./users.routes");
const workRoutes = require("./work.routes");
const hazardRoutes = require("./hazards.routes");
const trainingRoutes = require("./training.routes");
const reportRoutes = require("./reports.routes");
const settingsRoutes = require("./settings.routes");
const notificationRoutes = require("./notifications.routes");
const backupRoutes = require("./backup.routes");
const locationRoutes = require("./location.routes");
const enterpriseHseRoutes = require("./enterprise-hse.routes");
const certificateRoutes = require("./certificates.routes");

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/users", userRoutes);
router.use("/work-approvals", workRoutes);
router.use("/hazards", hazardRoutes);
router.use("/training", trainingRoutes);
router.use("/certificates", certificateRoutes);
router.use("/reports", reportRoutes);
router.use("/settings", settingsRoutes);
router.use("/notifications", notificationRoutes);
router.use("/backup", backupRoutes);
router.use("/location", locationRoutes);
router.use("/", enterpriseHseRoutes);

module.exports = router;
