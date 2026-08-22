import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut, Menu } from "lucide-react";
import NotificationCenter from "../common/NotificationCenter";
import ThemeToggle from "../common/ThemeToggle";
import topbarLogo from "../../assets/topbarlogo.svg";
import vertisVideo from "../../assets/vertis-video.mp4";
import { getMediaUrl } from "../../utils/media";
import { APP_NAME } from "../../config/appConfig";

const formatClock = (date) => ({
  date: new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date),
  day: new Intl.DateTimeFormat("en-US", {
    weekday: "long"
  }).format(date),
  time: new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date)
});

const LiveClockCard = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // A once-per-second re-render is cheap, but there is no reason to pay for
    // it in a background tab — the clock is re-synced on the way back.
    let timer = null;
    const start = () => {
      if (timer) return;
      setNow(new Date());
      timer = setInterval(() => setNow(new Date()), 1000);
    };
    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const clock = formatClock(now);

  return (
    <div className="hidden h-[74px] w-[164px] min-w-[164px] rounded-2xl border border-white/12 bg-white/[0.07] px-3 py-2 md:flex md:flex-col md:justify-center">
      <p className="brand-accent-text text-[11px] tabular-nums">{clock.date}</p>
      <p className="text-[11px] text-slate-300">{clock.day}</p>
      <p className="text-sm font-semibold text-white tabular-nums">{clock.time}</p>
    </div>
  );
};

const toTitleRole = (role = "") =>
  String(role || "user")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (value) => value.toUpperCase());

const toInitials = (name = "User") =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

const Topbar = ({ user, onLogout, title, onSelectModule, onToggleSidebar, sidebarCollapsed, navigationOpen, reduceMotion = false }) => {
  const [logoHovered, setLogoHovered] = useState(false);
  const [userHovered, setUserHovered] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const profilePhotoUrl = getMediaUrl(
    user?.profilePhoto?.url ||
      user?.profilePhoto?.path ||
      user?.profilePhoto?.filename ||
      user?.profilePhoto ||
      user?.profileImage ||
      user?.photo ||
      user?.photoUrl ||
      user?.avatar
  );
  const userName = user?.name || "User";
  const userRole = toTitleRole(user?.role);
  const userEmail = user?.email || "No email";
  const userMobile = user?.mobile || "Not provided";
  const userInitials = toInitials(userName);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profilePhotoUrl]);

  return (
    <header className="brand-topbar relative z-[80] mb-5 flex items-center justify-between overflow-visible rounded-2xl border border-white/10 bg-slate-950/65 px-3 py-3 backdrop-blur-2xl md:px-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-xl border border-white/15 bg-white/10 p-2 text-white md:hidden"
          aria-label="Open navigation menu"
          aria-expanded={navigationOpen ?? !sidebarCollapsed}
          aria-controls="mobile-primary-navigation"
        >
          <Menu size={18} />
        </button>
        <div
          className="relative hidden sm:block"
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
        >
          {/*
            The Momentum wheel used to run three infinite framer-motion
            animations at all times — a pulsing blur, a pulsing
            backdrop-blur ring, and a continuous rotation — which kept the
            compositor busy for the entire session on every page. It now sits
            still and turns only while the pointer is actually on it, driven
            by CSS so no React work happens per frame.
          */}
          <div
            className={`brand-momentum-mark relative flex h-16 w-16 items-center justify-center ${
              logoHovered && !reduceMotion ? "brand-momentum-mark--active" : ""
            }`}
          >
            <span aria-hidden="true" className="brand-momentum-mark__halo" />
            <span aria-hidden="true" className="brand-momentum-mark__ring" />
            <img
              src={topbarLogo}
              alt={`${APP_NAME} logo`}
              className="brand-momentum-mark__image relative z-10 h-12 w-12 object-contain"
            />
          </div>
          <AnimatePresence>
            {logoHovered ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="pointer-events-none absolute left-1 top-full z-[999] mt-3 w-72 overflow-hidden rounded-2xl border border-white/20 bg-slate-900/70 shadow-[0_18px_44px_rgba(2,6,23,0.65)] backdrop-blur-2xl"
              >
                <video
                  src={vertisVideo}
                  muted
                  loop
                  autoPlay
                  playsInline
                  preload="none"
                  className="h-40 w-full object-cover object-center"
                />
                <div className="border-t border-white/10 bg-black/45 px-3 py-2">
                  <p className="brand-accent-text text-[11px]">Wheel of Momentum</p>
                  <p className="text-xs text-slate-200">Always in Motion</p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Udupi Tollway Pvt Ltd</p>
          <h2 className="font-display text-base font-semibold text-white md:text-lg">{APP_NAME}</h2>
          <p className="brand-accent-text text-xs font-medium">{title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <LiveClockCard />
        <ThemeToggle />
        <NotificationCenter onSelectModule={onSelectModule} />
        <div
          className="relative hidden md:block"
          onMouseEnter={() => setUserHovered(true)}
          onMouseLeave={() => setUserHovered(false)}
        >
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-slate-900/70 text-xs font-semibold text-slate-200">
              {profilePhotoUrl && !avatarLoadFailed ? (
                <img
                  src={profilePhotoUrl}
                  alt={`${userName} profile`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  onError={() => setAvatarLoadFailed(true)}
                />
              ) : (
                userInitials
              )}
            </div>
            <div>
              <p className="text-xs text-slate-300">Signed in as</p>
              <p className="text-sm font-medium text-white">{userName}</p>
            </div>
          </div>
          <AnimatePresence>
            {userHovered ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="pointer-events-none absolute right-0 top-full z-[999] mt-3 w-72 overflow-hidden rounded-2xl border border-white/20 bg-slate-900/75 shadow-[0_18px_44px_rgba(2,6,23,0.65)] backdrop-blur-2xl"
              >
                <div className="border-b border-white/10 bg-white/5 px-4 py-3">
                  <p className="brand-accent-text text-[10px] uppercase tracking-[0.16em]">User Profile</p>
                </div>
                <div className="px-4 py-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-slate-900/80 text-base font-semibold text-slate-200">
                      {profilePhotoUrl && !avatarLoadFailed ? (
                        <img
                          src={profilePhotoUrl}
                          alt={`${userName} profile`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                          onError={() => setAvatarLoadFailed(true)}
                        />
                      ) : (
                        userInitials
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{userName}</p>
                      <p className="brand-accent-text text-xs">{userRole}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-200">
                    <p className="truncate">
                      <span className="text-slate-400">Email:</span> {userEmail}
                    </p>
                    <p>
                      <span className="text-slate-400">Mobile:</span> {userMobile}
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-2xl border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-100"
        >
          <span className="inline-flex items-center gap-1">
            <LogOut size={13} />
            Logout
          </span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;
