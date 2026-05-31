import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { notificationService } from "../../api/services";
import { formatDateTime } from "../../utils/format";

const NotificationCenter = () => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ unreadCount: 0, notifications: [] });
  const [lastUnread, setLastUnread] = useState(0);

  const fetchNotifications = async () => {
    try {
      const response = await notificationService.list();
      setData({
        unreadCount: response.unreadCount || 0,
        notifications: response.notifications || []
      });
    } catch (_error) {
      // Keep silent in UI and keep prior data.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 20000);
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unread = data.unreadCount || 0;
    if (
      unread > lastUnread &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      const latest = data.notifications.find((item) => !item.read);
      if (latest) {
        // Browser alert for real-time safety notifications.
        new Notification(latest.title, { body: latest.message });
      }
    }
    setLastUnread(unread);
  }, [data, lastUnread]);

  const unread = data.unreadCount || 0;

  const topItems = useMemo(() => data.notifications.slice(0, 12), [data.notifications]);

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setData((prev) => ({
        unreadCount: Math.max(0, prev.unreadCount - 1),
        notifications: prev.notifications.map((item) =>
          item._id === id ? { ...item, read: true } : item
        )
      }));
    } catch (_error) {
      // Ignore
    }
  };

  const markAll = async () => {
    try {
      await notificationService.markAllRead();
      setData((prev) => ({
        unreadCount: 0,
        notifications: prev.notifications.map((item) => ({ ...item, read: true }))
      }));
    } catch (_error) {
      // Ignore
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-2xl border border-white/15 bg-white/10 p-2.5 text-white transition hover:bg-white/20"
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            className="absolute right-0 top-12 z-50 w-[340px] rounded-3xl border border-white/15 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-100">Notification Center</h3>
              <button
                type="button"
                onClick={markAll}
                className="text-xs text-teal-300 hover:text-teal-200"
              >
                <span className="inline-flex items-center gap-1">
                  <CheckCheck size={13} />
                  Mark all
                </span>
              </button>
            </div>
            <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-400">Loading notifications...</p>
              ) : topItems.length === 0 ? (
                <p className="text-xs text-slate-400">No notifications yet.</p>
              ) : (
                topItems.map((notification) => (
                  <button
                    key={notification._id}
                    type="button"
                    onClick={() => markRead(notification._id)}
                    className={`w-full rounded-2xl border p-3 text-left ${
                      notification.read
                        ? "border-white/10 bg-white/5"
                        : "border-teal-400/40 bg-teal-400/10"
                    }`}
                  >
                    <p className="text-sm font-medium text-slate-100">{notification.title}</p>
                    <p className="mt-1 text-xs text-slate-300">{notification.message}</p>
                    <p className="mt-2 text-[11px] text-slate-400">
                      {formatDateTime(notification.createdAt)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default NotificationCenter;
