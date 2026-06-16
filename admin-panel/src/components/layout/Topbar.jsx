import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { LogOut } from "lucide-react";
import NotificationCenter from "../common/NotificationCenter";
import ThemeToggle from "../common/ThemeToggle";
import topbarLogo from "../../assets/topbarlogo.svg";
import vertisVideo from "../../assets/vertis-video.mp4";
import { getMediaUrl } from "../../utils/media";

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
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const clock = formatClock(now);

  return (
    <div className="hidden h-[74px] w-[164px] min-w-[164px] rounded-2xl border border-white/15 bg-white/10 px-3 py-2 shadow-[0_0_28px_rgba(45,212,191,0.2)] backdrop-blur-2xl md:flex md:flex-col md:justify-center">
      <p className="text-[11px] text-teal-200 tabular-nums">{clock.date}</p>
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

const Topbar = ({ user, onLogout, title }) => {
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
    <header className="relative z-[80] mb-5 flex items-center justify-between overflow-visible rounded-2xl border border-white/10 bg-slate-950/65 px-3 py-3 backdrop-blur-2xl md:px-5">
      <div className="flex items-center gap-3">
        <div
          className="relative hidden sm:block"
          onMouseEnter={() => setLogoHovered(true)}
          onMouseLeave={() => setLogoHovered(false)}
        >
          <div className="relative flex h-16 w-16 items-center justify-center">
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full bg-cyan-300/15 blur-xl"
              animate={
                logoHovered
                  ? { opacity: [0.25, 0.55, 0.25], scale: [1, 1.1, 1] }
                  : { opacity: [0.2, 0.45, 0.2], scale: [1, 1.06, 1] }
              }
              transition={
                { duration: logoHovered ? 1.8 : 3, ease: "easeInOut", repeat: Infinity }
              }
            />
            <motion.div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[14%] rounded-full border border-white/25 bg-white/5 backdrop-blur-sm"
              animate={{
                opacity: logoHovered ? 0.65 : 0.45,
                scale: logoHovered ? [1, 1.05, 1] : [1, 1.03, 1]
              }}
              transition={{ duration: logoHovered ? 1.8 : 3.5, ease: "easeInOut", repeat: Infinity }}
            />
            <motion.div
              className="relative z-10"
              animate={{ rotate: 360, scale: logoHovered ? 1.05 : 1 }}
              transition={
                logoHovered
                  ? { duration: 6.5, ease: "linear", repeat: Infinity }
                  : { duration: 9.5, ease: "linear", repeat: Infinity }
              }
            >
              <img
                src={topbarLogo}
                alt="Momentum Safety logo"
                className="h-12 w-12 object-contain drop-shadow-[0_0_22px_rgba(45,212,191,0.42)]"
              />
            </motion.div>
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
                  preload="metadata"
                  className="h-40 w-full object-cover object-center"
                />
                <div className="border-t border-white/10 bg-black/45 px-3 py-2">
                  <p className="text-[11px] text-teal-200">Wheel of Momentum</p>
                  <p className="text-xs text-slate-200">Always in Motion</p>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-300">Udupi Tollway Pvt Ltd</p>
          <h2 className="font-display text-base font-semibold text-white md:text-lg">Safety HSE Enterprise System</h2>
          <p className="text-xs text-teal-200">{title}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <LiveClockCard />
        <ThemeToggle />
        <NotificationCenter />
        <div
          className="relative hidden md:block"
          onMouseEnter={() => setUserHovered(true)}
          onMouseLeave={() => setUserHovered(false)}
        >
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-slate-900/70 text-xs font-semibold text-teal-100">
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
                  <p className="text-[10px] uppercase tracking-[0.16em] text-teal-200">User Profile</p>
                </div>
                <div className="px-4 py-4">
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-slate-900/80 text-base font-semibold text-teal-100">
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
                      <p className="text-xs text-cyan-200">{userRole}</p>
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
