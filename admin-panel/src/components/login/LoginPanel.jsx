import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

const LoginPanel = ({ onLogin, onVerifyOtp, onResendOtp, onAuthenticated }) => {
  const [email, setEmail] = useState(() => localStorage.getItem("rememberedLoginEmail") || "");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingOtp, setPendingOtp] = useState(false);
  const [otpMeta, setOtpMeta] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem("rememberLogin") === "true");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const persistRememberMe = (value) => {
    if (rememberMe) {
      localStorage.setItem("rememberLogin", "true");
      localStorage.setItem("rememberedLoginEmail", value);
    } else {
      localStorage.removeItem("rememberLogin");
      localStorage.removeItem("rememberedLoginEmail");
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    setError("");
    setLoading(true);
    try {
      if (pendingOtp) {
        await onVerifyOtp(normalizedEmail, otp.trim());
        persistRememberMe(normalizedEmail);
        onAuthenticated?.();
        return;
      }

      const result = await onLogin(normalizedEmail, password);
      if (result?.pendingOtp) {
        setPendingOtp(true);
        setOtpMeta(result);
        setPassword("");
        setOtp("");
        return;
      }
      persistRememberMe(normalizedEmail);
      onAuthenticated?.();
    } catch (loginError) {
      setError(
        loginError?.response?.data?.message ||
          (pendingOtp ? "Invalid OTP. Please try again." : "Invalid email or password. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!onResendOtp || loading) return;
    setError("");
    setLoading(true);
    try {
      const result = await onResendOtp(email.trim());
      setOtpMeta(result);
    } catch (resendError) {
      setError(resendError?.response?.data?.message || "Unable to resend OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 26, filter: "blur(10px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="relative z-30 w-full max-w-md rounded-[2rem] border border-white/15 bg-slate-950/62 p-6 shadow-[0_35px_110px_rgba(0,0,0,.62),0_0_70px_rgba(20,184,166,.12)] backdrop-blur-2xl sm:p-8"
      onSubmit={handleSubmit}
    >
      <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
      <div className="mb-7 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Momentum Safety Login</p>
        <h2 className="mt-3 font-display text-2xl font-bold text-white">Secure Access</h2>
        <p className="mt-2 text-sm text-slate-400">
          {pendingOtp ? "Enter the OTP sent to your registered email." : "Sign in to Udupi Tollway safety operations."}
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="login-email" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-200/70" size={18} />
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="name@company.com"
              className="hse-input min-h-12 pl-11 disabled:opacity-60"
              disabled={pendingOtp}
              required
            />
          </div>
        </div>

        {!pendingOtp ? (
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
        ) : (
          <div>
            <label htmlFor="login-otp" className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-300">
              OTP
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-200/70" size={18} />
              <input
                id="login-otp"
                type="text"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter 6 digit OTP"
                className="hse-input min-h-12 pl-11"
                required
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>{otpMeta?.maskedEmail || email.trim()}</span>
              <button type="button" onClick={handleResendOtp} className="font-medium text-cyan-200 hover:text-cyan-100">
                Resend OTP
              </button>
            </div>
          </div>
        )}

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
          {pendingOtp ? (
            <button
              type="button"
              onClick={() => {
                setPendingOtp(false);
                setOtp("");
                setOtpMeta(null);
              }}
              className="text-xs font-medium text-cyan-200 hover:text-cyan-100"
            >
              Different account
            </button>
          ) : (
            <button type="button" className="text-xs font-medium text-cyan-200 hover:text-cyan-100">
              Forgot password?
            </button>
          )}
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
          {loading ? (pendingOtp ? "Verifying..." : "Signing in...") : pendingOtp ? "Verify OTP" : "Login"}
          {!loading ? <ArrowRight size={17} className="transition group-hover:translate-x-0.5" /> : null}
        </motion.button>
      </div>
    </motion.form>
  );
};

export default LoginPanel;
