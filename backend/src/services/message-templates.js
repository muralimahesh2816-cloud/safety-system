const { env } = require("../config/env");

/**
 * WhatsApp message bodies.
 *
 * Kept as data in one file so the wording can be reviewed and changed without
 * touching workflow code, and so every assignment message reads consistently.
 *
 * Two rules govern what may appear in these:
 *
 *  1. **No authentication material.** Links point at the record's normal URL.
 *     The recipient signs in as they always would. A link that logged someone
 *     in would turn a forwarded WhatsApp message into an account takeover.
 *  2. **No sensitive personal data.** WhatsApp is outside the portal's
 *     security boundary and messages persist on personal devices, so these
 *     carry only what the assignee needs in order to know something is waiting
 *     for them.
 */

const APP_NAME = env.appName || "Safety Management System";

const portalUrl = (path = "") => {
  const base = String(env.publicAppUrl || "").replace(/\/+$/, "");
  const suffix = String(path || "").replace(/^\/+/, "");
  return suffix ? `${base}/${suffix}` : base;
};

const line = (label, value) => (value ? `${label}: ${value}` : null);

const compose = (lines) => lines.filter(Boolean).join("\n");

const workAssignment = ({
  name,
  approvalNo,
  workType,
  location,
  chainage,
  role,
  assignedBy,
  action,
  recordId
}) =>
  compose([
    `*${APP_NAME}*`,
    "",
    `Hello ${name || "there"},`,
    "",
    "A Work Approval has been assigned to you.",
    "",
    line("Work Approval No", approvalNo),
    line("Work Type", workType),
    line("Location", location),
    line("Chainage", chainage),
    line("Assigned Role", role),
    line("Assigned By", assignedBy),
    line("Required Action", action),
    "",
    "Open Work Approval:",
    portalUrl(recordId ? `work?record=${recordId}` : "work"),
    "",
    "Please review and complete the required action.",
    `— ${APP_NAME}`
  ]);

const hazardAssignment = ({ name, hazardNo, category, location, riskLevel, assignedBy, action, recordId }) =>
  compose([
    `*${APP_NAME}*`,
    "",
    `Hello ${name || "there"},`,
    "",
    "A Hazard has been assigned to you.",
    "",
    line("Hazard No", hazardNo),
    line("Category", category),
    line("Location", location),
    line("Risk Level", riskLevel),
    line("Assigned By", assignedBy),
    line("Required Action", action),
    "",
    "Open Hazard:",
    portalUrl(recordId ? `hazards?record=${recordId}` : "hazards"),
    "",
    "Please review and take the required action.",
    `— ${APP_NAME}`
  ]);

const complaintAssignment = ({ name, complaintNo, subject, location, assignedBy, action, recordId }) =>
  compose([
    `*${APP_NAME}*`,
    "",
    `Hello ${name || "there"},`,
    "",
    "A complaint has been assigned to you.",
    "",
    line("Complaint No", complaintNo),
    line("Subject", subject),
    line("Location", location),
    line("Assigned By", assignedBy),
    line("Required Action", action),
    "",
    "Open Complaint:",
    portalUrl(recordId ? `complaints?record=${recordId}` : "complaints"),
    "",
    `— ${APP_NAME}`
  ]);

/**
 * Generic fallback for any other assignment notification the portal raises, so
 * a new module gets a sensible WhatsApp message without needing a template
 * written for it first.
 */
const genericAssignment = ({ name, title, message, moduleLabel, assignedBy, url }) =>
  compose([
    `*${APP_NAME}*`,
    "",
    `Hello ${name || "there"},`,
    "",
    title,
    message ? "" : null,
    message || null,
    "",
    line("Module", moduleLabel),
    line("Assigned By", assignedBy),
    "",
    url ? "Open in the portal:" : null,
    url || portalUrl(""),
    "",
    `— ${APP_NAME}`
  ]);

const loginOtp = ({ name, otp, expiresInMinutes }) =>
  compose([
    `*${APP_NAME}*`,
    "",
    `Hello ${name || "there"},`,
    "",
    `Your one-time sign-in code is *${otp}*.`,
    `It expires in ${expiresInMinutes} minutes.`,
    "",
    "Do not share this code with anyone. Safety Management System staff will never ask you for it.",
    `— ${APP_NAME}`
  ]);

module.exports = {
  complaintAssignment,
  genericAssignment,
  hazardAssignment,
  loginOtp,
  portalUrl,
  workAssignment
};
