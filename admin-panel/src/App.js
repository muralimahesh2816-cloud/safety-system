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
import ModuleSkeleton from "./components/common/ModuleSkeleton";
import { settingsService } from "./api/services";
import { showConfirmPopup } from "./utils/alerts";
import { IMAGE_PLACEHOLDER_URL } from "./utils/media";
import { canAccessModule } from "./utils/permissions";
import useSidebarPreference from "./hooks/useSidebarPreference";
import { APP_NAME } from "./config/appConfig";
import { getTopbarVisibility } from "./utils/topbarVisibility";
import { ENTERPRISE_HSE_KEYS, getEnterpriseModule } from "./config/enterpriseHseConfig";

// Every business module is code-split. Only the shell, the login screen and
// whichever module the user actually opens are downloaded, which is what keeps
// the initial load and the login -> dashboard hand-off fast.
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const WorkApprovalsPage = lazy(() => import("./pages/WorkApprovalsPage"));
const HazardsPage = lazy(() => import("./pages/HazardsPage"));
const TrainingPage = lazy(() => import("./pages/TrainingPage"));
const UsersPage = lazy(() => import("./pages/UsersPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SystemHealthPage = lazy(() => import("./pages/SystemHealthPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
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

// Rail = icon-only resting width; expanded = full labels. Shared between the
// layout box and the animated panel so the two can never drift apart.
const SIDEBAR_WIDTH_RAIL = 80;
const SIDEBAR_WIDTH_EXPANDED = 280;

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
  const lastActivityRef = useRef(Date.now());
  const countdownTimerRef = useRef(null);

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
          return <EnterpriseHsePage moduleKey={activeModule} user={user} />;
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

  // Session-timeout setting.
  //
  // Keyed on the user's id, not the `user` object. AuthProvider replaces that
  // object at least twice during startup (stored snapshot, then the /auth/me
  // response), and depending on its identity meant this effect re-ran and
  // re-fetched /settings on every one of those swaps — for the same user, to
  // read a single number.
  const userId = user?.id || user?._id || "";
  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    (async () => {
      try {
        const response = await settingsService.get();
        if (!active) return;
        const timeout = response?.settings?.security?.sessionTimeout;
        if (timeout) setSessionTimeoutMinutes(timeout);
      } catch (_error) {
        if (active) setSessionTimeoutMinutes(30);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

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

  // Idle-session watchdog.
  //
  // This previously re-armed two timers and pushed two setState calls on every
  // single `mousemove` and `scroll` event — hundreds of times a second while
  // the user works, which is exactly the "everything gets sluggish after
  // login" symptom. Activity is now recorded into a ref (no render, no timer
  // churn) and a single 15s interval decides whether the idle threshold has
  // actually been crossed. All listeners are passive so they never block
  // scrolling.
  useEffect(() => {
    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;
    const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart", "wheel"];
    const CHECK_INTERVAL_MS = 15000;

    lastActivityRef.current = Date.now();

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };

    const beginCountdown = () => {
      if (countdownTimerRef.current) return;
      setShowTimeoutWarning(true);
      let remaining = 60;
      setCountdown(remaining);
      countdownTimerRef.current = setInterval(() => {
        remaining -= 1;
        setCountdown(remaining);
        if (remaining <= 0) {
          clearInterval(countdownTimerRef.current);
          countdownTimerRef.current = null;
          logout();
        }
      }, 1000);
    };

    const poll = setInterval(() => {
      // Once the warning is up the countdown owns the session: only an
      // explicit "Continue Session" clears it, not incidental mouse motion.
      if (countdownTimerRef.current) return;
      if (Date.now() - lastActivityRef.current >= timeoutMs) beginCountdown();
    }, CHECK_INTERVAL_MS);

    ACTIVITY_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, markActive, { passive: true })
    );

    return () => {
      clearInterval(poll);
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, markActive));
    };
  }, [logout, sessionTimeoutMinutes]);

  // Confirmed logout, used by both the sidebar and the topbar.
  //
  // The confirmation is not decoration: on a shared site terminal a mis-click
  // on Logout costs the user their session and any half-filled form. The
  // actual teardown is delegated to AuthContext.logout(), which revokes the
  // session server-side and clears every stored token/user key — this only
  // adds the prompt and the post-logout URL reset, so there is no second,
  // divergent copy of the session-clearing logic.
  const requestLogout = useCallback(async () => {
    const confirmed = await showConfirmPopup({
      title: "Are you sure you want to logout?",
      text: "You will need to sign in again with your email and one-time code.",
      confirmText: "Logout",
      cancelText: "Cancel",
      icon: "question"
    });
    if (!confirmed) return;

    await logout();

    // Land on /login rather than leaving the browser on a module URL the user
    // is no longer authenticated for.
    if (window.location.pathname !== "/login") {
      window.history.replaceState({}, "", "/login");
    }
  }, [logout]);

  const continueSession = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    lastActivityRef.current = Date.now();
    setShowTimeoutWarning(false);
    setCountdown(60);
  }, []);

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
        {/*
          Two nested elements on purpose.

          The outer div is the only thing in the flex layout, and its width
          changes solely when the user locks or unlocks the sidebar — a
          deliberate, rare action. The inner panel is absolutely positioned, so
          hover-expanding it animates *over* the page instead of resizing the
          layout box: previously the aside itself animated from 80px to 280px,
          which forced a full reflow of the main content, every chart and every
          table on every frame of the hover transition. That is what made the
          page visibly shudder when the pointer crossed the sidebar.
        */}
        <div
          className="relative hidden h-full shrink-0 md:block"
          style={{ width: sidebarLocked ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_RAIL }}
          onMouseEnter={() => hoverCapable && setSidebarHoverExpanded(true)}
          onMouseLeave={() => setSidebarHoverExpanded(false)}
          onFocusCapture={() => setSidebarHoverExpanded(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setSidebarHoverExpanded(false);
          }}
        >
          <motion.aside
            animate={{ width: sidebarCollapsed ? SIDEBAR_WIDTH_RAIL : SIDEBAR_WIDTH_EXPANDED }}
            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.22, 0.75, 0.25, 1] }}
            className={`brand-sidebar-panel absolute inset-y-0 left-0 overflow-hidden ${
              sidebarExpanded && !sidebarLocked ? "shadow-[18px_0_48px_rgba(2,6,23,.55)]" : ""
            }`}
          >
            <Sidebar
              user={user}
              collapsed={sidebarCollapsed}
              activeModule={activeModule}
              locked={sidebarLocked}
              onLockChange={setSidebarLocked}
              onSelectModule={handleModuleSelect}
              onLogout={requestLogout}
            />
          </motion.aside>
        </div>

        <AnimatePresence>
          {mobileSidebarOpen ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hse-drawer-scrim fixed inset-0 bg-black/60 md:hidden"
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
                  onLogout={requestLogout}
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
                  onLogout={requestLogout}
                  onToggleSidebar={handleSidebarToggle}
                  sidebarCollapsed={sidebarCollapsed}
                  navigationOpen={mobileSidebarOpen}
                  title={moduleTitles[activeModule]}
                  onSelectModule={handleModuleSelect}
                  reduceMotion={reduceMotion}
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
              {/*
                Enter-only transition, deliberately not `AnimatePresence
                mode="wait"`.

                With a wait-mode exit animation the outgoing page had to finish
                animating before the incoming one mounted — which meant the new
                module's code-split chunk was not even *requested* until 240ms
                after the click, adding that delay to every navigation. Worse,
                framer-motion drives exits with requestAnimationFrame, which
                does not run in a background tab: a click in a hidden or
                backgrounded tab left the exit animation permanently
                incomplete and the page stuck on the previous module.

                Keying the container on the module gives the same fade-and-lift
                on arrival, starts the chunk fetch immediately, and cannot
                stall.
              */}
              <motion.div
                key={activeModule}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 0.75, 0.25, 1] }}
              >
                <Suspense fallback={<ModuleSkeleton label={moduleTitles[activeModule]} />}>
                  {page}
                </Suspense>
              </motion.div>
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
            className="hse-dialog-overlay flex items-center justify-center bg-slate-950/90 p-4"
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
                onClick={continueSession}
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
