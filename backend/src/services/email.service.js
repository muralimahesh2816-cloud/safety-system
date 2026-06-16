const { env, isProduction } = require("../config/env");
const logger = require("../utils/logger");

const hasSmtpConfig = () =>
  Boolean(env.smtp.host && env.smtp.port && env.smtp.user && env.smtp.pass && env.smtp.from);

const createTransporter = () => {
  let nodemailer;
  try {
    // Lazy-load so development OTP logging works even before dependencies are installed.
    // eslint-disable-next-line global-require
    nodemailer = require("nodemailer");
  } catch (_error) {
    const error = new Error("Nodemailer dependency is not installed");
    error.statusCode = 500;
    throw error;
  }
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass
    }
  });
};

const sendOtpEmail = async ({ to, name, otp }) => {
  if (!hasSmtpConfig()) {
    if (isProduction) {
      const error = new Error("Email delivery is not configured");
      error.statusCode = 500;
      throw error;
    }
    logger.info(`Development OTP for ${to}: ${otp}`);
    return { skipped: true };
  }

  const transporter = createTransporter();
  await transporter.sendMail({
    from: env.smtp.from,
    to,
    subject: "Your Safety HSE login OTP",
    text: `Your Safety HSE login OTP is ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#020617;color:#e2e8f0;padding:28px">
        <div style="max-width:520px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:24px;background:rgba(15,23,42,.88)">
          <p style="color:#5eead4;text-transform:uppercase;letter-spacing:.16em;font-size:12px">Safety HSE Secure Login</p>
          <h2 style="margin:8px 0 14px;color:#fff">Hello ${name || "there"},</h2>
          <p>Use this 6 digit OTP to complete your login. It expires in 5 minutes.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:10px;color:#67e8f9;margin:24px 0">${otp}</div>
          <p style="font-size:12px;color:#94a3b8">If you did not request this code, please contact your administrator.</p>
        </div>
      </div>
    `
  });

  return { sent: true };
};

module.exports = {
  sendOtpEmail
};
