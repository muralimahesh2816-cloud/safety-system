const express = require("express");
const asyncHandler = require("../utils/async-handler");
const authMiddleware = require("../middleware/auth.middleware");
const { authorizePermission } = require("../middleware/rbac.middleware");
const Notification = require("../models/Notification");
const audit = require("../middleware/audit.middleware");
const { getPagination, buildPaginationMeta, hasPagination } = require("../utils/pagination");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  authorizePermission("notifications", "view"),
  asyncHandler(async (req, res) => {
    const filters = { user: req.user.id };
    if (req.query.read === "true") filters.read = true;
    if (req.query.read === "false") filters.read = false;

    const shouldPaginate = hasPagination(req.query);
    const pagination = getPagination(req.query, { defaultLimit: 25, maxLimit: 100 });
    let query = Notification.find(filters).sort({
      createdAt: -1
    });
    if (shouldPaginate) {
      query = query.skip(pagination.skip).limit(pagination.limit);
    }

    const [notifications, unreadCount, total] = await Promise.all([
      query,
      Notification.countDocuments({ user: req.user.id, read: false }),
      Notification.countDocuments(filters)
    ]);
    res.json({
      success: true,
      unreadCount,
      notifications,
      pagination: shouldPaginate
        ? buildPaginationMeta({ page: pagination.page, limit: pagination.limit, total })
        : { total, unpaginated: true }
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
