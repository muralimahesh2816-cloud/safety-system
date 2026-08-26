import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleAlert,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Smartphone
} from "lucide-react";
import { APP_TITLE, ORGANIZATION_NAME } from "../../config/appConfig";

/**
 * Mobile number + OTP sign-in.
 *
 * Two steps, and the state machine is deliberately explicit rather than a pile
 * of booleans, because the failure modes here are the ones users actually hit:
 * an expired code, a rate limit, a number that was never registered.
 *
 * The OTP input is six visible boxes over a single real input. That matters:
 * six separate inputs break paste, break `autocomplete="one-time-code"` (which
 * is how iOS and Android offer the code from the notification), and give screen
 * readers six unlabelled fields instead of one labelled one. So there is one
 * input carrying the accessibility and autofill contract, with the boxes drawn
 * behind it purely as presentation.
 */
const STEPS = Object.freeze({
  MOBILE: "mobile",
  OTP: "otp",
  DONE: "done"
});

const OTP_LENGTH = 6;
const DEFAULT_EXPIRY_SECONDS = 300;
const DEFAULT_RESEND_SECONDS = 60;
const REMEMBER_KEY = "rememberedLoginMobile";

const friendlyError = (error) => {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  const message = error?.response?.data?.message;

  if (!error?.response) {
    return "Unable to connect to the Safety Management System. Please try again.";
  }
  // The server's wording for these is already the right wording for a user.
  if (code === "MOBILE_NOT_REGISTERED" || code === "USER_BLOCKED") return message;
  if (String(code || "").startsWith("PHONE_")) return "Please enter a valid mobile number.";
  if (status === 429 || code === "RATE_LIMITED") return "Too many attempts. Please try again later.";
  if (status === 423) return "Too many attempts. Please try again later.";
  if (status === 401) return "The OTP is incorrect. Please try again.";
  return message || "We could not complete sign-in. Please try again.";
};

const formatCountdown = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const MobileOtpLogin = ({ onRequestOtp, onVerifyOtp, onAuthenticated }) => {
  const [step, setStep] = useState(STEPS.MOBILE);
  const [mobile, setMobile] = useState(
    () => (typeof window !== "undefined" && localStorage.getItem(REMEMBER_KEY)) || ""
  );
  const [remember, setRemember] = useState(
    () => typeof window !== "undefined" && Boolean(localStorage.getItem(REMEMBER_KEY))
  );
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [meta, setMeta] = useState(null);
  const [clock, setClock] = useState(() => Date.now());

  const otpInputRef = useRef(null);
  const mobileInputRef = useRef(null);
  // Closes the window between a click and React committing the busy state, so a
  // fast double-click cannot send two codes.
  const submitLock = useRef(false);

  const expiresAt = meta?.expiresAt || 0;
  const resendAt = meta?.resendAt || 0;
  const secondsLeft = Math.max(0, Math.ceil((expiresAt - clock) / 1000));
  const resendIn = Math.max(0, Math.ceil((resendAt - clock) / 1000));
  const expired = Boolean(meta) && secondsLeft === 0;

  // One ticking timer, and only while a countdown is actually on screen.
  useEffect(() => {
    if (step !== STEPS.OTP) return undefined;
    setClock(Date.now());
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [step, meta]);

  useEffect(() => {
    if (step === STEPS.OTP) otpInputRef.current?.focus();
    if (step === STEPS.MOBILE) mobileInputRef.current?.focus();
  }, [step]);

  const startOtpWindow = useCallback((response) => {
    const now = Date.now();
    setMeta({
      maskedMobile: response?.maskedMobile || "",
      deliveredVia: response?.deliveredVia || "",
      expiresAt: now + Number(response?.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS) * 1000,
      resendAt: now + Number(response?.resendAfterSeconds ?? DEFAULT_RESEND_SECONDS) * 1000
    });
    setClock(now);
  }, []);

  const sendOtp = async (isResend = false) => {
    if (submitLock.current) return;
    const trimmed = mobile.trim();
    if (!trimmed) {
      setError("Please enter a valid mobile number.");
      return;
    }

    submitLock.current = true;
    setBusy(isResend ? "resend" : "send");
    setError("");
    setNotice("");
    try {
      const response = await onRequestOtp(trimmed);
      startOtpWindow(response);
      setOtp("");
      setStep(STEPS.OTP);
      if (isResend) setNotice("A new verification code has been sent.");
      if (typeof window !== "undefined") {
        if (remember) localStorage.setItem(REMEMBER_KEY, trimmed);
        else localStorage.removeItem(REMEMBER_KEY);
      }
    } catch (requestError) {
      setError(friendlyError(requestError));
    } finally {
      submitLock.current = false;
      setBusy("");
    }
  };

  const verify = async (code = otp) => {
    if (submitLock.current) return;
    if (code.length !== OTP_LENGTH) {
      setError("Enter the complete six-digit verification code.");
      return;
    }
    if (expired) {
      setError("Your OTP has expired. Please request a new OTP.");
      return;
    }

    submitLock.current = true;
    setBusy("verify");
    setError("");
    setNotice("");
    try {
      await onVerifyOtp(mobile.trim(), code);
      setStep(STEPS.DONE);
      onAuthenticated?.();
    } catch (verifyError) {
      setError(friendlyError(verifyError));
      setOtp("");
      otpInputRef.current?.focus();
    } finally {
      submitLock.current = false;
      setBusy("");
    }
  };

  const onOtpChange = (value) => {
    // Accepts a pasted code with spaces or dashes just as readily as typing.
    const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
    setOtp(digits);
    setError("");
    // Submitting on the sixth digit removes a pointless extra tap on a phone.
    if (digits.length === OTP_LENGTH) verify(digits);
  };

  const changeNumber = () => {
    setStep(STEPS.MOBILE);
    setOtp("");
    setMeta(null);
    setError("");
    setNotice("");
  };

  const digits = useMemo(() => Array.from({ length: OTP_LENGTH }, (_, i) => otp[i] || ""), [otp]);
  const isSubmitting = Boolean(busy);

  if (step === STEPS.DONE) {
    return (
      <section className="auth-card auth-card--success" aria-live="polite">
        <span className="auth-success-icon" aria-hidden="true">
          <svg viewBox="0 0 52 52" className="auth-success-icon__mark">
            <circle className="auth-success-icon__ring" cx="26" cy="26" r="23" />
            <path className="auth-success-icon__check" d="M15 27.5 L22.5 35 L37.5 19" />
          </svg>
        </span>
        <h2>Authentication Successful</h2>
        <p>Loading your dashboard...</p>
        <LoaderCircle className="auth-spinner" size={22} aria-hidden="true" />
      </section>
    );
  }

  const onMobile = step === STEPS.MOBILE;

  return (
    <section className="auth-card" data-step={step} aria-labelledby="auth-card-title">
      <span className="auth-card__sheen" aria-hidden="true" />

      <header className="auth-card__header">
        <div className="auth-card__title-row">
          <div>
            <p className="auth-card__eyebrow">{onMobile ? "Secure sign in" : "Verify your identity"}</p>
            <h2 id="auth-card-title">{onMobile ? "Welcome Back" : "Enter Verification Code"}</h2>
          </div>
          <span className="auth-card__shield" aria-hidden="true">
            {onMobile ? <Smartphone size={21} /> : <KeyRound size={21} />}
          </span>
        </div>
        <p className="auth-card__description">
          {onMobile
            ? `Sign in with your registered ${ORGANIZATION_NAME} mobile number.`
            : `We sent a six-digit code to ${meta?.maskedMobile || "your registered mobile number"}.`}
        </p>
      </header>

      <form
        key={step}
        className="auth-form auth-form--step"
        noValidate
        aria-label={onMobile ? "Mobile sign in form" : "Verification form"}
        onSubmit={(event) => {
          event.preventDefault();
          if (onMobile) sendOtp(false);
          else verify();
        }}
      >
        {onMobile ? (
          <div className="auth-field">
            <label htmlFor="login-mobile">Mobile Number</label>
            <div className={`auth-field__control${error ? " auth-field__control--error" : ""}`}>
              <span className="auth-field__dialcode" aria-hidden="true">
                +91
              </span>
              <input
                ref={mobileInputRef}
                id="login-mobile"
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="98765 43210"
                value={mobile}
                onChange={(event) => {
                  setMobile(event.target.value);
                  setError("");
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "login-mobile-error" : "login-mobile-help"}
                disabled={isSubmitting}
              />
            </div>
            {error ? (
              // role="alert" rather than the shared status region below: that
              // region only renders `notice`, so an error never reached it and a
              // screen reader user heard nothing on a failed attempt.
              <p className="auth-field__message" id="login-mobile-error" role="alert">
                <CircleAlert size={13} aria-hidden="true" />
                {error}
              </p>
            ) : (
              <p className="auth-field__hint" id="login-mobile-help">
                Enter the mobile number registered with your account.
              </p>
            )}

            <label className="auth-checkbox">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                disabled={isSubmitting}
              />
              <span aria-hidden="true">
                <Check size={12} />
              </span>
              Remember this number on this device
            </label>
          </div>
        ) : (
          <div className="auth-otp">
            <div className="auth-field">
              <label htmlFor="login-otp">Six-digit verification code</label>

              {/*
                One real input carries the label, the value, paste and
                `one-time-code` autofill. The boxes are presentation drawn
                behind it, so nothing about the accessibility or autofill
                contract depends on them.
              */}
              <div className={`auth-otp__field${error ? " auth-otp__field--error" : ""}`}>
                <input
                  ref={otpInputRef}
                  id="login-otp"
                  className="auth-otp__input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  value={otp}
                  onChange={(event) => onOtpChange(event.target.value)}
                  onPaste={(event) => {
                    event.preventDefault();
                    onOtpChange(event.clipboardData.getData("text"));
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "login-otp-error" : "login-otp-help"}
                  disabled={isSubmitting}
                />
                <div className="auth-otp__boxes" aria-hidden="true">
                  {digits.map((digit, index) => (
                    <span
                      key={index}
                      className={`auth-otp__box${digit ? " auth-otp__box--filled" : ""}${
                        index === otp.length ? " auth-otp__box--active" : ""
                      }`}
                    >
                      {digit}
                    </span>
                  ))}
                </div>
              </div>

              {error ? (
                // Announced on insert. This field auto-submits on the sixth
                // digit, so focus is often still in the input and never moves to
                // reveal the description - the message has to speak for itself.
                <p className="auth-field__message" id="login-otp-error" role="alert">
                  <CircleAlert size={13} aria-hidden="true" />
                  {error}
                </p>
              ) : (
                <p
                  className={`auth-otp__timer${expired ? " auth-otp__timer--expired" : ""}`}
                  id="login-otp-help"
                  role="status"
                >
                  {expired
                    ? "Your OTP has expired. Please request a new OTP."
                    : `Code expires in ${formatCountdown(secondsLeft)}`}
                </p>
              )}
            </div>

            <div className="auth-otp__actions">
              <button
                type="button"
                className="auth-text-button"
                onClick={() => sendOtp(true)}
                disabled={isSubmitting || resendIn > 0}
              >
                {busy === "resend" ? "Sending..." : resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
              </button>
              <button type="button" className="auth-text-button" onClick={changeNumber} disabled={isSubmitting}>
                <ArrowLeft size={14} aria-hidden="true" />
                Change number
              </button>
            </div>
          </div>
        )}

        <div className="auth-status-region" aria-live="assertive" aria-atomic="true">
          {notice && !error ? (
            <p className="auth-status auth-status--info" role="status">
              {notice}
            </p>
          ) : null}
        </div>

        <button
          type="submit"
          className="auth-primary-button"
          disabled={isSubmitting || (!onMobile && expired)}
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="auth-spinner" size={18} aria-hidden="true" />
              <span>{onMobile ? "Sending OTP..." : "Verifying..."}</span>
            </>
          ) : (
            <>
              <LockKeyhole size={17} aria-hidden="true" />
              <span>{onMobile ? "Send OTP" : "Verify & Continue"}</span>
              <ArrowRight className="auth-primary-button__arrow" size={17} aria-hidden="true" />
            </>
          )}
        </button>
      </form>

      <footer className="auth-card__footer">
        <LockKeyhole size={17} aria-hidden="true" />
        <p>
          {APP_TITLE} uses one-time codes, CSRF protection and role-based permissions. Never share
          your code with anyone.
        </p>
      </footer>
    </section>
  );
};

export default MobileOtpLogin;
