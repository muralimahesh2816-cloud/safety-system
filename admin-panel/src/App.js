import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "./hooks/useAuth";
import ErrorBoundary from "./components/common/ErrorBoundary";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import ParticleBackground from "./components/common/ParticleBackground";
import SafetyLogo from "./components/brand/SafetyLogo";
import MomentumSafetyBackground from "./components/visuals/MomentumSafetyBackground";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import WorkApprovalsPage from "./pages/WorkApprovalsPage";
import HazardsPage from "./pages/HazardsPage";
import TrainingPage from "./pages/TrainingPage";
import UsersPage from "./pages/UsersPage";
import ReportsPage from "./pages/ReportsPage";
import SystemHealthPage from "./pages/SystemHealthPage";
import SettingsPage from "./pages/SettingsPage";
import { settingsService } from "./api/services";
import { IMAGE_PLACEHOLDER_URL } from "./utils/media";
import { canAccessModule } from "./utils/permissions";

const moduleTitles = {
  dashboard: "Executive Dashboard",
  work: "Work Approval Center",
  hazards: "Hazard Control Hub",
  training: "Training Streaming Portal",
  users: "User Governance",
  reports: "Enterprise Reporting",
  health: "System Health",
  settings: "System Configuration"
};

const SIDEBAR_STORAGE_KEY = "sidebarCollapsed";
const DESKTOP_BREAKPOINT = 768;

const getInitialSidebarCollapsed = () => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
};

const ModuleGuard = ({ user, moduleKey, children }) => {
  const canView = canAccessModule(user, moduleKey);
  if (canView) return children;
  return (
    <div className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-8 text-center">
      <h3 className="text-xl font-semibold text-amber-100">Access Denied</h3>
      <p className="mt-2 text-sm text-amber-50/80">
        Your role does not have permission to view this module.
      </p>
    </div>
  );
};

const AppContent = () => {
  const { user, loading, isAuthenticated, login, verifyOtp, resendOtp, logout } = useAuth();
  const [activeModule, setActiveModule] = useState("dashboard");
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarCollapsed);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const pageContentRef = useRef(null);
  const lastScrollTopRef = useRef(0);
  const scrollStopTimerRef = useRef(null);
  const shouldHideTopbarForModule = ["work", "hazards", "training"].includes(activeModule);

  const page = useMemo(() => {
    switch (activeModule) {
      case "work":
        return <WorkApprovalsPage user={user} />;
      case "hazards":
        return <HazardsPage user={user} />;
      case "training":
        return <TrainingPage user={user} />;
      case "users":
        return <UsersPage currentUser={user} />;
      case "reports":
        return <ReportsPage />;
      case "health":
        return <SystemHealthPage />;
      case "settings":
        return <SettingsPage user={user} />;
      case "dashboard":
      default:
        return <DashboardPage onModuleSelect={setActiveModule} />;
    }
  }, [activeModule, user]);

  useEffect(() => {
    const fetchTimeout = async () => {
      if (!user) return;
      try {
        const response = await settingsService.get();
        const timeout = response?.settings?.security?.sessionTimeout;
        if (timeout) setSessionTimeoutMinutes(timeout);
      } catch (_error) {
        setSessionTimeoutMinutes(30);
      }
    };
    fetchTimeout();
  }, [user]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (scrollStopTimerRef.current) {
      clearTimeout(scrollStopTimerRef.current);
      scrollStopTimerRef.current = null;
    }
    lastScrollTopRef.current = 0;
    setTopbarVisible(!shouldHideTopbarForModule);
    if (pageContentRef.current) {
      pageContentRef.current.scrollTop = 0;
    }
  }, [activeModule, shouldHideTopbarForModule]);

  useEffect(
    () => () => {
      if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    },
    []
  );

  useEffect(() => {
    const handleUploadImageError = (event) => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement)) return;
      const source = image.currentSrc || image.src || "";
      if (!source.includes("/uploads/")) return;
      if (image.dataset.hseFallbackApplied === "true") return;
      image.dataset.hseFallbackApplied = "true";
      image.src = IMAGE_PLACEHOLDER_URL;
    };

    window.addEventListener("error", handleUploadImageError, true);
    return () => window.removeEventListener("error", handleUploadImageError, true);
  }, []);

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
            logout();
          }
        }, 1000);
      }, timeoutMs);
    };

    const listener = () => schedule();
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
  }, [logout, sessionTimeoutMinutes]);

  const handleSidebarToggle = () => {
    if (typeof window !== "undefined" && window.innerWidth < DESKTOP_BREAKPOINT) {
      setMobileSidebarOpen((prev) => !prev);
      return;
    }
    setSidebarCollapsed((prev) => !prev);
  };

  const handleModuleSelect = (moduleKey) => {
    setActiveModule(moduleKey);
    setMobileSidebarOpen(false);
  };

  const handlePageScroll = (event) => {
    if (shouldHideTopbarForModule) {
      setTopbarVisible(false);
      return;
    }

    const nextScrollTop = Math.max(0, event.currentTarget.scrollTop);
    const delta = nextScrollTop - lastScrollTopRef.current;

    if (delta > 4 && nextScrollTop > 20) {
      setTopbarVisible(false);
    } else if (delta < -4) {
      setTopbarVisible(true);
    }

    lastScrollTopRef.current = nextScrollTop;

    if (scrollStopTimerRef.current) clearTimeout(scrollStopTimerRef.current);
    scrollStopTimerRef.current = setTimeout(() => {
      setTopbarVisible(true);
    }, 650);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <MomentumSafetyBackground intensity="low" />
        <div className="relative z-10 rounded-2xl border border-white/10 bg-white/5 px-6 py-5 text-sm backdrop-blur-2xl">
          <SafetyLogo className="mb-3 justify-center" />
          <p className="text-center text-slate-200">Booting enterprise dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} onVerifyOtp={verifyOtp} onResendOtp={resendOtp} />;
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <ParticleBackground />
      <MomentumSafetyBackground intensity="low" />
      <div className="relative z-10 app-layout">
        <motion.aside
          animate={{ width: sidebarCollapsed ? 80 : 280 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="hidden h-full shrink-0 overflow-hidden md:block"
        >
          <Sidebar
            user={user}
            collapsed={sidebarCollapsed}
            activeModule={activeModule}
            onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
            onSelectModule={handleModuleSelect}
          />
        </motion.aside>

        <AnimatePresence>
          {mobileSidebarOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <motion.aside
                initial={{ x: -320 }}
                animate={{ x: 0 }}
                exit={{ x: -320 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="absolute inset-y-0 left-0 h-full w-[280px] max-w-[86vw]"
                onClick={(event) => event.stopPropagation()}
              >
                <Sidebar
                  user={user}
                  mobile
                  activeModule={activeModule}
                  onToggleCollapse={() => setMobileSidebarOpen(false)}
                  onSelectModule={handleModuleSelect}
                />
              </motion.aside>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <main className="main-content">
          <AnimatePresence initial={false}>
            {!shouldHideTopbarForModule && topbarVisible ? (
              <motion.div
                key="enterprise-topbar"
                initial={{ opacity: 0, y: -18, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -18, height: 0 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="topbar-motion-shell"
              >
                <Topbar
                  user={user}
                  onLogout={logout}
                  onToggleSidebar={handleSidebarToggle}
                  sidebarCollapsed={sidebarCollapsed}
                  title={moduleTitles[activeModule]}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div
            ref={pageContentRef}
            className={`page-content ${
              shouldHideTopbarForModule ? "page-content-fullscreen" : "page-content-with-floating-topbar"
            }`}
            onScroll={handlePageScroll}
          >
            <ModuleGuard user={user} moduleKey={activeModule}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeModule}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.24 }}
                >
                  {page}
                </motion.div>
              </AnimatePresence>
            </ModuleGuard>
          </div>
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

const App = () => (
  <ErrorBoundary>
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
