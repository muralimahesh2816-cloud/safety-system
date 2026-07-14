import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BadgeCheck,
  Eye,
  EyeOff,
  HardHat,
  LockKeyhole,
  Mail,
  MapPinned,
  ShieldCheck,
  TrafficCone
} from "lucide-react";
import SafetyLogo from "../components/brand/SafetyLogo";
import AnimatedLoginBackground from "../components/visuals/AnimatedLoginBackground";

const safetyStats = [
  { label: "Highway Safety", value: "24/7" },
  { label: "Work Permits", value: "Live" },
  { label: "HSE Control", value: "Secure" }
];

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState(() => localStorage.getItem("rememberedLoginEmail") || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("rememberLogin") === "true");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0 });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
      if (rememberMe) {
        localStorage.setItem("rememberLogin", "true");
        localStorage.setItem("rememberedLoginEmail", email.trim());
      } else {
        localStorage.removeItem("rememberLogin");
        localStorage.removeItem("rememberedLoginEmail");
      }
    } catch (loginError) {
      setError(loginError?.response?.data?.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCardMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    setTilt({ rotateX: y * -7, rotateY: x * 7 });
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <AnimatedLoginBackground />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(2,6,23,.32),rgba(15,23,42,.82)_48%,rgba(2,6,23,.58))]" />

      <section className="relative z-10 grid min-h-screen grid-cols-1 lg:grid-cols-[1.08fr_.92fr]">
        <motion.div
          initial={{ opacity: 0, x: -26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative flex min-h-[42vh] flex-col justify-between overflow-hidden px-6 py-8 sm:px-10 lg:min-h-screen lg:px-14 lg:py-12"
        >
          <div className="absolute inset-x-10 bottom-16 h-28 skew-y-[-7deg] rounded-[100%] border-y border-cyan-300/20 bg-gradient-to-r from-transparent via-cyan-300/[0.08] to-transparent shadow-[0_0_80px_rgba(34,211,238,.12)]" />
          <div className="absolute left-8 top-28 hidden h-64 w-44 rotate-[-8deg] rounded-[2rem] border border-white/10 bg-white/[0.045] shadow-[0_35px_90px_rgba(0,0,0,.32)] backdrop-blur-xl md:block" />
          <div className="absolute bottom-24 right-10 hidden h-52 w-40 rotate-[9deg] rounded-[2rem] border border-amber-300/15 bg-amber-300/[0.04] shadow-[0_35px_90px_rgba(245,158,11,.12)] backdrop-blur-xl md:block" />

          <div className="relative flex items-center gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-[0_0_35px_rgba(20,184,166,.16)] backdrop-blur-xl">
              <SafetyLogo compact />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-200">Udupi Tollway Pvt Ltd</p>
              <p className="mt-1 text-sm text-slate-400">Road operations and HSE governance</p>
            </div>
          </div>

          <div className="relative max-w-3xl py-10 lg:py-0">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.08, ease: "easeOut" }}
              className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-4 py-2 text-xs font-semibold text-emerald-100 shadow-[0_0_32px_rgba(16,185,129,.12)]"
            >
              <ShieldCheck size={15} />
              Integrated Safety Command Portal
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.14, ease: "easeOut" }}
              className="font-display text-4xl font-black leading-tight text-white sm:text-5xl xl:text-6xl"
            >
              Safety Management System
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="mt-5 max-w-2xl text-base leading-8 text-slate-300 sm:text-lg"
            >
              Monitor highway work approvals, hazard controls, training compliance, and operational safety from one secure enterprise cockpit.
            </motion.p>

            <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
              {safetyStats.map((item, index) => (
                <motion.div
                  key={item.label}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: 0.28 + index * 0.08 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 shadow-[0_16px_45px_rgba(0,0,0,.22)] backdrop-blur-xl"
                >
                  <p className="text-2xl font-bold text-white">{item.value}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{item.label}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="relative grid max-w-2xl grid-cols-1 gap-3 text-xs text-slate-300 sm:grid-cols-3">
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 backdrop-blur-xl">
              <HardHat size={17} className="text-amber-300" />
              PPE Ready
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 backdrop-blur-xl">
              <TrafficCone size={17} className="text-orange-300" />
              Work Zone
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.045] px-3 py-3 backdrop-blur-xl">
              <MapPinned size={17} className="text-cyan-300" />
              Toll Plaza
            </div>
          </div>
        </motion.div>

        <div className="relative flex items-center justify-center px-5 py-8 sm:px-8 lg:min-h-screen">
          <motion.section
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.55, delay: 0.12, ease: "easeOut" }}
            onMouseMove={handleCardMove}
            onMouseLeave={() => setTilt({ rotateX: 0, rotateY: 0 })}
            style={{
              transform: `perspective(1100px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`
            }}
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-slate-900/68 p-6 shadow-[0_35px_110px_rgba(0,0,0,.62),0_0_70px_rgba(20,184,166,.12)] backdrop-blur-2xl transition-transform duration-150 sm:p-8"
          >
            <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-teal-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-20 h-52 w-52 rounded-full bg-orange-400/10 blur-3xl" />
            <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />

            <div className="relative mb-7 text-center">
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-[1.6rem] border border-white/12 bg-white/[0.06] shadow-[0_0_42px_rgba(34,211,238,.14)]">
                <SafetyLogo compact />
              </div>
              <h2 className="mt-5 font-display text-2xl font-bold text-white">Welcome Back</h2>
              <p className="mt-2 text-sm text-slate-400">Sign in to Udupi Tollway safety operations</p>
            </div>

            <form className="relative space-y-4" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="login-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Email / User ID
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-200/70" size={18} />
                  <input
                    id="login-email"
                    type="text"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="username"
                    placeholder="Enter email or user ID"
                    className="hse-input min-h-12 pl-11"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-200/70" size={18} />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter password"
                    className="hse-input min-h-12 pl-11 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-slate-900 accent-cyan-400"
                  />
                  Remember me
                </label>
                <button type="button" className="text-xs font-medium text-cyan-200 transition hover:text-cyan-100">
                  Forgot password?
                </button>
              </div>

              {error ? (
                <p className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">{error}</p>
              ) : null}

              <motion.button
                type="submit"
                disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.015 }}
                whileTap={{ scale: loading ? 1 : 0.985 }}
                className="hse-primary-button group flex w-full items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? "Signing in..." : "Login"}
                {!loading ? <ArrowRight size={17} className="transition group-hover:translate-x-0.5" /> : null}
              </motion.button>
            </form>

            <div className="relative mt-7 flex items-center justify-center gap-2 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
              <BadgeCheck size={14} className="text-emerald-300" />
              <span>&copy; {new Date().getFullYear()} Udupi Tollway Pvt Ltd. Safety Management System.</span>
            </div>
          </motion.section>
        </div>
      </section>
    </main>
  );
};

export default LoginPage;
