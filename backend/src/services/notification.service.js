const Notification = require("../models/Notification");
const User = require("../models/User");
const CompanySettings = require("../models/CompanySettings");
const { ROLES, normalizeRole } = require("../constants/roles");
const { toActionPermissions } = require("../middleware/permission.middleware");
const { env } = require("../config/env");
const { sendMailWithRetry } = require("./email.service");
const { getChainageFrom, getChainageTo, formatChainageRange } = require("../utils/chainage");
const logger = require("../utils/logger");

const CHECKER_ROLES = [
  ROLES.SAFETY_OFFICER,
  ROLES.SAFETY_ENGINEER,
  ROLES.SITE_ENGINEER,
  ROLES.PROJECT_ENGINEER,
  ROLES.MAINTENANCE_ENGINEER
];

const FINAL_APPROVER_ROLES = [
  ROLES.PROJECT_MANAGER,
  ROLES.MAINTENANCE_MANAGER,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN
];

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];

const firstFrontendUrl = () =>
  String(env.frontendUrl || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)[0] || env.backendPublicUrl;

const buildWorkUrl = (workId) => `${firstFrontendUrl().replace(/\/+$/, "")}/work-approvals/${workId}`;

const roleTitle = (role = "") =>
  String(role || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const getCompanySettings = async () => {
  try {
    return await CompanySettings.findOne().lean();
  } catch (_error) {
    return null;
  }
};

const workValue = (work, key, fallback = "") => {
  const raw = typeof work?.toObject === "function" ? work.toObject() : work || {};
  return raw[key] ?? fallback;
};

const toWorkEmailModel = (work = {}) => ({
  id: workValue(work, "_id", ""),
  workId: workValue(work, "approvalNumber", "") || `WA-${String(workValue(work, "_id", "")).slice(-8).toUpperCase()}`,
  title: workValue(work, "title", "Work Approval"),
  workType: workValue(work, "workType", workValue(work, "title", "Work Approval")),
  location: workValue(work, "location", "-"),
  chainage: formatChainageRange(work) || `${getChainageFrom(work)} to ${getChainageTo(work)}`,
  createdBy: workValue(work, "createdByName", "") || work?.createdBy?.name || "-",
  createdAt: workValue(work, "createdAt", new Date()),
  workersCount: workValue(work, "workersCount", 0),
  priority: workValue(work, "priority", "Medium"),
  status: workValue(work, "workflowStage", "") || workValue(work, "status", ""),
  description: workValue(work, "description", "")
});

const buildPlainText = ({ title, intro, work, actionLabel, actionUrl, extraLines = [] }) => [
  title,
  "",
  intro,
  "",
  `Work Type: ${work.workType}`,
  `Work ID: ${work.workId}`,
  `Location: ${work.location}`,
  `Chainage: ${work.chainage}`,
  `Created By: ${work.createdBy}`,
  `Created Date: ${new Date(work.createdAt).toLocaleString()}`,
  `Workers Count: ${work.workersCount}`,
  `Priority: ${work.priority}`,
  `Status: ${work.status}`,
  `Description: ${work.description || "-"}`,
  ...extraLines,
  "",
  `${actionLabel}: ${actionUrl}`,
  "",
  `UTPL Safety Management System - Generated Automatically - Do not reply - ${new Date().getFullYear()}`
].join("\n");

const buildWorkEmailHtml = async ({ title, intro, work, actionLabel, actionUrl, progress = [], extraRows = [] }) => {
  const settings = await getCompanySettings();
  const logoUrl = settings?.logo?.url || "";
  const companyName = settings?.companyName || "UTPL Safety Management System";
  const rows = [
    ["Work Type", work.workType],
    ["Work ID", work.workId],
    ["Location", work.location],
    ["Chainage", work.chainage],
    ["Created By", work.createdBy],
    ["Created Date", new Date(work.createdAt).toLocaleString()],
    ["Workers Count", work.workersCount],
    ["Priority", work.priority],
    ["Status", work.status],
    ["Description", work.description || "-"],
    ...extraRows
  ];
  const progressItems = progress.length
    ? progress
    : ["Created", "Pending Check", "Pending Final Approval", "Approved", "Completed"];

  return `<!doctype html>
<html>
  <body style="margin:0;background:#07111f;color:#e5edf7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07111f;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;border:1px solid rgba(148,163,184,.22);border-radius:24px;overflow:hidden;background:#0b1627;">
            <tr>
              <td style="padding:28px;background:linear-gradient(135deg,#052e49,#0f766e 55%,#f97316);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#cffafe;">Safety Workflow Notification</div>
                      <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;color:#ffffff;">${escapeHtml(title)}</h1>
                    </td>
                    <td align="right" style="width:92px;">
                      ${
                        logoUrl
                          ? `<img src="${escapeHtml(logoUrl)}" width="72" height="72" alt="${escapeHtml(companyName)}" style="border-radius:18px;background:rgba(255,255,255,.14);object-fit:contain;padding:8px;">`
                          : `<div style="width:72px;height:72px;border-radius:18px;background:rgba(255,255,255,.14);text-align:center;line-height:72px;font-weight:700;color:#fff;">HSE</div>`
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:26px;">
                <p style="margin:0 0 18px;color:#cbd5e1;font-size:15px;line-height:1.7;">${escapeHtml(intro)}</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;border-spacing:0 8px;">
                  ${rows
                    .map(
                      ([label, value]) => `<tr>
                    <td style="width:170px;padding:12px 14px;border-radius:12px 0 0 12px;background:#111f33;color:#93c5fd;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">${escapeHtml(label)}</td>
                    <td style="padding:12px 14px;border-radius:0 12px 12px 0;background:#0f1b2d;color:#f8fafc;font-size:14px;">${escapeHtml(value)}</td>
                  </tr>`
                    )
                    .join("")}
                </table>
                <div style="margin:22px 0 18px;">
                  <div style="font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:#99f6e4;margin-bottom:10px;">Workflow Progress</div>
                  <table role="presentation" cellspacing="0" cellpadding="0" width="100%">
                    <tr>
                      ${progressItems
                        .map(
                          (item, index) => `<td style="padding:0 4px 0 0;">
                        <div style="height:8px;border-radius:999px;background:${index < progressItems.length - 1 ? "#14b8a6" : "#f97316"};"></div>
                        <div style="margin-top:6px;color:#cbd5e1;font-size:11px;">${escapeHtml(item)}</div>
                      </td>`
                        )
                        .join("")}
                    </tr>
                  </table>
                </div>
                <a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:6px;padding:14px 20px;border-radius:14px;background:linear-gradient(135deg,#0ea5e9,#14b8a6);color:#ffffff;text-decoration:none;font-weight:700;">${escapeHtml(actionLabel)}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 26px;background:#081322;border-top:1px solid rgba(148,163,184,.18);color:#94a3b8;font-size:12px;line-height:1.6;">
                ${escapeHtml(companyName)}<br>
                Generated Automatically - Do not reply - ${new Date().getFullYear()}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const hasWorkPermission = (user, action) => {
  const permissions = toActionPermissions(user.permissions || {}, normalizeRole(user.role));
  return permissions.work?.[action] === true;
};

const getActiveUsersByRolesOrPermission = async ({ roles = [], workPermission = "" }) => {
  const normalizedRoles = roles.map(normalizeRole);
  const users = await User.find({
    status: "active",
    $or: [
      { role: { $in: normalizedRoles } },
      ...(normalizedRoles.includes(ROLES.SUPER_ADMIN) ? [{ role: ROLES.SUPER_ADMIN }] : [])
    ]
  }).select("name email role permissions notificationPreferences");

  const byId = new Map();
  users.forEach((user) => byId.set(String(user._id), user));

  if (workPermission) {
    const permissionUsers = await User.find({ status: "active" }).select("name email role permissions notificationPreferences");
    permissionUsers
      .filter((user) => hasWorkPermission(user, workPermission))
      .forEach((user) => byId.set(String(user._id), user));
  }

  return Array.from(byId.values());
};

const getUsersByIds = async (ids = []) => {
  const cleanIds = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (!cleanIds.length) return [];
  return User.find({ _id: { $in: cleanIds }, status: "active" }).select("name email role permissions notificationPreferences");
};

const getAdminUsers = () => getActiveUsersByRolesOrPermission({ roles: ADMIN_ROLES });

const createEnterpriseNotification = async ({
  user,
  title,
  message,
  type = "work_approval",
  priority = "medium",
  icon = "clipboard-check",
  color = "blue",
  module = "work",
  relatedRecordId,
  url = "",
  data = {},
  createdBy,
  email,
  channels = {}
}) => {
  if (!user?._id) return null;
  const preferences = user.notificationPreferences || {};
  const wantsInApp = channels.inApp !== false && preferences.inApp !== false;
  const wantsEmail = Boolean(email) && channels.email !== false && preferences.email !== false;

  let notification = null;
  if (wantsInApp) {
    notification = await Notification.create({
      user: user._id,
      role: user.role || "",
      type,
      title,
      message,
      priority,
      icon,
      color,
      module,
      relatedModule: module,
      relatedRecordId,
      url,
      data,
      createdBy,
      deliveryChannels: {
        inApp: true,
        email: wantsEmail,
        pushReady: true
      }
    });
  }

  if (wantsEmail && user.email) {
    try {
      await sendMailWithRetry({
        from: env.smtp.from || env.smtp.user,
        to: user.email,
        subject: email.subject || title,
        text: email.text,
        html: email.html
      });
    } catch (error) {
      logger.warn("Workflow email queued after delivery failure", {
        userId: user._id,
        email: user.email,
        subject: email.subject || title,
        message: error.message
      });
    }
  }

  return notification;
};

const notifyUsers = async (users, payload) => {
  const uniqueUsers = Array.from(new Map(users.map((user) => [String(user._id), user])).values());
  await Promise.all(uniqueUsers.map((user) => createEnterpriseNotification({ user, ...payload })));
  return uniqueUsers.length;
};

const sendWorkStageNotification = async ({
  users,
  work,
  title,
  intro,
  message,
  actionLabel,
  priority = "high",
  color = "orange",
  progress,
  createdBy,
  extraRows = [],
  data = {}
}) => {
  const model = toWorkEmailModel(work);
  const actionUrl = buildWorkUrl(model.id);
  const html = await buildWorkEmailHtml({
    title,
    intro,
    work: model,
    actionLabel,
    actionUrl,
    progress,
    extraRows
  });
  const text = buildPlainText({
    title,
    intro,
    work: model,
    actionLabel,
    actionUrl,
    extraLines: extraRows.map(([label, value]) => `${label}: ${value}`)
  });

  return notifyUsers(users, {
    title,
    message,
    type: "work_approval",
    priority,
    icon: "clipboard-check",
    color,
    module: "work",
    relatedRecordId: model.id,
    url: actionUrl,
    createdBy,
    data: {
      workId: model.id,
      approvalNumber: model.workId,
      ...data
    },
    email: {
      subject: title,
      text,
      html
    }
  });
};

const notifyWorkCreated = async ({ work, actorId }) => {
  const users = await getActiveUsersByRolesOrPermission({ roles: CHECKER_ROLES, workPermission: "check" });
  return sendWorkStageNotification({
    users,
    work,
    title: "New Work Approval Requires Review",
    intro: "A new work approval has been created and requires checker review.",
    message: `${work.workType || work.title || "Work approval"} requires review at ${work.location || "-"}.`,
    actionLabel: "Review Work Approval",
    priority: "high",
    color: "orange",
    progress: ["Created", "Pending Check"],
    createdBy: actorId
  });
};

const notifyWorkChecked = async ({ work, actorId }) => {
  const users = await getActiveUsersByRolesOrPermission({ roles: FINAL_APPROVER_ROLES, workPermission: "approve" });
  return sendWorkStageNotification({
    users,
    work,
    title: "Work Approval Ready for Final Approval",
    intro: "A work approval has been checked and is ready for final approval.",
    message: `${work.workType || work.title || "Work approval"} is ready for final approval.`,
    actionLabel: "Review Final Approval",
    priority: "urgent",
    color: "red",
    progress: ["Created", "Checked", "Pending Final Approval"],
    createdBy: actorId
  });
};

const notifyWorkApproved = async ({ work, actorId }) => {
  const users = await getUsersByIds([work.createdBy]);
  return sendWorkStageNotification({
    users,
    work,
    title: "Work Approved",
    intro: "Your work approval has been approved. You may now proceed with execution and upload completion evidence.",
    message: "Your work approval has been approved. You may now proceed with execution and upload completion evidence.",
    actionLabel: "Open Work Approval",
    priority: "medium",
    color: "green",
    progress: ["Created", "Checked", "Approved"],
    createdBy: actorId
  });
};

const notifyWorkReturned = async ({ work, actorId, reason = "" }) => {
  const users = await getUsersByIds([work.createdBy]);
  return sendWorkStageNotification({
    users,
    work,
    title: "Work Returned for Correction",
    intro: "A submitted work approval has been returned and requires correction.",
    message: `${work.workType || work.title || "Work approval"} was returned for correction.`,
    actionLabel: "Edit Work Approval",
    priority: "urgent",
    color: "red",
    progress: ["Created", "Returned"],
    createdBy: actorId,
    extraRows: [
      ["Returned By", work.returnedBy || "-"],
      ["Role", roleTitle(work.returnedByRole || "")],
      ["Reason", reason || work.returnDescription || "-"]
    ],
    data: { reason }
  });
};

const notifyWorkCompleted = async ({ work, actorId }) => {
  const stageUserIds = [
    work.createdBy,
    work.checkedById,
    work.recommendedById,
    work.approvedById
  ];
  const [stageUsers, admins] = await Promise.all([getUsersByIds(stageUserIds), getAdminUsers()]);
  return sendWorkStageNotification({
    users: [...stageUsers, ...admins],
    work,
    title: "Work Completed Successfully",
    intro: "A work approval has been completed successfully with completion evidence.",
    message: `${work.workType || work.title || "Work approval"} has been completed successfully.`,
    actionLabel: "View Completed Work",
    priority: "medium",
    color: "green",
    progress: ["Created", "Checked", "Recommended", "Approved", "Completed"],
    createdBy: actorId
  });
};

const createNotification = async ({
  userId,
  type,
  title,
  message,
  data = {},
  priority = "medium",
  icon,
  color,
  module,
  relatedRecordId,
  url,
  createdBy
}) => {
  const users = await getUsersByIds([userId]);
  if (!users.length) return null;
  return createEnterpriseNotification({
    user: users[0],
    type,
    title,
    message,
    data,
    priority,
    icon: icon || "bell",
    color: color || (priority === "high" || priority === "urgent" ? "orange" : "blue"),
    module: module || type || "",
    relatedRecordId: relatedRecordId || data.workId || data.hazardId || data.trainingId || null,
    url: url || "",
    createdBy
  });
};

module.exports = {
  CHECKER_ROLES,
  FINAL_APPROVER_ROLES,
  buildWorkUrl,
  createEnterpriseNotification,
  createNotification,
  notifyWorkCreated,
  notifyWorkChecked,
  notifyWorkApproved,
  notifyWorkReturned,
  notifyWorkCompleted
};
