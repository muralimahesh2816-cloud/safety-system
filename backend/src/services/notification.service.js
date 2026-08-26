const Notification = require("../models/Notification");
const User = require("../models/User");
const CompanySettings = require("../models/CompanySettings");
const { ROLES, normalizeRole } = require("../constants/roles");
const { toActionPermissions } = require("../middleware/permission.middleware");
const { env } = require("../config/env");
const { sendMailWithRetry } = require("./email.service");
const { getChainageFrom, getChainageTo, formatChainageRange } = require("../utils/chainage");
const logger = require("../utils/logger");
const { enqueue } = require("./outbound-queue.service");
const templates = require("./message-templates");
const { maskPhone } = require("../utils/phone");

const CHECKER_ROLES = [
  ROLES.SAFETY_OFFICER,
  ROLES.SAFETY_ENGINEER,
  ROLES.SITE_ENGINEER,
  ROLES.PROJECT_ENGINEER,
  ROLES.MAINTENANCE_ENGINEER
];

const RECOMMENDER_ROLES = [ROLES.SAFETY_MANAGER];

const FINAL_APPROVER_ROLES = [
  ROLES.PROJECT_MANAGER,
  ROLES.MAINTENANCE_MANAGER
];

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN];
const getFinalApproverRoles = () =>
  env.workflowAdminOverrideEnabled ? [...FINAL_APPROVER_ROLES, ...ADMIN_ROLES] : FINAL_APPROVER_ROLES;

const buildWorkUrl = (workId) =>
  `${String(env.publicAppUrl || env.backendPublicUrl).replace(/\/+$/, "")}/work-approvals/${workId}`;

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
  `${env.appName} - Generated Automatically - Do not reply - ${new Date().getFullYear()}`
].join("\n");

const buildWorkEmailHtml = async ({ title, intro, work, actionLabel, actionUrl, progress = [], extraRows = [] }) => {
  const settings = await getCompanySettings();
  const logoUrl = settings?.logo?.url || "";
  const companyName = settings?.companyName || env.appName;
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
    : ["Created", "Pending Check", "Pending Recommendation", "Pending Final Approval", "Approved", "Completed"];

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
  }).select("name email mobileNumber role permissions notificationPreferences");

  const byId = new Map();
  users.forEach((user) => byId.set(String(user._id), user));

  if (workPermission) {
    const permissionUsers = await User.find({ status: "active" }).select("name email mobileNumber role permissions notificationPreferences");
    permissionUsers
      .filter((user) => hasWorkPermission(user, workPermission))
      .forEach((user) => byId.set(String(user._id), user));
  }

  return Array.from(byId.values());
};

const getUsersByIds = async (ids = []) => {
  const cleanIds = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (!cleanIds.length) return [];
  return User.find({ _id: { $in: cleanIds }, status: "active" }).select("name email mobileNumber role permissions notificationPreferences");
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
  // { event, body, templateName?, templateVariables? } — when present and the
  // recipient has a mobile number on file, the message is queued for WhatsApp.
  whatsapp,
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

  // WhatsApp is a third delivery channel on the same funnel that already
  // handles in-app and email. Hooking it here rather than in each controller
  // is what keeps assignment notifications consistent: any code path that
  // notifies a user about an assignment gets WhatsApp for free, and there is
  // exactly one place where the rules about who gets messaged live.
  //
  // Queued, never awaited for delivery — `enqueue` is a single insert, so an
  // assignment response is never delayed by an external API.
  const wantsWhatsApp =
    channels.whatsapp !== false &&
    preferences.whatsapp !== false &&
    Boolean(user.mobileNumber) &&
    Boolean(whatsapp);

  if (wantsWhatsApp) {
    try {
      await enqueue({
        recipient: user._id,
        recipientPhone: user.mobileNumber,
        recipientName: user.name || "",
        event: whatsapp.event || type,
        body: whatsapp.body,
        relatedModule: module,
        relatedRecordId,
        notification: notification?._id || null,
        templateName: whatsapp.templateName || "",
        templateVariables: whatsapp.templateVariables || []
      });
    } catch (error) {
      logger.warn("WhatsApp notification could not be queued", {
        userId: String(user._id),
        to: maskPhone(user.mobileNumber),
        message: error.message
      });
    }
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
  await Promise.all(
    uniqueUsers.map((user) => {
      // The WhatsApp body is addressed to a person, so it is rendered per
      // recipient here rather than once by the caller.
      const whatsapp = payload.whatsapp?.build
        ? { ...payload.whatsapp, body: payload.whatsapp.build(user) }
        : payload.whatsapp;
      return createEnterpriseNotification({ ...payload, user, whatsapp });
    })
  );
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

  const chainageFrom = work.requestedChainageFrom || work.chainageFrom || work.chainageNo || "";
  const chainageTo = work.requestedChainageTo || work.chainageTo || chainageFrom;

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
    },
    // Rendered per stage rather than per recipient: every user notified about
    // this stage transition gets the same factual summary, with their own name
    // substituted by the queue-side template.
    whatsapp: {
      event: "work_assignment",
      build: (user) =>
        templates.workAssignment({
          name: user.name,
          approvalNo: model.workId,
          workType: work.workType || work.title || "",
          location: work.location || work.plaza || "",
          chainage: chainageFrom ? `${chainageFrom} to ${chainageTo}` : "",
          role: user.role ? String(user.role).replace(/_/g, " ") : "",
          assignedBy: work.createdByName || "",
          action: actionLabel || "Review this work approval",
          recordId: model.id
        }),
      templateName: env.whatsapp.assignmentTemplate || ""
    }
  });
};

const buildAssignedWorkMessage = (work, stage, assignedBy = "") => {
  const recordId = work.approvalNumber || (work._id ? `WA-${String(work._id).slice(-8).toUpperCase()}` : "Work approval");
  const chainageFrom = work.requestedChainageFrom || work.chainageFrom || work.chainageNo || "-";
  const chainageTo = work.requestedChainageTo || work.chainageTo || chainageFrom;
  return `${recordId} | Creator: ${work.createdByName || "-"} | Location: ${work.location || "-"} | Chainage: ${chainageFrom} to ${chainageTo} | Workers: ${work.workersCount || 0} | Stage: ${stage}${assignedBy ? ` | Assigned by: ${assignedBy}` : ""}`;
};

const notifyWorkCreated = async ({ work, actorId }) => {
  const users = await getUsersByIds([work.assignedChecker]);
  return sendWorkStageNotification({
    users,
    work,
    title: "New Work Approval Assigned to You",
    intro: `${work.createdByName || "A creator"} assigned a new work approval to you for checking.`,
    message: buildAssignedWorkMessage(work, "Pending Check", work.createdByName || "Creator"),
    actionLabel: "Review Work Approval",
    priority: "high",
    color: "orange",
    progress: ["Created", "Pending Check"],
    createdBy: actorId
  });
};

const notifyWorkChecked = async ({ work, actorId }) => {
  const users = await getUsersByIds([work.assignedRecommender]);
  return sendWorkStageNotification({
    users,
    work,
    title: "Work Approval Assigned for Recommendation",
    intro: `${work.checkedBy || "The checker"} assigned this checked work approval to you for recommendation.`,
    message: buildAssignedWorkMessage(work, "Pending Recommendation", work.checkedBy || "Checker"),
    actionLabel: "Review Recommendation",
    priority: "high",
    color: "purple",
    progress: ["Created", "Checked", "Pending Recommendation"],
    createdBy: actorId
  });
};

const notifyWorkRecommended = async ({ work, actorId }) => {
  const users = await getUsersByIds([work.assignedFinalApprover]);
  return sendWorkStageNotification({
    users,
    work,
    title: "Work Approval Assigned for Final Approval",
    intro: `${work.recommendedBy || "The Safety Manager"} assigned this recommended work approval to you for final approval.`,
    message: buildAssignedWorkMessage(work, "Pending Final Approval", work.recommendedBy || "Safety Manager"),
    actionLabel: "Review Final Approval",
    priority: "urgent",
    color: "red",
    progress: ["Created", "Checked", "Recommended", "Pending Final Approval"],
    createdBy: actorId
  });
};

const notifyWorkReassigned = async ({
  work,
  actorId,
  newAssigneeId,
  previousAssigneeId,
  stage,
  reason = ""
}) => {
  const [newUsers, previousUsers] = await Promise.all([
    getUsersByIds([newAssigneeId]),
    getUsersByIds([previousAssigneeId])
  ]);
  const stageLabel = {
    check: "checking",
    recommendation: "recommendation",
    finalApproval: "final approval"
  }[stage] || "review";

  const notifications = [
    sendWorkStageNotification({
      users: newUsers,
      work,
      title: "Work Approval Reassigned to You",
      intro: `An administrator reassigned this work approval to you for ${stageLabel}.`,
      message: `${buildAssignedWorkMessage(work, stageLabel, "Administrator")} | Reason: ${reason || "-"}`,
      actionLabel: "Open Assigned Work",
      priority: "high",
      color: "orange",
      progress: ["Created", `Assigned for ${stageLabel}`],
      createdBy: actorId,
      extraRows: [["Reassignment Reason", reason || "-"]],
      data: { assignmentStage: stage, reason }
    })
  ];

  if (previousUsers.length && String(previousAssigneeId) !== String(newAssigneeId)) {
    notifications.push(sendWorkStageNotification({
      users: previousUsers,
      work,
      title: "Work Approval Assignment Changed",
      intro: `This work approval is no longer assigned to you for ${stageLabel}.`,
      message: `${work.workType || work.title || "Work approval"} was reassigned by an administrator.`,
      actionLabel: "View Work Approval",
      priority: "medium",
      color: "blue",
      progress: ["Created", "Reassigned"],
      createdBy: actorId,
      extraRows: [["Reassignment Reason", reason || "-"]],
      data: { assignmentStage: stage, reason }
    }));
  }

  return Promise.all(notifications);
};

const notifyWorkApproved = async ({ work, actorId }) => {
  const users = await getUsersByIds([work.createdBy]);
  return sendWorkStageNotification({
    users,
    work,
    title: "Work Final Approved",
    intro: "Your work approval has received final approval. You may now proceed with execution and upload completion evidence.",
    message: "Your work approval has received final approval. You may now proceed with execution and upload completion evidence.",
    actionLabel: "Open Work Approval",
    priority: "medium",
    color: "green",
    progress: ["Created", "Checked", "Recommended", "Final Approved"],
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

/**
 * Is this notification telling someone that work is now theirs?
 *
 * Deliberately conservative: only messages that actually hand a person
 * responsibility go to WhatsApp. Everything else stays in-app.
 */
const isAssignmentNotification = ({ type, title }) => {
  const haystack = `${type || ""} ${title || ""}`.toLowerCase();
  return /assign|allocated|awaiting your|for your (review|approval|action)/.test(haystack);
};

/** Chooses the right template for the module raising the assignment. */
const buildAssignmentWhatsAppBody = ({ user, type, title, message, data, module, recordId, url }) => {
  const name = user.name;
  const assignedBy = data.assignedByName || data.createdByName || "";

  if (module === "hazards" || type === "hazard") {
    return templates.hazardAssignment({
      name,
      hazardNo: data.hazardNo || data.referenceId || (recordId ? `HZ-${String(recordId).slice(-8).toUpperCase()}` : ""),
      category: data.category || "",
      location: data.location || "",
      riskLevel: data.riskLevel || data.severity || "",
      assignedBy,
      action: data.action || "Review this hazard and record the corrective action.",
      recordId
    });
  }

  if (module === "complaints" || type === "complaint") {
    return templates.complaintAssignment({
      name,
      complaintNo: data.complaintNo || data.referenceId || (recordId ? String(recordId).slice(-8).toUpperCase() : ""),
      subject: data.subject || title,
      location: data.location || "",
      assignedBy,
      action: data.action || "Review this complaint and record the action taken.",
      recordId
    });
  }

  return templates.genericAssignment({
    name,
    title,
    message,
    moduleLabel: module,
    assignedBy,
    url: url || templates.portalUrl(module || "")
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
  const user = users[0];
  const resolvedModule = module || type || "";
  const resolvedRecordId =
    relatedRecordId || data.workId || data.hazardId || data.complaintId || data.trainingId || null;

  return createEnterpriseNotification({
    user,
    type,
    title,
    message,
    data,
    priority,
    icon: icon || "bell",
    color: color || (priority === "high" || priority === "urgent" ? "orange" : "blue"),
    module: resolvedModule,
    relatedRecordId: resolvedRecordId,
    url: url || "",
    createdBy,
    // Only assignment-style notifications go out on WhatsApp. A routine
    // status update does not warrant a message on someone's personal phone,
    // and treating every notification as WhatsApp-worthy is how a useful
    // channel becomes one people mute.
    whatsapp: isAssignmentNotification({ type, title })
      ? {
          event: `${type}_assigned`,
          body: buildAssignmentWhatsAppBody({
            user,
            type,
            title,
            message,
            data,
            module: resolvedModule,
            recordId: resolvedRecordId,
            url
          }),
          templateName: env.whatsapp.assignmentTemplate || ""
        }
      : undefined
  });
};

module.exports = {
  CHECKER_ROLES,
  RECOMMENDER_ROLES,
  FINAL_APPROVER_ROLES,
  buildWorkUrl,
  createEnterpriseNotification,
  createNotification,
  notifyWorkCreated,
  notifyWorkChecked,
  notifyWorkRecommended,
  notifyWorkReassigned,
  notifyWorkApproved,
  notifyWorkReturned,
  notifyWorkCompleted
};
