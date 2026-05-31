import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ParticleBackground from "../common/ParticleBackground";

const SIDEBAR_STORAGE_KEY = "sidebarCollapsed";
const DESKTOP_BREAKPOINT = 768;

const getInitialSidebarCollapsed = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
};

const AppShell = ({
  user,
  onLogout,
  activeModule,
  onSelectModule,
  children,
  title,
  sessionTimeoutMinutes = 30
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    let inactivityTimer = null;
    let countdownTimer = null;
    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;

    const clearTimers = () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };

    const schedule = () => {
      clearTimers();
      setShowTimeoutWarning(false);
      setCountdown(60);
      inactivityTimer = setTimeout(() => {
        setShowTimeoutWarning(true);
        let remaining = 60;
        countdownTimer = setInterval(() => {
          remaining -= 1;
          setCountdown(remaining);
          if (remaining <= 0) {
            clearTimers();
            onLogout();
          }
        }, 1000);
      }, timeoutMs);
    };

    const listener = () => {
      schedule();
    };

    ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((eventName) =>
      window.addEventListener(eventName, listener)
    );
    schedule();

    return () => {
      clearTimers();
      ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((eventName) =>
        window.removeEventListener(eventName, listener)
      );
    };
  }, [onLogout, sessionTimeoutMinutes]);

  const handleSidebarToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth < DESKTOP_BREAKPOINT) {
      setMobileMenuOpen((prev) => !prev);
      return;
    }
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-50">
      <ParticleBackground />
      <div className="relative z-10 flex min-h-screen">
        <motion.aside
          animate={{ width: sidebarCollapsed ? 80 : 280 }}
          transition={{ type: "spring", stiffness: 220, damping: 28 }}
          className="hidden shrink-0 overflow-hidden md:block"
        >
          <Sidebar
            user={user}
            collapsed={sidebarCollapsed}
            activeModule={activeModule}
            onSelectModule={(moduleKey) => {
              onSelectModule(moduleKey);
              setMobileMenuOpen(false);
            }}
          />
        </motion.aside>
        <AnimatePresence>
          {mobileMenuOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            >
              <motion.div
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ type: "spring", stiffness: 260, damping: 30 }}
                className="absolute inset-y-0 left-0 w-[280px] max-w-[86vw]"
                onClick={(event) => event.stopPropagation()}
              >
                <Sidebar
                  user={user}
                  mobile
                  activeModule={activeModule}
                  onSelectModule={(moduleKey) => {
                    onSelectModule(moduleKey);
                    setMobileMenuOpen(false);
                  }}
                />
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <main className="w-full flex-1 p-3 md:p-6">
          <Topbar
            user={user}
            onLogout={onLogout}
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={handleSidebarToggle}
            title={title}
          />
          <div className="min-h-[calc(100vh-120px)]">{children}</div>
        </main>
      </div>

      <AnimatePresence>
        {showTimeoutWarning ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/90 p-4"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-full max-w-md rounded-3xl border border-amber-400/35 bg-amber-500/10 p-7 text-center"
            >
              <h3 className="font-display text-2xl font-semibold text-amber-100">
                Session Timeout Warning
              </h3>
              <p className="mt-3 text-sm text-amber-50/85">
                No activity detected. Your session ends in {countdown} seconds.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowTimeoutWarning(false);
                  setCountdown(60);
                }}
                className="mt-6 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 px-5 py-3 text-sm font-semibold text-white"
              >
                Continue Session
              </button>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

export default AppShell;
