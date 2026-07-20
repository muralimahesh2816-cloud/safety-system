import { BellRing, ClipboardCheck, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import LoginPanel from "../components/login/LoginPanel";
import momentumMark from "../assets/topbarlogo.svg";
import { APP_TITLE } from "../config/appConfig";
import "../styles/login/login.scss";

const AnimatedCorporateBackground = () => (
  <div className="corporate-login__background" aria-hidden="true">
    <div className="corporate-login__grid" />
    <div className="corporate-login__glow corporate-login__glow--primary" />
    <div className="corporate-login__glow corporate-login__glow--warm" />
    <div className="corporate-login__momentum-positioner">
      <div className="corporate-login__momentum-rotator" data-testid="rotating-momentum-svg">
        <img src={momentumMark} alt="" draggable="false" />
      </div>
    </div>
    <div className="corporate-login__vignette" />
  </div>
);

const benefits = [
  [ClipboardCheck, "Structured approvals", "Keep work permits and safety actions moving through clear workflows."],
  [BellRing, "Timely safety updates", "Stay informed about hazards, near misses, and assigned actions."],
  [UsersRound, "Role-based access", "Give every team member the right level of operational visibility."]
];

const LoginPage = ({ onLogin, onVerifyOtp, onResendOtp }) => (
  <main className="corporate-login" aria-label="Safety Management System sign in">
    <AnimatedCorporateBackground />
    <section className="corporate-login__legacy-copy" aria-labelledby="login-page-title">
      <p className="corporate-login__eyebrow"><ShieldCheck size={16} aria-hidden="true" />{APP_TITLE}</p>
      <h1 id="login-page-title">Building a Safer Workplace, Together</h1>
      <p className="corporate-login__intro">Manage work approvals, hazard reporting, training records, and safety actions through one secure enterprise platform.</p>
      <div className="corporate-login__benefits" aria-label="Portal benefits">
        {benefits.map(([Icon,title,description])=><article key={title}><Icon size={18} aria-hidden="true"/><span><strong>{title}</strong><small>{description}</small></span></article>)}
      </div>
    </section>
    <section className="corporate-login__content" aria-label="Secure account sign in">
      <LoginPanel
        onLogin={onLogin}
        onVerifyOtp={onVerifyOtp}
        onResendOtp={onResendOtp}
      />
      <p className="corporate-login__legal">
        <LockKeyhole size={14} aria-hidden="true" />
        Authorized access only. Activity may be monitored for security and compliance.
      </p>
    </section>
  </main>
);

export default LoginPage;
