import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, CheckCheck, ClipboardCheck, GraduationCap, ShieldAlert, UserRound, Wrench } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { notificationService } from "../../api/services";
import { formatDateTime } from "../../utils/format";

const colorClasses = {
  blue: "border-sky-400/35 bg-sky-500/10 text-sky-100",
  orange: "border-orange-400/35 bg-orange-500/10 text-orange-100",
  green: "border-emerald-400/35 bg-emerald-500/10 text-emerald-100",
  red: "border-rose-400/35 bg-rose-500/10 text-rose-100"
};

const typeIcons = {
  work: ClipboardCheck,
  work_approval: ClipboardCheck,
  hazard: ShieldAlert,
  hazards: ShieldAlert,
  training: GraduationCap,
  user: UserRound,
  users: UserRound,
  system: Wrench
};

const getGroupLabel = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startYesterday = new Date(startToday);
  startYesterday.setDate(startToday.getDate() - 1);
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - 7);
  if (date >= startToday) return "Today";
  if (date >= startYesterday) return "Yesterday";
  if (date >= startWeek) return "This Week";
  return "Earlier";
};

const groupNotifications = (items = []) =>
  items.reduce((acc, item) => {
    const label = getGroupLabel(item.createdAt);
    if (!acc[label]) acc[label] = [];
    acc[label].push(item);
    return acc;
  }, {});

const normalizeModule = (notification = {}) => {
  const raw = String(notification.module || notification.relatedModule || notification.type || "").toLowerCase();
  if (raw.includes("work")) return "work";
  if (raw.includes("hazard")) return "hazards";
  if (raw.includes("training")) return "training";
  if (raw.includes("user")) return "users";
  if (raw.includes("report")) return "reports";
  return "";
};

const POLL_INTERVAL_MS = 60000;

const NotificationCenter = ({ onSelectModule }) => {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("unread");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ unreadCount: 0, notifications: [] });
  const lastUnreadRef = useRef(0);

  const fetchNotifications = useCallback(async () => {
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
  }, []);

  // Opening the panel is a real user gesture, which is both the only moment a
  // desktop-notification permission prompt is appropriate (browsers suppress
  // or penalise prompts fired on page load) and a good moment to re-sync.
  const togglePanel = useCallback(() => {
    setOpen((value) => {
      const next = !value;
      if (next) {
        fetchNotifications();
        if ("Notification" in window && Notification.permission === "default") {
          Notification.requestPermission().catch(() => {});
        }
      }
      return next;
    });
  }, [fetchNotifications]);

  // Polling strategy: a 60s cadence that pauses entirely while the tab is
  // hidden and re-syncs the moment it comes back, plus an immediate refresh
  // when the panel is opened. The previous unconditional 30s interval kept
  // querying on behalf of every backgrounded tab a user had left open.
  useEffect(() => {
    let timer = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (!document.hidden) fetchNotifications();
      }, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        stop();
        return;
      }
      fetchNotifications();
      start();
    };

    fetchNotifications();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // fetchNotifications is stable for the component's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desktop notification on a genuinely new unread item. `lastUnreadRef` is a
  // ref rather than state so this effect does not schedule an extra render
  // pass on every poll just to record the count it already saw.
  useEffect(() => {
    const unread = data.unreadCount || 0;
    const previous = lastUnreadRef.current;
    lastUnreadRef.current = unread;

    if (unread <= previous) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    const latest = data.notifications.find((item) => !item.read);
    if (latest) new Notification(latest.title, { body: latest.message });
  }, [data]);

  const unread = data.unreadCount || 0;
  const filteredItems = useMemo(() => {
    const items = data.notifications || [];
    return items
      .filter((item) => (activeTab === "unread" ? !item.read : item.read))
      .slice(0, 18);
  }, [activeTab, data.notifications]);
  const grouped = useMemo(() => groupNotifications(filteredItems), [filteredItems]);
  const groupOrder = ["Today", "Yesterday", "This Week", "Earlier"].filter((label) => grouped[label]?.length);

  const markRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setData((prev) => ({
        unreadCount: Math.max(0, prev.unreadCount - 1),
        notifications: prev.notifications.map((item) =>
          item._id === id ? { ...item, read: true, readAt: new Date().toISOString() } : item
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
        notifications: prev.notifications.map((item) => ({ ...item, read: true, readAt: new Date().toISOString() }))
      }));
    } catch (_error) {
      // Ignore
    }
  };

  const handleOpenNotification = async (notification) => {
    if (!notification.read) await markRead(notification._id);
    const moduleKey = normalizeModule(notification);
    if (moduleKey && onSelectModule) onSelectModule(moduleKey);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={togglePanel}
        className="relative rounded-2xl border border-white/15 bg-white/10 p-2.5 text-white transition hover:bg-white/20"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
      >
        <Bell size={18} />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold shadow-[0_0_18px_rgba(249,115,22,.55)]">
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
            className="absolute right-0 top-12 z-50 w-[380px] max-w-[calc(100vw-1rem)] rounded-3xl border border-white/15 bg-slate-950/92 p-4 shadow-2xl backdrop-blur-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Notification Center</h3>
                <p className="text-[11px] text-slate-400">Polling every 30 seconds, Socket.IO ready later</p>
              </div>
              <button
                type="button"
                onClick={markAll}
                className="rounded-xl border border-teal-300/20 bg-teal-400/10 px-2.5 py-1.5 text-xs text-teal-200 hover:bg-teal-400/15"
              >
                <span className="inline-flex items-center gap-1">
                  <CheckCheck size={13} />
                  Mark all
                </span>
              </button>
            </div>

            <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-white/5 p-1">
              {["unread", "read"].map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold capitalize transition ${
                    activeTab === tab ? "bg-white/15 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
              {loading ? (
                <p className="text-xs text-slate-400">Loading notifications...</p>
              ) : filteredItems.length === 0 ? (
                <p className="text-xs text-slate-400">No {activeTab} notifications.</p>
              ) : (
                groupOrder.map((group) => (
                  <div key={group}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{group}</p>
                    <div className="space-y-2">
                      {grouped[group].map((notification) => {
                        const Icon = typeIcons[notification.module] || typeIcons[notification.type] || Bell;
                        const tone = colorClasses[notification.color] || colorClasses.blue;
                        return (
                          <button
                            key={notification._id}
                            type="button"
                            onClick={() => handleOpenNotification(notification)}
                            className={`w-full rounded-2xl border p-3 text-left transition hover:bg-white/10 ${
                              notification.read ? "border-white/10 bg-white/5" : tone
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`rounded-xl border p-2 ${tone}`}>
                                <Icon size={15} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-slate-100">{notification.title}</span>
                                <span className="mt-1 block text-xs leading-5 text-slate-300">{notification.message}</span>
                                <span className="mt-2 block text-[11px] text-slate-400">
                                  {formatDateTime(notification.createdAt)}
                                </span>
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
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
