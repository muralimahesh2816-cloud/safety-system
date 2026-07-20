import { LockKeyhole } from "lucide-react";
import LoginPanel from "../components/login/LoginPanel";
import momentumMark from "../assets/topbarlogo.svg";
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

const LoginPage = ({ onLogin, onVerifyOtp, onResendOtp }) => (
  <main className="corporate-login" aria-label="Safety Management System sign in">
    <AnimatedCorporateBackground />
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
