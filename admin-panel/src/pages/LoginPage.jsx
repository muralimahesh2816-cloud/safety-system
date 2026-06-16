import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, LockKeyhole, Mail, RotateCcw, ShieldCheck } from "lucide-react";
import { APP_TITLE } from "../config/appConfig";
import SafetyLogo from "../components/brand/SafetyLogo";
import MomentumSafetyBackground from "../components/visuals/MomentumSafetyBackground";

const maskEmail = (email = "") => {
  const [name = "", domain = ""] = email.split("@");
  if (!domain) return "";
  return `${name.slice(0, 2)}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
};

const OtpBoxes = ({ value, onChange, disabled }) => {
  const refs = useRef([]);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");

  const updateDigit = (index, nextValue) => {
    const clean = nextValue.replace(/\D/g, "");
    if (!clean) {
      const next = digits.map((digit) => (digit === " " ? "" : digit));
      next[index] = "";
      onChange(next.join("").slice(0, 6));
      return;
    }
    const next = digits.map((digit) => (digit === " " ? "" : digit));
    clean.split("").forEach((digit, offset) => {
      if (index + offset < 6) next[index + offset] = digit;
    });
    onChange(next.join("").slice(0, 6));
    refs.current[Math.min(5, index + clean.length)]?.focus();
  };

  return (
    <div className="grid grid-cols-6 gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          value={digit.trim()}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          onChange={(event) => updateDigit(index, event.target.value)}
          onPaste={(event) => {
            event.preventDefault();
            updateDigit(index, event.clipboardData.getData("text"));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit.trim() && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          className="h-12 rounded-2xl border border-white/15 bg-slate-950/70 text-center text-lg font-semibold text-white outline-none transition focus:border-cyan-300 focus:shadow-[0_0_24px_rgba(34,211,238,.24)] disabled:opacity-60"
        />
      ))}
    </div>
  );
};

const LoginPage = ({ onLogin, onVerifyOtp, onResendOtp }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState("password");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberDevice, setRememberDevice] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await onLogin(email, password);
      if (response?.pendingOtp) {
        setMaskedEmail(response.maskedEmail || maskEmail(email));
        setResendIn(Number(response.resendAfterSeconds || 60));
        setStep("otp");
        setOtp("");
      }
    } catch (loginError) {
      setError(loginError?.response?.data?.message || "Unable to continue. Check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (event) => {
    event.preventDefault();
    if (otp.length !== 6) {
      setError("Enter the 6 digit verification code.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onVerifyOtp(email, otp);
      setSuccess(true);
    } catch (otpError) {
      setError(otpError?.response?.data?.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendIn > 0 || loading) return;
    setError("");
    setLoading(true);
    try {
      const response = await onResendOtp(email);
      setMaskedEmail(response.maskedEmail || maskedEmail || maskEmail(email));
      setResendIn(Number(response.resendAfterSeconds || 60));
    } catch (resendError) {
      setError(resendError?.response?.data?.message || "Please wait before requesting another OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-8 text-slate-100">
      <MomentumSafetyBackground />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <motion.div initial={{ opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }} className="hidden lg:block">
          <SafetyLogo className="mb-8" />
          <p className="text-xs uppercase tracking-[0.32em] text-teal-200">Momentum Safety HSE</p>
          <h1 className="mt-4 font-display text-5xl font-semibold leading-tight text-white">
            Enterprise command center for safer field operations
          </h1>
          <p className="mt-5 max-w-xl text-slate-300">
            Work approvals, hazard control, training, reports, and access governance in one secure production platform.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-3">
            {["OTP Secured", "Live Backend", "HSE Ready"].map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-cyan-100 backdrop-blur-xl">
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 22, rotateX: -4 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          whileHover={{ y: -4, rotateX: 1.5, rotateY: -1.5 }}
          transition={{ duration: 0.35 }}
          className="mx-auto w-full max-w-md rounded-[2rem] border border-white/15 bg-white/10 p-7 shadow-[0_28px_90px_rgba(0,0,0,.48)] backdrop-blur-2xl"
        >
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex justify-center lg:hidden">
              <SafetyLogo />
            </div>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-300 to-cyan-400 text-slate-950 shadow-[0_0_36px_rgba(45,212,191,.35)]">
              <ShieldCheck size={30} />
            </div>
            <h2 className="font-display text-2xl font-semibold">{APP_TITLE}</h2>
            <p className="mt-1 text-sm text-slate-300">
              {step === "password" ? "Sign in with your enterprise account" : `Code sent to ${maskedEmail}`}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === "password" ? (
              <motion.form key="password" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} onSubmit={handlePasswordSubmit}>
                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-300">Email</label>
                <div className="relative mb-4">
                  <Mail className="absolute left-4 top-3.5 text-slate-400" size={17} />
                  <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" className="hse-input pl-11" required />
                </div>

                <label className="mb-2 block text-xs uppercase tracking-[0.18em] text-slate-300">Password</label>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-3.5 text-slate-400" size={17} />
                  <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="hse-input pl-11 pr-12" required />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-3 text-slate-300">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={rememberDevice} onChange={(event) => setRememberDevice(event.target.checked)} className="rounded border-white/20 bg-slate-900" />
                    Remember device
                  </label>
                  <button type="button" className="text-cyan-200">Forgot password?</button>
                </div>

                {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}

                <button type="submit" disabled={loading} className="hse-primary-button mt-5 w-full">
                  {loading ? "Sending secure code..." : "Continue securely"}
                </button>
              </motion.form>
            ) : (
              <motion.form key="otp" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} onSubmit={handleOtpSubmit}>
                <OtpBoxes value={otp} onChange={setOtp} disabled={loading || success} />
                <div className="mt-4 flex items-center justify-between text-xs text-slate-300">
                  <button type="button" onClick={() => setStep("password")} className="text-slate-200">Change email</button>
                  <button type="button" onClick={handleResend} disabled={resendIn > 0 || loading} className="inline-flex items-center gap-1 text-cyan-200 disabled:text-slate-500">
                    <RotateCcw size={13} />
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                  </button>
                </div>

                {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
                {success ? <p className="mt-4 text-sm text-emerald-300">Verified. Opening dashboard...</p> : null}

                <button type="submit" disabled={loading || success} className="hse-primary-button mt-5 w-full">
                  {loading ? "Verifying..." : "Verify and enter"}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-xs text-emerald-100">
            Secure login is protected with password validation, email OTP, refresh tokens, CSRF, and session monitoring.
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default LoginPage;
