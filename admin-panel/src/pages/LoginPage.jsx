import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { APP_TITLE } from "../config/appConfig";
import SafetyLogo from "../components/brand/SafetyLogo";
import AnimatedLoginBackground from "../components/visuals/AnimatedLoginBackground";

const LoginPage = ({ onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      setError(loginError?.response?.data?.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
      <AnimatedLoginBackground />

      <motion.section
        initial={{ opacity: 0, y: 28, rotateX: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
        whileHover={{ y: -4, rotateX: 1.5, rotateY: -1.2 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-[2rem] border border-white/15 bg-slate-900/55 p-6 shadow-[0_35px_110px_rgba(0,0,0,.62),0_0_70px_rgba(20,184,166,.10)] backdrop-blur-2xl sm:p-8 [transform-style:preserve-3d]"
      >
        <div className="pointer-events-none absolute -right-24 -top-24 h-52 w-52 rounded-full bg-teal-400/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-52 w-52 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />

        <div className="relative mb-7 flex flex-col items-center text-center">
          <SafetyLogo />
          <h1 className="mt-4 font-display text-2xl font-semibold text-white">{APP_TITLE}</h1>
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

          <div className="flex justify-end">
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
            className="hse-primary-button w-full disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Login"}
          </motion.button>
        </form>
      </motion.section>
    </main>
  );
};

export default LoginPage;
