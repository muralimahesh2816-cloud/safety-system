import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import gsap from "gsap";
import { ArrowRight, BadgeCheck, HardHat, ShieldCheck, SkipForward } from "lucide-react";
import SafetyLogo from "../components/brand/SafetyLogo";
import AnimatedBackground from "../components/login/AnimatedBackground";
import LoginPanel from "../components/login/LoginPanel";
import LoadingOverlay from "../components/login/LoadingOverlay";

const HelmetScene = lazy(() => import("../components/login/HelmetScene"));

const canUseWebGL = () => {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch (_error) {
    return false;
  }
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  return reduced;
};

const LoginPage = ({ onLogin, onVerifyOtp, onResendOtp }) => {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState("intro");
  const [formVisible, setFormVisible] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [webglReady, setWebglReady] = useState(false);

  useEffect(() => {
    const lowPower =
      typeof navigator !== "undefined" &&
      navigator.hardwareConcurrency &&
      navigator.hardwareConcurrency <= 4;
    const mobile = typeof window !== "undefined" && window.innerWidth < 768;
    setWebglReady(canUseWebGL() && !reduceMotion && !lowPower && !mobile);
  }, [reduceMotion]);

  const activated = stage !== "intro";
  const showScene = webglReady;
  const scanVisible = stage === "scanning";

  const beginLogin = () => {
    if (stage !== "intro") return;
    setStage("scanning");
    const timeline = gsap.timeline();
    timeline.to({}, { duration: 2.25 });
    timeline.call(() => {
      setFormVisible(true);
      setStage("form");
    });
  };

  const skipAnimation = () => {
    setStage("form");
    setFormVisible(true);
  };

  const sceneLabel = useMemo(
    () =>
      showScene
        ? "3D safety readiness scene"
        : "Lightweight safety login background",
    [showScene]
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100" aria-label={sceneLabel}>
      <AnimatedBackground active={activated} />
      {showScene ? (
        <Suspense fallback={<LoadingOverlay visible label="Loading 3D safety scene" />}>
          <HelmetScene activated={activated} authenticated={authenticated} />
        </Suspense>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center opacity-80">
          <motion.div
            animate={reduceMotion ? {} : { y: [0, -10, 0], rotate: [0, 1.5, 0] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-[3rem] border border-orange-300/20 bg-orange-400/10 p-16 text-orange-100 shadow-[0_0_80px_rgba(249,115,22,.16)]"
          >
            <HardHat size={120} strokeWidth={1.2} />
          </motion.div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(2,6,23,.88),rgba(2,6,23,.4)_48%,rgba(2,6,23,.86))]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-slate-950 to-transparent" />

      <section className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.05fr_.95fr]">
        <div className="flex min-h-[46vh] flex-col justify-between px-6 py-8 sm:px-10 lg:min-h-screen lg:px-14 lg:py-12">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-[0_0_35px_rgba(20,184,166,.16)] backdrop-blur-xl">
              <SafetyLogo compact />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">Momentum Safety</p>
              <p className="mt-1 text-sm text-slate-400">Udupi Tollway Pvt Ltd</p>
            </div>
          </div>

          <div className="max-w-3xl py-10 lg:py-0">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-2 text-xs font-semibold text-emerald-100 shadow-[0_0_32px_rgba(16,185,129,.12)]"
            >
              <ShieldCheck size={15} />
              Enterprise Safety Access
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="font-display text-4xl font-black leading-tight text-white sm:text-5xl xl:text-6xl"
            >
              Safety Management System
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg"
            >
              A cinematic secure login flow for work approvals, hazards, training, and operational safety governance.
            </motion.p>

            {!formVisible ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={beginLogin}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_0_34px_rgba(20,184,166,.22)]"
                >
                  Begin Secure Login
                  <ArrowRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={skipAnimation}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-slate-100 backdrop-blur-xl"
                >
                  <SkipForward size={16} />
                  Skip Animation
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid max-w-2xl grid-cols-1 gap-3 text-xs text-slate-300 sm:grid-cols-3">
            {["Helmet scan", "Role protected", "Audit ready"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 backdrop-blur-xl">
                <BadgeCheck size={16} className="text-cyan-300" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center justify-center px-5 py-8 sm:px-8 lg:min-h-screen">
          <AnimatePresence mode="wait">
            {formVisible ? (
              <LoginPanel
                key="login-panel"
                onLogin={onLogin}
                onVerifyOtp={onVerifyOtp}
                onResendOtp={onResendOtp}
                onAuthenticated={() => setAuthenticated(true)}
              />
            ) : (
              <motion.div
                key="prelogin-panel"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-md rounded-[2rem] border border-white/15 bg-slate-950/48 p-8 text-center shadow-[0_35px_110px_rgba(0,0,0,.45)] backdrop-blur-2xl"
              >
                <HardHat className="mx-auto text-orange-200" size={54} />
                <h2 className="mt-5 font-display text-2xl font-semibold text-white">Safety Readiness Check</h2>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Begin the secure sequence to place the helmet, scan the vest, and reveal authenticated access.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <AnimatePresence>
        {scanVisible ? <LoadingOverlay visible label="Helmet locked. Scanning safety profile" /> : null}
      </AnimatePresence>
    </main>
  );
};

export default LoginPage;
