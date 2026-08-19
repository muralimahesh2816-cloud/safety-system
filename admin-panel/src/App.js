import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
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
import VerifyCertificatePage from "./pages/VerifyCertificatePage";
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
import useSidebarPreference from "./hooks/useSidebarPreference";
import { APP_NAME } from "./config/appConfig";
import { getTopbarVisibility } from "./utils/topbarVisibility";
import { ENTERPRISE_HSE_KEYS, getEnterpriseModule } from "./config/enterpriseHseConfig";

const EnterpriseHsePage = lazy(() => import("./pages/EnterpriseHsePage"));

const moduleTitles = {
  dashboard: "Dashboard",
  work: "Work Approvals",
  hazards: "Hazards",
  training: "Training",
  users: "Users",
  reports: "Reports",
  health: "System Health",
  settings: "Settings"
};

ENTERPRISE_HSE_KEYS.forEach((key) => {
  moduleTitles[key] = getEnterpriseModule(key)?.label || key;
});

const coreModuleKeys = Object.keys(moduleTitles);
const moduleFromPath = () => {
  if (typeof window === "undefined") return "dashboard";
  const candidate = window.location.pathname.split("/").filter(Boolean)[0] || "dashboard";
  return coreModuleKeys.includes(candidate) ? candidate : "dashboard";
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
  const [activeModule, setActiveModule] = useState(moduleFromPath);
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(30);
  const { sidebarLocked, setSidebarLocked } = useSidebarPreference();
  const [sidebarHoverExpanded, setSidebarHoverExpanded] = useState(false);
  const [hoverCapable, setHoverCapable] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [topbarVisible, setTopbarVisible] = useState(true);
  const [topbarInteracting, setTopbarInteracting] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pageContentRef = useRef(null);

  const handleModuleNavigation = useCallback((moduleKey, { replace = false } = {}) => {
    const nextModule = coreModuleKeys.includes(moduleKey) ? moduleKey : "dashboard";
    setActiveModule(nextModule);
    const nextPath = nextModule === "dashboard" ? "/dashboard" : `/${nextModule}`;
    if (window.location.pathname !== nextPath) {
      window.history[replace ? "replaceState" : "pushState"]({ module: nextModule }, "", nextPath);
    }
  }, []);

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
        if (ENTERPRISE_HSE_KEYS.includes(activeModule)) {
          return (
            <Suspense fallback={<div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">Loading enterprise HSE module...</div>}>
              <EnterpriseHsePage moduleKey={activeModule} user={user} />
            </Suspense>
          );
        }
        return <DashboardPage onModuleSelect={handleModuleNavigation} />;
    }
  }, [activeModule, handleModuleNavigation, user]);

  useEffect(() => {
    const onPopState = () => setActiveModule(moduleFromPath());
    window.addEventListener("popstate", onPopState);
    if (window.location.pathname === "/") handleModuleNavigation("dashboard", { replace: true });
    return () => window.removeEventListener("popstate", onPopState);
  }, [handleModuleNavigation]);

  useEffect(() => {
    document.title = `${isAuthenticated ? moduleTitles[activeModule] : "Login"} | ${APP_NAME}`;
  }, [activeModule, isAuthenticated]);

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
    if (typeof window.matchMedia !== "function") {
      setHoverCapable(false);
      return undefined;
    }
    const query = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setHoverCapable(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (!mobileSidebarOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileSidebarOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mobileSidebarOpen]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    setTopbarVisible(true);
  }, [activeModule, mobileSidebarOpen]);

  useEffect(() => {
    const container = pageContentRef.current;
    if (!container || activeModule !== "dashboard") return undefined;
    let previousScrollTop = container.scrollTop;
    let stopTimer = null;
    const onScroll = () => {
      const nextScrollTop = container.scrollTop;
      const nextVisibility = getTopbarVisibility({
        previousScrollTop,
        nextScrollTop,
        interacting: topbarInteracting
      });
      if (nextVisibility !== null) setTopbarVisible(nextVisibility);
      previousScrollTop = nextScrollTop;
      if (stopTimer) window.clearTimeout(stopTimer);
      stopTimer = window.setTimeout(() => setTopbarVisible(true), 180);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (stopTimer) window.clearTimeout(stopTimer);
    };
  }, [activeModule, topbarInteracting]);

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
    setMobileSidebarOpen((previous) => !previous);
  };

  const handleModuleSelect = (moduleKey) => {
    handleModuleNavigation(moduleKey);
    setMobileSidebarOpen(false);
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

  const sidebarExpanded = sidebarLocked || (hoverCapable && sidebarHoverExpanded);
  const sidebarCollapsed = !sidebarExpanded;
  const showDashboardTopbar = activeModule === "dashboard";

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-50">
      <ParticleBackground />
      <MomentumSafetyBackground intensity="low" />
      <div className="relative z-10 app-layout">
        <motion.aside
          animate={{ width: sidebarCollapsed ? 80 : 280 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="hidden h-full shrink-0 overflow-hidden md:block"
          onMouseEnter={() => hoverCapable && setSidebarHoverExpanded(true)}
          onMouseLeave={() => setSidebarHoverExpanded(false)}
          onFocusCapture={() => setSidebarHoverExpanded(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSidebarHoverExpanded(false);
          }}
        >
          <Sidebar
            user={user}
            collapsed={sidebarCollapsed}
            activeModule={activeModule}
            locked={sidebarLocked}
            onLockChange={setSidebarLocked}
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
                id="mobile-primary-navigation"
                role="dialog"
                aria-modal="true"
                aria-label="Navigation menu"
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
            {showDashboardTopbar ? (
              <motion.div
                key="enterprise-topbar"
                initial={{ opacity: 0, y: -18 }}
                animate={{ opacity: topbarVisible ? 1 : 0.96, y: topbarVisible ? 0 : -112 }}
                exit={{ opacity: 0, y: -18, height: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
                className="topbar-motion-shell"
                onMouseEnter={() => {
                  setTopbarInteracting(true);
                  setTopbarVisible(true);
                }}
                onMouseLeave={() => setTopbarInteracting(false)}
                onFocusCapture={() => {
                  setTopbarInteracting(true);
                  setTopbarVisible(true);
                }}
                onBlurCapture={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) setTopbarInteracting(false);
                }}
              >
                <Topbar
                  user={user}
                  onLogout={logout}
                  onToggleSidebar={handleSidebarToggle}
                  sidebarCollapsed={sidebarCollapsed}
                  navigationOpen={mobileSidebarOpen}
                  title={moduleTitles[activeModule]}
                  onSelectModule={handleModuleSelect}
                />
              </motion.div>
            ) : null}
          </AnimatePresence>
          <div
            ref={pageContentRef}
            className={`page-content ${showDashboardTopbar ? "page-content-with-floating-topbar" : "page-content-fullscreen"}`}
          >
            {!showDashboardTopbar ? (
              <button
                type="button"
                onClick={handleSidebarToggle}
                className="mb-3 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/65 px-3 py-2 text-xs font-semibold text-white md:hidden"
                aria-label="Open navigation menu"
                aria-expanded={mobileSidebarOpen}
                aria-controls="mobile-primary-navigation"
              >
                <Menu size={16} /> Menu
              </button>
            ) : null}
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
                className="mt-6 rounded-2xl hse-primary-button px-5 py-3 text-sm font-semibold text-white"
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

// The certificate-verification page is public (no login) and reached by
// scanning/typing a code from a printed certificate, so it's handled here
// before AuthProvider ever mounts — no auth machinery runs for a visitor
// who was never asked to sign in.
const isVerifyRoute = () =>
  typeof window !== "undefined" && window.location.pathname.replace(/\/+$/, "") === "/verify";

const App = () => (
  <ErrorBoundary>
    {isVerifyRoute() ? (
      <VerifyCertificatePage />
    ) : (
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    )}
  </ErrorBoundary>
);

export default App;
