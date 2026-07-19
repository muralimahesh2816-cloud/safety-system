import {
  BellRing,
  Check,
  ClipboardCheck,
  LockKeyhole,
  ShieldCheck,
  UsersRound
} from "lucide-react";
import LoginPanel from "../components/login/LoginPanel";
import brandMark from "../assets/topbarlogo.svg";
import LiveRoadScene from "../components/visuals/LiveRoadScene";
import {
  APP_TITLE,
  APP_VERSION,
  ORGANIZATION_NAME,
  PORTAL_BRAND_NAME
} from "../config/appConfig";
import "../styles/login.css";
import "../styles/login/login.scss";

const benefits = [
  {
    icon: ClipboardCheck,
    title: "Structured approvals",
    description: "Keep work permits and safety actions moving through clear workflows."
  },
  {
    icon: BellRing,
    title: "Timely safety updates",
    description: "Stay informed about hazards, near misses, and assigned actions."
  },
  {
    icon: UsersRound,
    title: "Role-based access",
    description: "Give every team member the right level of operational visibility."
  }
];

const BrandLockup = ({ compact = false }) => (
  <div className={`login-brand-lockup${compact ? " login-brand-lockup--compact" : ""}`}>
    <span className="login-brand-mark" aria-hidden="true">
      <img src={brandMark} alt="" />
    </span>
    <span>
      <strong>{PORTAL_BRAND_NAME}</strong>
      <small>{ORGANIZATION_NAME}</small>
    </span>
  </div>
);

const LoginPage = ({ onLogin, onVerifyOtp, onResendOtp }) => (
  <main className="enterprise-login" aria-labelledby="login-page-title">
    <div className="enterprise-login__backdrop" aria-hidden="true">
      <LiveRoadScene />
      <span className="enterprise-login__orb enterprise-login__orb--blue" />
      <span className="enterprise-login__orb enterprise-login__orb--orange" />
      <span className="enterprise-login__grid" />
    </div>

    <div className="enterprise-login__shell">
      <section className="enterprise-login__auth" aria-label="Secure account sign in">
        <div className="enterprise-login__mobile-brand">
          <BrandLockup compact />
        </div>

        <LoginPanel
          onLogin={onLogin}
          onVerifyOtp={onVerifyOtp}
          onResendOtp={onResendOtp}
        />

        <p className="enterprise-login__legal">
          <LockKeyhole size={14} aria-hidden="true" />
          Authorized access only. Activity may be monitored for security and compliance.
        </p>
      </section>

      <section className="enterprise-login__brand" aria-labelledby="login-page-title">
        <header className="enterprise-login__brand-header">
          <BrandLockup />
          <div className="enterprise-login__secure-indicator">
            <span aria-hidden="true" />
            Secure portal
          </div>
        </header>

        <div className="enterprise-login__brand-copy">
          <p className="enterprise-login__eyebrow">
            <ShieldCheck size={16} aria-hidden="true" />
            {APP_TITLE}
          </p>
          <h1 id="login-page-title">Building a Safer Workplace, Together</h1>
          <p className="enterprise-login__intro">
            Manage work approvals, hazard reporting, training records, and safety actions
            through one secure enterprise platform.
          </p>

          <div className="enterprise-login__benefits" aria-label="Portal benefits">
            {benefits.map(({ icon: Icon, title, description }) => (
              <article className="enterprise-login__benefit" key={title}>
                <span className="enterprise-login__benefit-icon" aria-hidden="true">
                  <Icon size={19} />
                </span>
                <span>
                  <strong>{title}</strong>
                  <small>{description}</small>
                </span>
                <Check className="enterprise-login__benefit-check" size={16} aria-hidden="true" />
              </article>
            ))}
          </div>
        </div>

        <footer className="enterprise-login__brand-footer">
          <span>Safety Management System</span>
          <span className="enterprise-login__footer-divider" aria-hidden="true" />
          <span>Portal v{APP_VERSION}</span>
        </footer>
      </section>
    </div>
  </main>
);

export default LoginPage;
