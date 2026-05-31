const Notification = require("../models/Notification");
const User = require("../models/User");
const logger = require("../utils/logger");

const createNotification = async ({
  userId,
  type,
  title,
  message,
  data = {},
  priority = "medium"
}) => {
  if (!userId) return null;
  const notification = await Notification.create({
    user: userId,
    type,
    title,
    message,
    data,
    priority
  });

  if (process.env.ENABLE_EMAIL_ALERTS === "true") {
    try {
      const user = await User.findById(userId).select("email name");
      if (user?.email) {
        // Placeholder hook for provider integrations (SES/SendGrid/etc).
        logger.info("Email alert queued", {
          email: user.email,
          subject: `[Safety HSE] ${title}`
        });
      }
    } catch (_error) {
      // Notification delivery failures should not block transactional flow.
    }
  }

  return notification;
};

module.exports = {
  createNotification
};
