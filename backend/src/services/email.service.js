const { env, isProduction } = require("../config/env");
const logger = require("../utils/logger");

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 30 * 1000;
const MAX_QUEUE_SIZE = 100;
const retryQueue = [];
let retryTimer = null;

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

const deliverMail = async (mailOptions) => {
  const transporter = createTransporter();
  await transporter.sendMail(mailOptions);
  return { sent: true };
};

const scheduleRetryProcessor = () => {
  if (retryTimer || retryQueue.length === 0) return;
  retryTimer = setTimeout(async () => {
    retryTimer = null;
    await processRetryQueue();
  }, RETRY_DELAY_MS);
  if (typeof retryTimer.unref === "function") retryTimer.unref();
};

const enqueueEmailRetry = (mailOptions, error, attempt = 1) => {
  if (attempt > MAX_RETRY_ATTEMPTS) {
    logger.error("Email retry attempts exhausted", {
      to: mailOptions.to,
      subject: mailOptions.subject,
      message: error.message
    });
    return;
  }

  if (retryQueue.length >= MAX_QUEUE_SIZE) {
    logger.error("Email retry queue is full", {
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    return;
  }

  retryQueue.push({
    mailOptions,
    attempt
  });
  logger.warn("Email queued for retry", {
    to: mailOptions.to,
    subject: mailOptions.subject,
    attempt,
    message: error.message
  });
  scheduleRetryProcessor();
};

async function processRetryQueue() {
  const queued = retryQueue.splice(0, retryQueue.length);
  for (const item of queued) {
    try {
      await deliverMail(item.mailOptions);
      logger.info("Queued email delivered", {
        to: item.mailOptions.to,
        subject: item.mailOptions.subject,
        attempt: item.attempt
      });
    } catch (error) {
      enqueueEmailRetry(item.mailOptions, error, item.attempt + 1);
    }
  }
}

const getEmailQueueStatus = () => ({
  queued: retryQueue.length,
  maxQueueSize: MAX_QUEUE_SIZE,
  maxRetryAttempts: MAX_RETRY_ATTEMPTS,
  retryDelayMs: RETRY_DELAY_MS
});

const sendMailWithRetry = async (mailOptions = {}) => {
  if (!hasSmtpConfig()) {
    if (isProduction) {
      const error = new Error("Email delivery is not configured");
      error.statusCode = 500;
      throw error;
    }
    logger.info("Development email skipped", {
      to: mailOptions.to,
      subject: mailOptions.subject
    });
    return { skipped: true };
  }

  try {
    return await deliverMail(mailOptions);
  } catch (error) {
    enqueueEmailRetry(mailOptions, error);
    throw error;
  }
};

const sendOtpEmail = async ({ to, name, otp }) => {
  if (!hasSmtpConfig()) {
    if (isProduction) {
      const error = new Error("Email delivery is not configured");
      error.statusCode = 500;
      throw error;
    }
    logger.warn("Development OTP email skipped because SMTP is not configured", { recipientConfigured: Boolean(to) });
    return { skipped: true };
  }

  const mailOptions = {
    from: env.smtp.from,
    to,
    subject: `Your ${env.appName} login OTP`,
    text: `Your ${env.appName} login OTP is ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#020617;color:#e2e8f0;padding:28px">
        <div style="max-width:520px;margin:auto;border:1px solid rgba(255,255,255,.16);border-radius:18px;padding:24px;background:rgba(15,23,42,.88)">
          <p style="color:#5eead4;text-transform:uppercase;letter-spacing:.16em;font-size:12px">${env.appName} Secure Login</p>
          <h2 style="margin:8px 0 14px;color:#fff">Hello ${name || "there"},</h2>
          <p>Use this 6 digit OTP to complete your login. It expires in 5 minutes.</p>
          <div style="font-size:32px;font-weight:700;letter-spacing:10px;color:#67e8f9;margin:24px 0">${otp}</div>
          <p style="font-size:12px;color:#94a3b8">If you did not request this code, please contact your administrator.</p>
        </div>
      </div>
    `
  };

  return sendMailWithRetry(mailOptions);
};

module.exports = {
  sendOtpEmail,
  sendMailWithRetry,
  getEmailQueueStatus
};
