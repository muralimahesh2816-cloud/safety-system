import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RotateCcw,
  ShieldCheck
} from "lucide-react";
import brandMark from "../../assets/topbarlogo.svg";
import {
  APP_TITLE,
  ORGANIZATION_NAME,
  PORTAL_BRAND_NAME,
  SUPPORT_EMAIL
} from "../../config/appConfig";

export const AUTH_STEPS = Object.freeze({
  LOGIN: "login",
  AUTHENTICATING: "authenticating",
  OTP_REQUIRED: "otp_required",
  VERIFYING_OTP: "verifying_otp",
  RESENDING_OTP: "resending_otp",
  AUTHENTICATED: "authenticated",
  RECOVERY: "recovery",
  ERROR: "error"
});

const LOGIN_STORAGE_KEY = "rememberedLoginEmail";
const REMEMBER_STORAGE_KEY = "rememberLogin";
const DEFAULT_OTP_EXPIRY_SECONDS = 300;
const DEFAULT_RESEND_SECONDS = 60;

const initialEmail = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(REMEMBER_STORAGE_KEY) === "true"
    ? localStorage.getItem(LOGIN_STORAGE_KEY) || ""
    : "";
};

const getInteractiveStep = (authState) => {
  if (authState.step === AUTH_STEPS.ERROR) return authState.returnStep;
  if ([AUTH_STEPS.AUTHENTICATING].includes(authState.step)) return AUTH_STEPS.LOGIN;
  if ([AUTH_STEPS.VERIFYING_OTP, AUTH_STEPS.RESENDING_OTP].includes(authState.step)) {
    return AUTH_STEPS.OTP_REQUIRED;
  }
  return authState.step;
};

const friendlyAuthError = (error, context) => {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;

  if (!error?.response) {
    return "Unable to connect to the server. Check your connection and try again.";
  }
  if (status === 429) {
    return context === "resend"
      ? "Please wait before requesting another verification code."
      : "Too many sign-in attempts. Please wait and try again.";
  }
  if (status === 423) {
    return "Sign-in is temporarily locked after repeated attempts. Please try again later.";
  }
  if (status === 403 || code === "USER_BLOCKED") {
    return "Your account is inactive. Contact the system administrator for assistance.";
  }
  if (context === "otp") {
    return "The verification code is incorrect or has expired. Please try again.";
  }
  if (context === "resend") {
    return "We could not resend the verification code. Please try again shortly.";
  }
  if (status === 401 || status === 400 || status === 422) {
    return "The entered email or password is incorrect.";
  }
  return "We could not complete sign-in. Please try again.";
};

const FieldMessage = ({ id, children }) => (
  <p className="auth-field__message" id={id}>
    <CircleAlert size={13} aria-hidden="true" />
    {children}
  </p>
);

const LoginPanel = ({ onLogin, onVerifyOtp, onResendOtp, onAuthenticated }) => {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() =>
    typeof window !== "undefined" && localStorage.getItem(REMEMBER_STORAGE_KEY) === "true"
  );
  const [authState, setAuthState] = useState({
    step: AUTH_STEPS.LOGIN,
    returnStep: AUTH_STEPS.LOGIN,
    message: ""
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [otpMeta, setOtpMeta] = useState(null);
  const [clock, setClock] = useState(() => Date.now());
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const submissionLockRef = useRef(false);
  const otpInputRef = useRef(null);

  const interactiveStep = getInteractiveStep(authState);
  const isLoginStep = interactiveStep === AUTH_STEPS.LOGIN;
  const isOtpStep = interactiveStep === AUTH_STEPS.OTP_REQUIRED;
  const isRecoveryStep = interactiveStep === AUTH_STEPS.RECOVERY;
  const isSubmitting = [
    AUTH_STEPS.AUTHENTICATING,
    AUTH_STEPS.VERIFYING_OTP,
    AUTH_STEPS.RESENDING_OTP
  ].includes(authState.step);

  const otpExpiresAt = otpMeta?.expiresAt || 0;
  const resendAvailableAt = otpMeta?.resendAvailableAt || 0;
  const otpSecondsRemaining = Math.max(0, Math.ceil((otpExpiresAt - clock) / 1000));
  const resendSecondsRemaining = Math.max(0, Math.ceil((resendAvailableAt - clock) / 1000));
  const otpExpired = Boolean(otpMeta && otpSecondsRemaining === 0);

  useEffect(() => {
    if (!isOtpStep) return undefined;
    setClock(Date.now());
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isOtpStep, otpMeta]);

  useEffect(() => {
    if (isOtpStep) otpInputRef.current?.focus();
  }, [isOtpStep]);

  const clearErrorState = () => {
    if (authState.step === AUTH_STEPS.ERROR) {
      setAuthState({ step: authState.returnStep, returnStep: authState.returnStep, message: "" });
    }
  };

  const setErrorState = (message, returnStep) => {
    setAuthState({ step: AUTH_STEPS.ERROR, returnStep, message });
  };

  const persistRememberedEmail = (value) => {
    if (typeof window === "undefined") return;
    if (rememberMe) {
      localStorage.setItem(REMEMBER_STORAGE_KEY, "true");
      localStorage.setItem(LOGIN_STORAGE_KEY, value);
      return;
    }
    localStorage.removeItem(REMEMBER_STORAGE_KEY);
    localStorage.removeItem(LOGIN_STORAGE_KEY);
  };

  const startOtpWindow = (result = {}) => {
    const now = Date.now();
    setOtpMeta({
      ...result,
      expiresAt: now + Number(result.expiresInSeconds ?? DEFAULT_OTP_EXPIRY_SECONDS) * 1000,
      resendAvailableAt:
        now + Number(result.resendAfterSeconds ?? DEFAULT_RESEND_SECONDS) * 1000
    });
    setClock(now);
  };

  const validateLogin = () => {
    const errors = {};
    if (!email.trim()) errors.email = "Please enter your work email address.";
    if (!password) errors.password = "Please enter your password.";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateOtp = () => {
    if (!/^\d{6}$/.test(otp)) {
      setFieldErrors({ otp: "Enter the complete six-digit verification code." });
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submissionLockRef.current || isRecoveryStep) return;

    const normalizedEmail = email.trim();
    if (isLoginStep && !validateLogin()) return;
    if (isOtpStep && (otpExpired || !validateOtp())) return;

    submissionLockRef.current = true;
    setFieldErrors({});
    setAuthState({
      step: isOtpStep ? AUTH_STEPS.VERIFYING_OTP : AUTH_STEPS.AUTHENTICATING,
      returnStep: interactiveStep,
      message: ""
    });

    try {
      if (isOtpStep) {
        await onVerifyOtp(normalizedEmail, otp);
        persistRememberedEmail(normalizedEmail);
        setAuthState({
          step: AUTH_STEPS.AUTHENTICATED,
          returnStep: AUTH_STEPS.AUTHENTICATED,
          message: ""
        });
        onAuthenticated?.();
        return;
      }

      const result = await onLogin(normalizedEmail, password);
      if (result?.pendingOtp) {
        setPassword("");
        setOtp("");
        startOtpWindow(result);
        setAuthState({
          step: AUTH_STEPS.OTP_REQUIRED,
          returnStep: AUTH_STEPS.OTP_REQUIRED,
          message: ""
        });
        return;
      }

      persistRememberedEmail(normalizedEmail);
      setAuthState({
        step: AUTH_STEPS.AUTHENTICATED,
        returnStep: AUTH_STEPS.AUTHENTICATED,
        message: ""
      });
      onAuthenticated?.();
    } catch (error) {
      setErrorState(friendlyAuthError(error, isOtpStep ? "otp" : "login"), interactiveStep);
    } finally {
      submissionLockRef.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (!onResendOtp || submissionLockRef.current || resendSecondsRemaining > 0) return;

    submissionLockRef.current = true;
    setFieldErrors({});
    setAuthState({
      step: AUTH_STEPS.RESENDING_OTP,
      returnStep: AUTH_STEPS.OTP_REQUIRED,
      message: ""
    });
    try {
      const result = await onResendOtp(email.trim());
      setOtp("");
      startOtpWindow(result);
      setAuthState({
        step: AUTH_STEPS.OTP_REQUIRED,
        returnStep: AUTH_STEPS.OTP_REQUIRED,
        message: "A new verification code has been sent."
      });
    } catch (error) {
      setErrorState(friendlyAuthError(error, "resend"), AUTH_STEPS.OTP_REQUIRED);
    } finally {
      submissionLockRef.current = false;
    }
  };

  const returnToLogin = () => {
    setPassword("");
    setOtp("");
    setOtpMeta(null);
    setFieldErrors({});
    setRecoveryAcknowledged(false);
    setAuthState({ step: AUTH_STEPS.LOGIN, returnStep: AUTH_STEPS.LOGIN, message: "" });
  };

  const heading = useMemo(() => {
    if (isOtpStep) return "Verify Your Identity";
    if (isRecoveryStep) return "Password Assistance";
    if (authState.step === AUTH_STEPS.AUTHENTICATED) return "Authentication Successful";
    return "Welcome Back";
  }, [authState.step, isOtpStep, isRecoveryStep]);

  if (authState.step === AUTH_STEPS.AUTHENTICATED) {
    return (
      <section className="auth-card auth-card--success" aria-live="polite">
        <span className="auth-success-icon" aria-hidden="true">
          <Check size={30} />
        </span>
        <h2>{heading}</h2>
        <p>Redirecting to your dashboard...</p>
        <LoaderCircle className="auth-spinner" size={22} aria-hidden="true" />
      </section>
    );
  }

  return (
    <section className="auth-card" aria-labelledby="auth-card-title">
      <header className="auth-card__header">
        <div className="auth-card__identity">
          <span className="auth-card__logo" aria-hidden="true">
            <img src={brandMark} alt="" />
          </span>
          <span>
            <strong>{PORTAL_BRAND_NAME}</strong>
            <small>{APP_TITLE}</small>
          </span>
        </div>

        <div className="auth-card__title-row">
          <div>
            <p className="auth-card__eyebrow">
              {isOtpStep ? "Additional verification" : isRecoveryStep ? "Account access" : "Secure sign in"}
            </p>
            <h2 id="auth-card-title">{heading}</h2>
          </div>
          <span className="auth-card__shield" aria-hidden="true">
            {isOtpStep ? <KeyRound size={21} /> : <ShieldCheck size={21} />}
          </span>
        </div>
        <p className="auth-card__description">
          {isOtpStep
            ? "Enter the verification code sent to your registered email address."
            : isRecoveryStep
              ? "For your security, password resets are managed by an authorized system administrator."
              : `Sign in using your authorized ${ORGANIZATION_NAME} account to continue.`}
        </p>
      </header>

      {isRecoveryStep ? (
        <div className="auth-recovery">
          <div className="auth-recovery__notice">
            <LockKeyhole size={20} aria-hidden="true" />
            <div>
              <strong>Account details remain private</strong>
              <p>
                Contact your portal administrator to request a password reset. The portal will not
                confirm whether an account exists.
              </p>
            </div>
          </div>
          {SUPPORT_EMAIL ? (
            <a
              className="auth-primary-button"
              href={`mailto:${SUPPORT_EMAIL}?subject=Safety%20Portal%20Access%20Assistance`}
              onClick={() => setRecoveryAcknowledged(true)}
            >
              Email Support
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          ) : (
            <button
              type="button"
              className="auth-primary-button"
              onClick={() => setRecoveryAcknowledged(true)}
            >
              View Next Step
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          )}
          {recoveryAcknowledged ? (
            <p className="auth-status auth-status--info" role="status">
              Please contact your authorized system administrator and ask for Safety Management System account assistance.
            </p>
          ) : null}
          <button type="button" className="auth-text-button auth-text-button--back" onClick={returnToLogin}>
            <ArrowLeft size={15} aria-hidden="true" />
            Back to Sign In
          </button>
        </div>
      ) : (
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label={isOtpStep ? "Verification form" : "Sign in form"}
        >
          {isLoginStep ? (
            <>
              <div className="auth-field">
                <label htmlFor="login-email">Work Email</label>
                <div className={`auth-field__control${fieldErrors.email ? " auth-field__control--error" : ""}`}>
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setFieldErrors((current) => ({ ...current, email: "" }));
                      clearErrorState();
                    }}
                    autoComplete="username"
                    inputMode="email"
                    placeholder="name@company.com"
                    aria-invalid={Boolean(fieldErrors.email)}
                    aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
                    disabled={isSubmitting}
                  />
                </div>
                {fieldErrors.email ? (
                  <FieldMessage id="login-email-error">{fieldErrors.email}</FieldMessage>
                ) : null}
              </div>

              <div className="auth-field">
                <div className="auth-field__label-row">
                  <label htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    className="auth-text-button"
                    onClick={() => {
                      setFieldErrors({});
                      setAuthState({
                        step: AUTH_STEPS.RECOVERY,
                        returnStep: AUTH_STEPS.RECOVERY,
                        message: ""
                      });
                    }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className={`auth-field__control${fieldErrors.password ? " auth-field__control--error" : ""}`}>
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setFieldErrors((current) => ({ ...current, password: "" }));
                      clearErrorState();
                    }}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    aria-invalid={Boolean(fieldErrors.password)}
                    aria-describedby={fieldErrors.password ? "login-password-error" : undefined}
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    className="auth-field__action"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {fieldErrors.password ? (
                  <FieldMessage id="login-password-error">{fieldErrors.password}</FieldMessage>
                ) : null}
              </div>

              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={isSubmitting}
                />
                <span aria-hidden="true"><Check size={12} /></span>
                Remember my email on this device
              </label>
            </>
          ) : (
            <div className="auth-otp">
              <div className="auth-otp__destination">
                <span>Code sent to</span>
                <strong>{otpMeta?.maskedEmail || "your registered email"}</strong>
              </div>
              <div className="auth-field">
                <label htmlFor="login-otp">Six-digit verification code</label>
                <div className={`auth-field__control auth-field__control--otp${fieldErrors.otp ? " auth-field__control--error" : ""}`}>
                  <KeyRound size={18} aria-hidden="true" />
                  <input
                    ref={otpInputRef}
                    id="login-otp"
                    type="text"
                    value={otp}
                    onChange={(event) => {
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                      setFieldErrors({});
                      clearErrorState();
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    maxLength={6}
                    aria-invalid={Boolean(fieldErrors.otp)}
                    aria-describedby={fieldErrors.otp ? "login-otp-error" : "login-otp-help"}
                    disabled={isSubmitting}
                  />
                </div>
                {fieldErrors.otp ? (
                  <FieldMessage id="login-otp-error">{fieldErrors.otp}</FieldMessage>
                ) : (
                  <p className={`auth-otp__timer${otpExpired ? " auth-otp__timer--expired" : ""}`} id="login-otp-help">
                    {otpExpired
                      ? "This code has expired. Request a new code to continue."
                      : `Code expires in ${Math.floor(otpSecondsRemaining / 60)}:${String(otpSecondsRemaining % 60).padStart(2, "0")}`}
                  </p>
                )}
              </div>

              <div className="auth-otp__actions">
                <button
                  type="button"
                  className="auth-text-button"
                  onClick={handleResendOtp}
                  disabled={isSubmitting || resendSecondsRemaining > 0}
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  {authState.step === AUTH_STEPS.RESENDING_OTP
                    ? "Sending..."
                    : resendSecondsRemaining > 0
                      ? `Resend in ${resendSecondsRemaining}s`
                      : "Resend code"}
                </button>
                <button type="button" className="auth-text-button" onClick={returnToLogin} disabled={isSubmitting}>
                  <ArrowLeft size={14} aria-hidden="true" />
                  Back to Sign In
                </button>
              </div>
            </div>
          )}

          <div className="auth-status-region" aria-live="assertive" aria-atomic="true">
            {authState.step === AUTH_STEPS.ERROR ? (
              <p className="auth-status auth-status--error" role="alert">
                <CircleAlert size={17} aria-hidden="true" />
                {authState.message}
              </p>
            ) : authState.message ? (
              <p className="auth-status auth-status--info" role="status">
                {authState.message}
              </p>
            ) : null}
          </div>

          <button
            type="submit"
            className="auth-primary-button"
            disabled={isSubmitting || (isOtpStep && otpExpired)}
          >
            {isSubmitting ? (
              <>
                <LoaderCircle className="auth-spinner" size={18} aria-hidden="true" />
                <span>{isOtpStep ? "Verifying..." : "Signing In..."}</span>
              </>
            ) : (
              <>
                <LockKeyhole size={17} aria-hidden="true" />
                <span>{isOtpStep ? "Verify & Continue" : "Sign In Securely"}</span>
                <ArrowRight className="auth-primary-button__arrow" size={17} aria-hidden="true" />
              </>
            )}
          </button>
        </form>
      )}

      <footer className="auth-card__footer">
        <ShieldCheck size={17} aria-hidden="true" />
        <p>
          Secure access with CSRF safeguards, OTP when required, and role-based permissions.
        </p>
      </footer>
    </section>
  );
};

export default LoginPanel;
