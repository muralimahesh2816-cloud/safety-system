import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { APP_TITLE } from "../config/appConfig";

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
      setError(loginError?.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-slate-100">
      <div className="absolute inset-0 bg-premium-radial opacity-80" />
      <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-teal-500/30 blur-[130px]" />
      <div className="absolute -right-20 bottom-10 h-96 w-96 rounded-full bg-sky-500/30 blur-[140px]" />

      <div className="relative mx-auto flex min-h-[85vh] w-full max-w-6xl items-center justify-center lg:justify-between">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden max-w-xl lg:block"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-teal-300">Enterprise Safety</p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-tight">
            Next-Gen HSE Management for Mission Critical Operations
          </h1>
          <p className="mt-5 text-slate-300">
            Unified approvals, hazard intelligence, training governance, and live KPI visibility
            with enterprise-grade security.
          </p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          onSubmit={handleSubmit}
          className="w-full max-w-md rounded-[2.2rem] border border-white/15 bg-white/10 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-cyan-500 text-slate-950 shadow-2xl">
              <ShieldCheck size={34} />
            </div>
            <h2 className="font-display text-2xl font-semibold">{APP_TITLE}</h2>
            <p className="mt-1 text-sm text-slate-300">Sign in to continue</p>
          </div>

          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-300">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mb-4 w-full rounded-2xl border border-white/20 bg-slate-900/70 px-4 py-3 text-sm outline-none ring-0 transition focus:border-teal-300"
            required
          />

          <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-300">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mb-2 w-full rounded-2xl border border-white/20 bg-slate-900/70 px-4 py-3 pr-12 text-sm outline-none ring-0 transition focus:border-teal-300"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-3 top-3 text-slate-300"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error ? <p className="mb-3 text-sm text-rose-300">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 w-full rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
          >
            {loading ? "Authenticating..." : "Login to Dashboard"}
          </button>
        </motion.form>
      </div>
    </div>
  );
};

export default LoginPage;
