import { useState } from "react";
import { BellRing, ClipboardCheck, LockKeyhole, Mail, ShieldCheck, Smartphone, UsersRound } from "lucide-react";
import MobileOtpLogin from "../components/login/MobileOtpLogin";
import LoginPanel from "../components/login/LoginPanel";
import Safety3DLoginScene from "../components/login/Safety3DLoginScene";
import MomentumLogo from "../components/brand/MomentumLogo";
import brandLogo from "../assets/vertis-logo.svg";
import { APP_TITLE } from "../config/appConfig";
import "../styles/login/login.scss";
import "../styles/login/scene.scss";

/**
 * The login experience.
 *
 * Structure follows the cinematic composition: the safety environment on the
 * left, the sign-in panel on the right. The scene is decorative and
 * `aria-hidden`; everything a user needs is in the panel, which works with the
 * scene entirely disabled.
 *
 * Sign-in is mobile number + OTP by default.
 *
 * The email/password route is retained behind a link rather than removed, and
 * that is a deliberate operational requirement, not indecision: `mobileNumber`
 * is a new field, so until an administrator has a number on file for someone,
 * OTP is not a route they can use. Removing the email path outright would lock
 * every existing user out of a safety system on deployment day — including the
 * administrators who would need to get back in to fix it. The mobile flow is
 * what the page leads with; email is the documented fallback.
 */
const benefits = [
  [ClipboardCheck, "Structured approvals", "Keep work permits and safety actions moving through clear workflows."],
  [BellRing, "Timely safety updates", "Assignments reach you on WhatsApp and in the portal the moment they are raised."],
  [UsersRound, "Role-based access", "Give every team member the right level of operational visibility."]
];

const LoginPage = ({ onRequestMobileOtp, onVerifyMobileOtp, onLogin, onVerifyOtp, onResendOtp }) => {
  const [useEmail, setUseEmail] = useState(false);

  return (
  <main className="corporate-login" aria-label="Safety Management System sign in">
    <Safety3DLoginScene />

    <section className="corporate-login__legacy-copy" aria-labelledby="login-page-title">
      <p className="corporate-login__eyebrow">
        <ShieldCheck size={16} aria-hidden="true" />
        {APP_TITLE}
      </p>
      <h1 id="login-page-title">Building a Safer Workplace, Together</h1>
      <p className="corporate-login__intro">
        Manage work approvals, hazard reporting, training records, and safety actions through one
        secure enterprise platform.
      </p>
      <div className="corporate-login__benefits" aria-label="Portal benefits">
        {benefits.map(([Icon, title, description]) => (
          <article key={title}>
            <Icon size={18} aria-hidden="true" />
            <span>
              <strong>{title}</strong>
              <small>{description}</small>
            </span>
          </article>
        ))}
      </div>
    </section>

    <section className="corporate-login__content" aria-label="Secure account sign in">
      <div className="corporate-login__brandbar">
        <MomentumLogo size="sm" />
        <img src={brandLogo} alt="Vertis" className="corporate-login__brandmark" />
      </div>

      {useEmail ? (
        <LoginPanel onLogin={onLogin} onVerifyOtp={onVerifyOtp} onResendOtp={onResendOtp} />
      ) : (
        <MobileOtpLogin onRequestOtp={onRequestMobileOtp} onVerifyOtp={onVerifyMobileOtp} />
      )}

      <button type="button" className="corporate-login__switch" onClick={() => setUseEmail((value) => !value)}>
        {useEmail ? (
          <>
            <Smartphone size={14} aria-hidden="true" />
            Sign in with mobile number instead
          </>
        ) : (
          <>
            <Mail size={14} aria-hidden="true" />
            Use email and password instead
          </>
        )}
      </button>

      <p className="corporate-login__legal">
        <LockKeyhole size={14} aria-hidden="true" />
        Authorized access only. Activity may be monitored for security and compliance.
      </p>
    </section>
  </main>
  );
};

export default LoginPage;
