import { useEffect, useState } from "react";
import { ShieldCheck, ShieldX, ShieldAlert, Loader2 } from "lucide-react";
import { certificateService } from "../api/services";
import { APP_NAME } from "../config/appConfig";
import "../styles/login/login.scss";

const readCodeFromUrl = () => {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return (params.get("code") || "").trim();
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric" }).format(date);
};

// Only the minimum fields the spec allows on the public verification page
// (section 9): certificate number, status, employee name, training name,
// completion date, and who issued it. No employee ID, department, plaza,
// assessment score, or any other internal detail is ever requested or
// rendered here — the backend's GET /certificates/verify/:code response
// already omits them (see backend/src/routes/certificates.routes.js), and
// this page does not add its own network calls that could leak more.
const STATUS_PRESENTATION = {
  VALID: {
    tone: { borderColor: "#bfe3cd", background: "#eefaf1", color: "#1c6b3f" },
    icon: ShieldCheck,
    heading: "Valid certificate"
  },
  REVOKED: {
    tone: { borderColor: "#f3c6c6", background: "#fdecec", color: "#9b1400" },
    icon: ShieldX,
    heading: "Certificate revoked"
  },
  EXPIRED: {
    tone: { borderColor: "#f3ddb3", background: "#fdf6e6", color: "#8a6a1f" },
    icon: ShieldAlert,
    heading: "Certificate expired"
  }
};

/**
 * Public, unauthenticated certificate-verification page. Reached via the
 * link/code printed on a training-completion certificate
 * (?code=VERIFICATION_CODE). Intentionally outside the authenticated app
 * shell — see the early-return check in App.js's AppContent.
 */
const VerifyCertificatePage = () => {
  const [code, setCode] = useState(readCodeFromUrl);
  const [status, setStatus] = useState(code ? "loading" : "idle");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!code) {
      setStatus("idle");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    certificateService
      .verify(code)
      .then((response) => {
        if (cancelled) return;
        setResult(response);
        setStatus(response?.certificate ? "found" : "not-found");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("not-found");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    const url = new URL(window.location.href);
    url.searchParams.set("code", trimmed);
    window.history.replaceState({}, "", url);
    setCode(trimmed);
  };

  const certificate = result?.certificate;
  const presentation = certificate ? STATUS_PRESENTATION[certificate.status] : null;
  const StatusIcon = presentation?.icon;

  return (
    <main className="corporate-login" aria-label="Certificate verification">
      <div className="corporate-login__background" aria-hidden="true">
        <div className="corporate-login__grid" />
        <div className="corporate-login__glow corporate-login__glow--primary" />
      </div>
      <section className="corporate-login__content" style={{ alignItems: "center" }} aria-label="Verify a certificate">
        <div className="auth-card" style={{ textAlign: "center" }}>
          <a
            href="/"
            style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 14, fontSize: 12, color: "#8a8580", textDecoration: "none" }}
          >
            ← Back to Sign In
          </a>
          <h2 style={{ marginBottom: 4 }}>Certificate Verification</h2>
          <p className="auth-card__description">
            Confirm the authenticity of a {APP_NAME} training-completion certificate using the code printed on it.
          </p>

          <form onSubmit={handleSubmit} className="auth-form" style={{ marginTop: 20 }}>
            <div className="auth-field">
              <label htmlFor="verify-code">Verification code</label>
              <div className="auth-field__control">
                <input
                  id="verify-code"
                  value={code}
                  onChange={(event) => setCode(event.target.value.toUpperCase())}
                  placeholder="e.g. 4F2A9C1B0E77"
                  autoComplete="off"
                />
              </div>
            </div>
            <button type="submit" className="auth-primary-button">Verify</button>
          </form>

          <div className="auth-status-region" style={{ marginTop: 18, textAlign: "left" }}>
            {status === "loading" ? (
              <div className="auth-status auth-status--info">
                <Loader2 size={16} className="auth-spinner" aria-hidden="true" />
                <span>Checking certificate...</span>
              </div>
            ) : null}

            {status === "found" && certificate && presentation ? (
              <div className="auth-status" style={{ ...presentation.tone, flexDirection: "column", alignItems: "flex-start", gap: 6 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <StatusIcon size={18} aria-hidden="true" />
                  <strong>{presentation.heading}</strong>
                </span>
                <span style={{ fontSize: 12 }}>
                  Certificate Number: {certificate.certificateNumber}
                  <br />
                  Status: {certificate.status}
                  <br />
                  Employee: {certificate.userName}
                  <br />
                  Training: {certificate.trainingTitle}
                  <br />
                  Completion Date: {formatDate(certificate.completedAt)}
                  <br />
                  Issued By: {certificate.issuedBy}
                </span>
              </div>
            ) : null}

            {status === "not-found" ? (
              <div className="auth-status auth-status--error">
                <ShieldX size={18} aria-hidden="true" />
                <span>No certificate matches this code. Check the code and try again.</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
};

export default VerifyCertificatePage;
