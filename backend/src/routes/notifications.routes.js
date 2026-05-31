const express = require("express");
const asyncHandler = require("../utils/async-handler");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const Notification = require("../models/Notification");
const audit = require("../middleware/audit.middleware");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  authorizePermission("notifications", "view"),
  asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.user.id }).sort({
      createdAt: -1
    });
    const unreadCount = notifications.filter((item) => !item.read).length;
    res.json({
      success: true,
      unreadCount,
      notifications
    });
  })
);

router.patch(
  "/:id/read",
  authMiddleware,
  authorizePermission("notifications", "update"),
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        user: req.user.id
      },
      {
        read: true
      },
      { new: true }
    );
    if (!notification) {
      res.status(404).json({ success: false, message: "Notification not found" });
      return;
    }
    await audit(req, "notification_read", "notifications", {}, notification._id);
    res.json({ success: true, notification });
  })
);

router.patch(
  "/read-all",
  authMiddleware,
  authorizePermission("notifications", "update"),
  asyncHandler(async (req, res) => {
    await Notification.updateMany(
      {
        user: req.user.id,
        read: false
      },
      {
        read: true
      }
    );
    await audit(req, "notification_read_all", "notifications", {});
    res.json({ success: true, message: "All notifications marked as read" });
  })
);

module.exports = router;
