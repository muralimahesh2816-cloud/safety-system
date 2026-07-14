import axios from "axios";
import { client } from "./client";
import { API_BASE_URL } from "../config/appConfig";
import { normalizePermissions, toPermissionPayload } from "../utils/permissions";
import { getChainageFrom, getChainageTo } from "../utils/chainage";

const LOCAL_BACKEND_ROOT = API_BASE_URL.replace(/\/api\/v1\/?$/, "");
const LEGACY_BASE_URL = process.env.REACT_APP_LEGACY_API_URL || LOCAL_BACKEND_ROOT;

const legacyClient = axios.create({
  baseURL: LEGACY_BASE_URL
});

const localLegacyClient = axios.create({
  baseURL: LOCAL_BACKEND_ROOT,
  withCredentials: true
});

const SETTINGS_CACHE_KEY = "hse_settings_cache";

const safeJsonParse = (value, fallback = null) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
};

const getLegacyUserFromStorage = () => {
  if (typeof window === "undefined") return null;

  const modern = safeJsonParse(localStorage.getItem("hse_user"), null);
  if (modern) return modern;

  const id = localStorage.getItem("id") || localStorage.getItem("userId") || "";
  const name = localStorage.getItem("name") || "";
  const email = localStorage.getItem("email") || "";
  const mobile = localStorage.getItem("mobile") || "";
  const role = localStorage.getItem("role") || "";
  const profileImage = localStorage.getItem("profileImage") || "";

  if (!id && !email) return null;

  return {
    id,
    name,
    email,
    mobile,
    role,
    status: "active",
    profilePhoto: profileImage ? { url: profileImage } : null,
    permissions: {}
  };
};

const getLocalActivities = () => {
  if (typeof window === "undefined") return [];
  return safeJsonParse(localStorage.getItem("hse_local_activities"), []) || [];
};

const toMonthKey = (value) => {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
};

const monthShort = (value) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short"
  }).format(value);

const buildDashboardSummaryFallback = ({
  workRecords = [],
  hazardRecords = [],
  users = [],
  trainingRecords = []
}) => {
  const totalWorkApprovals = workRecords.length;
  const pendingWork = workRecords.filter((item) => item.status === "Pending" || !item.status).length;
  const approvedWork = workRecords.filter((item) => item.status === "Approved").length;
  const completedWork = workRecords.filter((item) => item.status === "Completed").length;
  const rejectedWork = workRecords.filter((item) => item.status === "Rejected").length;

  const totalHazards = hazardRecords.length;
  const openHazards = hazardRecords.filter((item) => item.status === "Open" || !item.status).length;
  const closedHazards = hazardRecords.filter((item) => item.status === "Closed").length;
  const inProgressHazards = hazardRecords.filter((item) => item.status === "In Progress").length;

  const totalUsers = users.length;
  const activeUsers = users.filter((item) => !item.status || item.status === "active").length;
  const trainingCount = trainingRecords.length;

  const monthlyBucket = [];
  const indexMap = new Map();
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    indexMap.set(key, monthlyBucket.length);
    monthlyBucket.push({
      month: monthShort(d),
      work: 0,
      hazards: 0,
      trainingCompletions: 0,
      _key: key
    });
  }

  workRecords.forEach((item) => {
    const idx = indexMap.get(toMonthKey(item.createdAt || item.date));
    if (idx !== undefined) monthlyBucket[idx].work += 1;
  });

  hazardRecords.forEach((item) => {
    const idx = indexMap.get(toMonthKey(item.createdAt || item.date));
    if (idx !== undefined) monthlyBucket[idx].hazards += 1;
  });

  trainingRecords.forEach((item) => {
    const completions = item.completions || [];
    completions.forEach((completion) => {
      if (!completion?.isCompleted || !completion?.completedAt) return;
      const idx = indexMap.get(toMonthKey(completion.completedAt));
      if (idx !== undefined) monthlyBucket[idx].trainingCompletions += 1;
    });
  });

  const userActivity = monthlyBucket.map((row) => ({
    month: row.month,
    logins: users.filter((item) => toMonthKey(item.lastLoginAt) === row._key).length
  }));

  const safetyPerformanceScore = Math.min(
    100,
    Math.round(
      (totalWorkApprovals === 0 ? 100 : (completedWork / totalWorkApprovals) * 100) * 0.6 +
        (totalHazards === 0 ? 100 : (closedHazards / totalHazards) * 100) * 0.4
    )
  );

  const workActivities = workRecords.map((item) => ({
    id: item._id,
    module: "work",
    action: item.status || "Pending",
    message: `${item.workType || item.title || "Work"} ${item.status || "Pending"} at ${
      item.location || "-"
    }`,
    timestamp: item.updatedAt || item.createdAt
  }));

  const hazardActivities = hazardRecords.map((item) => ({
    id: item._id,
    module: "hazards",
    action: item.status || "Open",
    message: `${item.category || "Hazard"} ${item.status || "Open"} at ${item.location || "-"}`,
    timestamp: item.updatedAt || item.createdAt
  }));

  const trainingActivities = trainingRecords.map((item) => ({
    id: item._id,
    module: "training",
    action: "Published",
    message: `Training module available: ${item.title || "Training"}`,
    timestamp: item.updatedAt || item.createdAt
  }));

  const loginActivities = users
    .filter((item) => item.lastLoginAt)
    .map((item) => ({
      id: item._id,
      module: "users",
      action: "Login",
      message: `${item.name || item.email || "User"} login activity`,
      timestamp: item.lastLoginAt
    }));

  const reportActivities = getLocalActivities().map((item) => ({
    id: item.id,
    module: item.module || "reports",
    action: item.action || "Exported",
    message: item.message || "Report exported",
    timestamp: item.timestamp
  }));

  const activities = [
    ...workActivities,
    ...hazardActivities,
    ...trainingActivities,
    ...loginActivities,
    ...reportActivities
  ]
    .filter((item) => item.timestamp)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 15);

  return {
    success: true,
    kpis: {
      totalUsers,
      activeUsers,
      totalWorkApprovals,
      pendingWork,
      approvedWork,
      completedWork,
      totalHazards,
      openHazards,
      closedHazards,
      trainingRecords: trainingCount
    },
    charts: {
      workStatus: [
        { name: "Pending", value: pendingWork },
        { name: "Approved", value: approvedWork },
        { name: "Completed", value: completedWork },
        { name: "Rejected", value: rejectedWork }
      ],
      hazardStatus: [
        { name: "Open", value: openHazards },
        { name: "In Progress", value: inProgressHazards },
        { name: "Closed", value: closedHazards }
      ],
      monthlyTrend: monthlyBucket.map(({ _key, ...rest }) => rest),
      userActivity,
      safetyPerformanceScore
    },
    activities
  };
};

const normalizeSettings = (value = {}) => {
  const security = value.security || {};
  const passwordPolicy = security.passwordPolicy || {};
  const branding = value.branding || {};
  const contactInformation = value.contactInformation || {};

  return {
    ...value,
    companyName: value.companyName || value.company || "Enterprise Safety",
    address: value.address || "",
    gstNumber: value.gstNumber || value.gstNo || "",
    website: value.website || "",
    contactInformation: {
      email: contactInformation.email || value.companyEmail || "",
      phone: contactInformation.phone || value.phone || ""
    },
    branding: {
      themeSelection: branding.themeSelection || value.themeSelection || value.theme || "dark",
      accentColor: branding.accentColor || value.accentColor || "#1dd3b0",
      dashboardBanner: branding.dashboardBanner || value.dashboardBanner || "",
      loginBackground: branding.loginBackground || value.loginBackground || ""
    },
    security: {
      sessionTimeout: Number(security.sessionTimeout || value.sessionTimeout || 30),
      loginAttempts: Number(security.loginAttempts || value.loginAttempts || 5),
      twoFactorAuthentication: Boolean(
        security.twoFactorAuthentication ?? value.twoFactorAuthentication ?? false
      ),
      passwordPolicy: {
        minLength: Number(passwordPolicy.minLength || value.passwordMinLength || 8),
        requireUppercase: passwordPolicy.requireUppercase ?? value.requireUppercase ?? true,
        requireLowercase: passwordPolicy.requireLowercase ?? value.requireLowercase ?? true,
        requireNumber: passwordPolicy.requireNumber ?? value.requireNumber ?? true,
        requireSpecial: passwordPolicy.requireSpecial ?? value.requireSpecial ?? false
      }
    }
  };
};

const getCachedSettings = () => {
  if (typeof window === "undefined") return null;
  return safeJsonParse(localStorage.getItem(SETTINGS_CACHE_KEY), null);
};

const cacheSettings = (settings) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settings));
};

const toLegacyProfilePayload = (payload = {}) => ({
  ...payload,
  companyEmail: payload.contactInformation?.email || "",
  phone: payload.contactInformation?.phone || "",
  gstNo: payload.gstNumber || ""
});

const toLegacySecurityPayload = (payload = {}) => ({
  ...payload,
  sessionTimeout: Number(payload.sessionTimeout || 30),
  passwordMinLength: Number(payload.passwordPolicy?.minLength || 8),
  requireUppercase: payload.passwordPolicy?.requireUppercase ?? true,
  requireLowercase: payload.passwordPolicy?.requireLowercase ?? true,
  requireNumber: payload.passwordPolicy?.requireNumber ?? true,
  requireSpecial: payload.passwordPolicy?.requireSpecial ?? false
});

const toAbsoluteLegacyUpload = (value) => {
  if (!value) return "";
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  let normalized = String(value || "").replace(/\\/g, "/");
  const splitByUploads = normalized.split("/uploads/");
  if (splitByUploads.length > 1) {
    normalized = splitByUploads.pop() || "";
  }
  normalized = normalized.replace(/^\/+/, "").replace(/^uploads\//i, "");
  return `${LOCAL_BACKEND_ROOT}/uploads/${normalized}`;
};

const mapWorkRecord = (item = {}) => {
  const beforeImages =
    item.beforeImages && item.beforeImages.length > 0
      ? item.beforeImages
      : item.beforeImage
      ? [{ url: toAbsoluteLegacyUpload(item.beforeImage), legacyFilename: item.beforeImage }]
      : [];

  const afterImages =
    item.afterImages && item.afterImages.length > 0
      ? item.afterImages
      : item.afterImage
      ? [{ url: toAbsoluteLegacyUpload(item.afterImage), legacyFilename: item.afterImage }]
      : [];

  const chainageFrom = getChainageFrom(item);
  const chainageTo = getChainageTo(item);

  return {
    ...item,
    title: item.title || item.workType || "Work Approval",
    workType: item.workType || item.title || "",
    description: item.description || item.workDescription || "",
    category: item.category || "General",
    priority: item.priority || "Medium",
    chainageFrom,
    chainageTo,
    chainage: item.chainage || chainageFrom,
    chainageNo: item.chainageNo || item.chainage || chainageFrom,
    status: item.status || "Pending",
    beforeImages,
    afterImages,
    beforeImage: item.beforeImage || beforeImages?.[0]?.url || "",
    afterImage: item.afterImage || afterImages?.[0]?.url || "",
    workflow: item.workflow || [],
    comments: item.comments || [],
    approvalHistory: item.approvalHistory || [],
    timeline: item.timeline || [],
    digitalSignatures: item.digitalSignatures || [],
    approvedBy: item.approvedBy || ""
  };
};

const mapHazardRecord = (item = {}) => {
  const evidenceImages =
    item.evidenceImages && item.evidenceImages.length > 0
      ? item.evidenceImages
      : item.beforeImage
      ? [{ url: toAbsoluteLegacyUpload(item.beforeImage), legacyFilename: item.beforeImage }]
      : [];

  const closureImages =
    item.closureImages && item.closureImages.length > 0
      ? item.closureImages
      : item.afterImage
      ? [{ url: toAbsoluteLegacyUpload(item.afterImage), legacyFilename: item.afterImage }]
      : [];

  return {
    ...item,
    title: item.title || item.plaza || "Hazard",
    description: item.description || `${item.category || "Hazard"} at ${item.location || "-"}`,
    plaza: item.plaza || "",
    severity: item.severity || "Medium",
    likelihood: item.likelihood || "Possible",
    riskScore: Number(item.riskScore || 0),
    status: item.status === "Closed" ? "Closed" : "Open",
    action: item.action || "",
    date: item.date || item.createdAt || "",
    reportedBy:
      typeof item.reportedBy === "object" ? item.reportedBy?.name || "" : item.reportedBy || "",
    evidenceImages,
    closureImages,
    beforeImage: item.beforeImage || evidenceImages?.[0]?.url || "",
    afterImage: item.afterImage || closureImages?.[0]?.url || ""
  };
};

const mapTrainingRecord = (item = {}) => {
  const thumbnail =
    typeof item.thumbnail === "string"
      ? { url: item.thumbnail }
      : item.thumbnail?.url
      ? item.thumbnail
      : item.banner
      ? { url: toAbsoluteLegacyUpload(item.banner) }
      : null;

  const video =
    typeof item.video === "string"
      ? { url: toAbsoluteLegacyUpload(item.video), legacyFilename: item.video }
      : item.video?.url
      ? item.video
      : null;

  return {
    ...item,
    thumbnail,
    video,
    banner: item.banner || (typeof item.thumbnail === "string" ? item.thumbnail : ""),
    completions: item.completions || []
  };
};

const toDateValue = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const withinDateRange = (value, fromDate, toDate) => {
  const d = toDateValue(value);
  if (!d) return false;
  if (fromDate && d < new Date(fromDate)) return false;
  if (toDate) {
    const endDate = new Date(toDate);
    endDate.setHours(23, 59, 59, 999);
    if (d > endDate) return false;
  }
  return true;
};

const normalizeReportRows = (rows = [], type = "work") =>
  rows.map((item) => {
    if (type === "hazard") {
      return {
        Date: item.date || item.createdAt || "-",
        Plaza: item.plaza || "-",
        Location: item.location || "-",
        "Reported By":
          typeof item.reportedBy === "object" ? item.reportedBy?.name || "-" : item.reportedBy || "-",
        Category: item.category || "-",
        Description: item.description || "-",
        "Risk Level": item.severity || "-",
        "Risk Score": item.riskScore ?? "-",
        "Action Team": item.action || item.actionTeam || "-",
        "Action Taken": item.actionTaken || "-",
        Status: item.status || "Open"
      };
    }

    return {
      Date: item.date || item.createdAt || "-",
      Plaza: item.plaza || "-",
      "Work Type": item.workType || item.title || "-",
      Description: item.description || "-",
      Location: item.location || "-",
      "Chainage From": getChainageFrom(item) || "-",
      "Chainage To": getChainageTo(item) || "-",
      "Workers Count": item.workersCount || "-",
      Priority: item.priority || "-",
      Status: item.status || "Pending",
      "Reported By": item.reportedBy || "-",
      "Approved By": item.approvedBy || "-",
      "Completion Date": item.completionDate || "-"
    };
  });

const buildLegacyReport = ({ type, fromDate, toDate, plaza, workData, hazardData }) => {
  if (type === "hazard") {
    const filtered = hazardData.filter(
      (item) =>
        withinDateRange(item.date || item.createdAt, fromDate, toDate) &&
        (!plaza || item.plaza === plaza)
    );
    return normalizeReportRows(filtered, "hazard");
  }

  if (type === "date") {
    const filtered = hazardData.filter(
      (item) =>
        withinDateRange(item.date || item.createdAt, fromDate, toDate) &&
        (!plaza || item.plaza === plaza)
    );
    const grouped = {};
    filtered.forEach((item) => {
      const dateKey = (item.date || item.createdAt || "").toString().split("T")[0] || "Unknown";
      if (!grouped[dateKey]) {
        grouped[dateKey] = { Date: dateKey, Total: 0, Open: 0, Closed: 0 };
      }
      grouped[dateKey].Total += 1;
      if (item.status === "Closed") grouped[dateKey].Closed += 1;
      else grouped[dateKey].Open += 1;
    });
    return Object.values(grouped).map((row) => ({
      ...row,
      "Closure Rate": row.Total ? `${Math.round((row.Closed / row.Total) * 100)}%` : "0%"
    }));
  }

  if (type === "user") {
    const grouped = {};
    hazardData
      .filter(
        (item) =>
          withinDateRange(item.date || item.createdAt, fromDate, toDate) &&
          (!plaza || item.plaza === plaza)
      )
      .forEach((item) => {
      const userKey =
        typeof item.reportedBy === "object"
          ? item.reportedBy?.name || "Unknown"
          : item.reportedBy || "Unknown";
      if (!grouped[userKey]) {
        grouped[userKey] = { user: userKey, hazardsUploaded: 0, open: 0, closed: 0 };
      }
      grouped[userKey].hazardsUploaded += 1;
      if (item.status === "Closed") grouped[userKey].closed += 1;
      else grouped[userKey].open += 1;
      });
    return Object.values(grouped).map((row) => ({
      "User Name": row.user,
      "Hazards Reported": row.hazardsUploaded,
      Open: row.open,
      Closed: row.closed,
      "Closure Rate": row.hazardsUploaded
        ? `${Math.round((row.closed / row.hazardsUploaded) * 100)}%`
        : "0%"
    }));
  }

  if (type === "approved") {
    const filtered = workData.filter(
      (item) =>
        withinDateRange(item.date || item.createdAt, fromDate, toDate) &&
        (!plaza || item.plaza === plaza) &&
        item.status === "Approved"
    );
    return filtered.map((item) => ({
      Date: item.date || item.createdAt || "-",
      "Work Type": item.workType || "-",
      Location: item.location || "-",
      "Chainage From": getChainageFrom(item) || "-",
      "Chainage To": getChainageTo(item) || "-",
      "Workers Count": item.workersCount || "-",
      "Approved By": item.approvedBy || "Admin",
      Status: item.status || "Approved"
    }));
  }

  const filtered = workData.filter(
    (item) =>
      withinDateRange(item.date || item.createdAt, fromDate, toDate) &&
      (!plaza || item.plaza === plaza)
  );
  return normalizeReportRows(filtered, "work");
};

const withLegacyFallback = async (primaryFn, legacyFn) => {
  try {
    return await primaryFn();
  } catch (_error) {
    return legacyFn();
  }
};

export const authService = {
  getCsrf: async () => {
    try {
      return (await client.get("/auth/csrf")).data;
    } catch (_error) {
      return { success: true, csrfToken: "" };
    }
  },
  login: async (payload) =>
    withLegacyFallback(
      async () => (await client.post("/auth/login", payload)).data,
      async () => {
        const legacy = await legacyClient.post("/login", payload);
        return {
          success: true,
          token: legacy.data.token,
          csrfToken: "",
          user: {
            id: legacy.data.id,
            name: legacy.data.name,
            email: legacy.data.email,
            mobile: legacy.data.mobile,
            role: legacy.data.role,
            status: "active",
            profilePhoto: legacy.data.profileImage
              ? { url: toAbsoluteLegacyUpload(legacy.data.profileImage) }
              : null,
            permissions: {}
          }
        };
      }
    ),
  logout: async () => {
    try {
      return (await client.post("/auth/logout")).data;
    } catch (_error) {
      return { success: true };
    }
  },
  me: async () =>
    withLegacyFallback(
      async () => (await client.get("/auth/me")).data,
      async () => ({ success: true, user: getLegacyUserFromStorage() })
    )
};

export const dashboardService = {
  summary: async () =>
    withLegacyFallback(
      async () => (await client.get("/dashboard/summary")).data,
      async () => {
        const [workRes, hazardRes, usersRes, trainingRes] = await Promise.allSettled([
          workService.list(),
          hazardService.list(),
          userService.list(),
          trainingService.list()
        ]);
        return buildDashboardSummaryFallback({
          workRecords: workRes.status === "fulfilled" ? workRes.value.records || [] : [],
          hazardRecords: hazardRes.status === "fulfilled" ? hazardRes.value.records || [] : [],
          users: usersRes.status === "fulfilled" ? usersRes.value.users || [] : [],
          trainingRecords: trainingRes.status === "fulfilled" ? trainingRes.value.records || [] : []
        });
      }
    )
};

export const userService = {
  list: async () =>
    withLegacyFallback(
      async () => {
        const response = (await client.get("/users")).data;
        return {
          ...response,
          users: (response.users || []).map((user) => ({
            ...user,
            _id: user._id || user.id,
            permissions: normalizePermissions(user.permissions, user.role)
          }))
        };
      },
      async () => {
        const res = await legacyClient.get("/users");
        const users = res.data || [];
        return {
          success: true,
          users: users.map((user) => ({
            ...user,
            _id: user._id || user.id,
            status: user.status || "active",
            permissions: normalizePermissions(user.permissions, user.role)
          }))
        };
      }
    ),
  create: async (payload) =>
    withLegacyFallback(
      async () => (await client.post("/users", payload)).data,
      async () => {
        const res = await legacyClient.post("/register", payload);
        return { success: true, message: res.data, user: { id: "", ...payload } };
      }
    ),
  update: async (id, payload) =>
    withLegacyFallback(
      async () => (await client.put(`/users/${id}`, payload)).data,
      async () => {
        const res = await legacyClient.put(`/users/${id}`, payload);
        return { success: true, message: res.data };
      }
    ),
  remove: async (id) =>
    withLegacyFallback(
      async () => (await client.delete(`/users/${id}`)).data,
      async () => {
        const res = await legacyClient.delete(`/users/${id}`);
        return { success: true, message: res.data };
      }
    ),
  resetPassword: async (id, newPassword) =>
    withLegacyFallback(
      async () => (await client.post(`/users/${id}/reset-password`, { newPassword })).data,
      async () => {
        const res = await legacyClient.put(`/users/${id}`, { password: newPassword });
        return { success: true, message: res.data };
      }
    ),
  block: async (id) =>
    withLegacyFallback(
      async () => (await client.post(`/users/${id}/block`)).data,
      async () => {
        const res = await legacyClient.put(`/users/${id}`, { status: "blocked" });
        return { success: true, message: res.data };
      }
    ),
  activate: async (id) =>
    withLegacyFallback(
      async () => (await client.post(`/users/${id}/activate`)).data,
      async () => {
        const res = await legacyClient.put(`/users/${id}`, { status: "active" });
        return { success: true, message: res.data };
      }
    ),
  updatePermissions: async (id, permissions) =>
    withLegacyFallback(
      async () =>
        (
          await client.put(`/users/${id}/permissions`, {
            permissions: toPermissionPayload(permissions)
          })
        ).data,
      async () => ({ success: true, message: "Permission update not supported on legacy endpoint" })
    ),
  uploadProfilePhoto: async (id, file) => {
    const formData = new FormData();
    formData.append("profilePhoto", file);
    return withLegacyFallback(
      async () => (await client.post(`/users/${id}/profile-photo`, formData)).data,
      async () => ({ success: true })
    );
  },
  loginHistory: async (id) =>
    withLegacyFallback(
      async () => (await client.get(`/users/${id}/login-history`)).data,
      async () => ({ success: true, history: [] })
    )
};

export const workService = {
  list: async () => {
    const res = await client.get("/work-approvals");
    return {
      success: true,
      records: (res.data.records || []).map(mapWorkRecord)
    };
  },
  details: async (id) => {
    const res = await client.get(`/work-approvals/${id}`);
    return { success: true, work: mapWorkRecord(res.data.work) };
  },
  create: async (payload) => {
    const formData = new FormData();
    const chainageFrom = String(
      payload.chainageFrom || payload.chainage || payload.chainageNo || ""
    ).trim();
    const chainageTo = String(
      payload.chainageTo || payload.chainageFrom || payload.chainage || payload.chainageNo || ""
    ).trim();

    Object.entries(payload).forEach(([key, value]) => {
      if (key === "beforeImages") return;
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });
    formData.set("chainageFrom", chainageFrom);
    formData.set("chainageTo", chainageTo);
    formData.set("chainage", chainageFrom);
    formData.set("chainageNo", chainageFrom);
    formData.set("description", String(payload.description || "").trim());
    formData.set("workersCount", String(Number(payload.workersCount || 0)));
    (payload.beforeImages || []).forEach((file) => formData.append("beforeImages", file));
    const res = await client.post("/work-approvals", formData);
    return { success: true, work: mapWorkRecord(res.data.work) };
  },
  update: async (id, payload) => {
    const res = await client.patch(`/work-approvals/${id}`, payload);
    return { success: true, work: mapWorkRecord(res.data.work) };
  },
  updateWorkflow: async (id, payload) =>
    (await client.patch(`/work-approvals/${id}/workflow`, payload)).data,
  updateStatus: async (id, payload) =>
    (await client.patch(`/work-approvals/${id}/status`, payload)).data,
  addComment: async (id, payload) =>
    (await client.post(`/work-approvals/${id}/comments`, payload)).data,
  addSignature: async (id, payload) =>
    (await client.post(`/work-approvals/${id}/signatures`, payload)).data,
  uploadAfterImages: async (id, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("afterImages", file));
    return (await client.post(`/work-approvals/${id}/images/after`, formData)).data;
  },
  remove: async (id) => {
    if (!id) {
      throw new Error("Work approval id is required");
    }
    return (await client.delete(`/work-approvals/${id}`)).data;
  }
};

export const hazardService = {
  list: async () =>
    withLegacyFallback(
      async () => {
        const res = await client.get("/hazards");
        return {
          success: true,
          records: (res.data.records || []).map(mapHazardRecord)
        };
      },
      async () => {
        const legacy = await legacyClient.get("/hazard");
        return {
          success: true,
          records: (legacy.data || []).map(mapHazardRecord)
        };
      }
    ),
  create: async (payload) =>
    withLegacyFallback(
      async () => {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (key === "evidenceImages") return;
          if (value !== undefined && value !== null) formData.append(key, value);
        });
        (payload.evidenceImages || []).forEach((file) => formData.append("evidenceImages", file));
        const res = await client.post("/hazards", formData);
        return { success: true, hazard: mapHazardRecord(res.data.hazard) };
      },
      async () => {
        const formData = new FormData();
        formData.append("date", payload.date || "");
        formData.append("plaza", payload.plaza || "");
        formData.append("location", payload.location || "");
        formData.append("reportedBy", payload.reportedBy || "");
        formData.append("category", payload.category || "Hazard");
        formData.append("action", payload.action || "");
        if (payload.evidenceImages?.[0]) {
          formData.append("beforeImage", payload.evidenceImages[0]);
        }
        const res = await legacyClient.post("/hazard", formData);
        return { success: true, message: res.data };
      }
    ),
  update: async (id, payload) =>
    withLegacyFallback(
      async () => {
        const res = await client.patch(`/hazards/${id}`, payload);
        return { success: true, hazard: mapHazardRecord(res.data.hazard) };
      },
      async () => {
        throw new Error("Hazard edit is not available on legacy endpoint");
      }
    ),
  assign: async (id, assignedTo) =>
    withLegacyFallback(
      async () => (await client.patch(`/hazards/${id}/assign`, { assignedTo })).data,
      async () => ({ success: true, message: "Assign not available on legacy endpoint" })
    ),
  addAction: async (id, payload) =>
    withLegacyFallback(
      async () => (await client.post(`/hazards/${id}/corrective-actions`, payload)).data,
      async () => ({ success: true, message: "Corrective action not available on legacy endpoint" })
    ),
  close: async (id, payload) =>
    withLegacyFallback(
      async () => {
        const formData = new FormData();
        formData.append("closureNotes", payload.closureNotes || "");
        (payload.closureImages || []).forEach((file) => formData.append("closureImages", file));
        return (await client.patch(`/hazards/${id}/close`, formData)).data;
      },
      async () => {
        const formData = new FormData();
        if (payload.closureImages?.[0]) {
          formData.append("afterImage", payload.closureImages[0]);
        }
        const res = await legacyClient.put(`/hazard/close/${id}`, formData);
        return { success: true, message: res.data };
      }
    ),
  remove: async (id) =>
    withLegacyFallback(
      async () => (await client.delete(`/hazards/${id}`)).data,
      async () => {
        const res = await legacyClient.delete(`/hazard/${id}`);
        return { success: true, message: res.data };
      }
    )
};

export const trainingService = {
  list: async (params = {}) =>
    withLegacyFallback(
      async () => {
        const res = await client.get("/training", { params });
        return {
          success: true,
          records: (res.data.records || []).map(mapTrainingRecord)
        };
      },
      async () => {
        const legacy = await legacyClient.get("/training");
        const records = (legacy.data || []).map(mapTrainingRecord);
        const category = params.category;
        const search = params.search?.toLowerCase();
        const filtered = records.filter((item) => {
          if (category && item.category !== category) return false;
          if (
            search &&
            !`${item.title || ""} ${item.description || ""}`.toLowerCase().includes(search)
          ) {
            return false;
          }
          return true;
        });
        return { success: true, records: filtered };
      }
    ),
  create: async (payload) =>
    withLegacyFallback(
      async () => {
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (["thumbnail", "video", "banner"].includes(key)) return;
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) formData.append(key, JSON.stringify(value));
            else formData.append(key, value);
          }
        });
        if (payload.thumbnail) formData.append("thumbnail", payload.thumbnail);
        else if (payload.banner) formData.append("thumbnail", payload.banner);
        if (payload.video) formData.append("video", payload.video);
        const res = await client.post("/training", formData);
        return { success: true, training: mapTrainingRecord(res.data.training) };
      },
      async () => {
        const formData = new FormData();
        formData.append("title", payload.title || "");
        formData.append("description", payload.description || "");
        formData.append("category", payload.category || "");
        if (payload.banner) formData.append("banner", payload.banner);
        else if (payload.thumbnail) formData.append("banner", payload.thumbnail);
        if (payload.video) formData.append("video", payload.video);
        const res = await legacyClient.post("/training", formData);
        return { success: true, data: res.data };
      }
    ),
  remove: async (id) => (await client.delete(`/training/${id}`)).data,
  updateProgress: async (id, progress, seconds = 0) =>
    withLegacyFallback(
      async () => (await client.patch(`/training/${id}/progress`, { progress, seconds })).data,
      async () => ({ success: true, progress })
    ),
  history: async () =>
    withLegacyFallback(
      async () => (await client.get("/training/history/me")).data,
      async () => ({ success: true, history: [] })
    ),
  recommendations: async () =>
    withLegacyFallback(
      async () => (await client.get("/training/recommendations/me")).data,
      async () => ({ success: true, recommendations: [] })
    ),
  certificates: async () =>
    withLegacyFallback(
      async () => (await client.get("/training/certificates/me")).data,
      async () => ({ success: true, certificates: [] })
    )
};

export const reportService = {
  analytics: async (period = "monthly") =>
    withLegacyFallback(
      async () => (await client.get("/reports/analytics", { params: { period } })).data,
      async () => {
        const [workRes, hazardRes, userRes, trainingRes] = await Promise.all([
          legacyClient.get("/reports/work"),
          legacyClient.get("/reports/hazard"),
          legacyClient.get("/users"),
          legacyClient.get("/training")
        ]);
        const work = workRes.data || [];
        const hazards = hazardRes.data || [];
        const users = userRes.data || [];
        const training = trainingRes.data || [];
        return {
          success: true,
          analytics: {
            period,
            totals: {
              work: work.length,
              hazards: hazards.length,
              users: users.length,
              training: training.length
            },
            workTrends: work,
            hazardTrends: hazards,
            userPerformance: users,
            safetyKpis: {
              closedHazardRate:
                hazards.length === 0
                  ? 100
                  : Math.round(
                      (hazards.filter((item) => item.status === "Closed").length / hazards.length) *
                        100
                    ),
              workCompletionRate:
                work.length === 0
                  ? 100
                  : Math.round(
                      (work.filter((item) => item.status === "Completed").length / work.length) * 100
                    )
            }
          }
        };
      }
    ),
  exportData: async (format = "csv", period = "monthly") =>
    (
      await client.get("/reports/export", {
        params: { format, period },
        responseType: format === "csv" ? "blob" : "json"
      })
    ).data,
  generateLegacyReport: async ({ type, fromDate, toDate, plaza }) => {
    const [workRes, hazardRes] = await Promise.all([
      withLegacyFallback(
        async () => (await client.get("/reports/work")).data,
        async () =>
          withLegacyFallback(
            async () => (await localLegacyClient.get("/reports/work")).data,
            async () => (await legacyClient.get("/reports/work")).data
          )
      ),
      withLegacyFallback(
        async () => (await client.get("/reports/hazard")).data,
        async () =>
          withLegacyFallback(
            async () => (await localLegacyClient.get("/reports/hazard")).data,
            async () => (await legacyClient.get("/reports/hazard")).data
          )
      )
    ]);

    return buildLegacyReport({
      type,
      fromDate,
      toDate,
      plaza,
      workData: workRes || [],
      hazardData: hazardRes || []
    });
  }
};

export const settingsService = {
  get: async () =>
    withLegacyFallback(
      async () => {
        const response = (await client.get("/settings")).data;
        const settings = normalizeSettings(response.settings || {});
        cacheSettings(settings);
        return { success: true, settings };
      },
      async () => {
        const cached = getCachedSettings();
        return { success: true, settings: normalizeSettings(cached || {}) };
      }
    ),
  updateProfile: async (payload) => {
    const normalized = normalizeSettings({ ...(getCachedSettings() || {}), ...payload });
    return withLegacyFallback(
      async () => {
        const response = (
          await client.put("/settings/profile", toLegacyProfilePayload(normalized))
        ).data;
        const settings = normalizeSettings(response.settings || normalized);
        cacheSettings(settings);
        return { success: true, settings };
      },
      async () => {
        cacheSettings(normalized);
        return { success: true, settings: normalized };
      }
    );
  },
  updateBranding: async (payload) => {
    const cached = normalizeSettings(getCachedSettings() || {});
    const normalized = normalizeSettings({
      ...cached,
      branding: { ...(cached.branding || {}), ...(payload || {}) }
    });
    return withLegacyFallback(
      async () => {
        const response = (await client.put("/settings/branding", normalized.branding)).data;
        const settings = normalizeSettings(response.settings || normalized);
        cacheSettings(settings);
        return { success: true, settings };
      },
      async () => {
        cacheSettings(normalized);
        return { success: true, settings: normalized };
      }
    );
  },
  updateSecurity: async (payload) => {
    const cached = normalizeSettings(getCachedSettings() || {});
    const normalized = normalizeSettings({
      ...cached,
      security: {
        ...(cached.security || {}),
        ...(payload || {}),
        passwordPolicy: {
          ...(cached.security?.passwordPolicy || {}),
          ...(payload?.passwordPolicy || {})
        }
      }
    });
    return withLegacyFallback(
      async () => {
        const response = (
          await client.put("/settings/security", toLegacySecurityPayload(normalized.security))
        ).data;
        const settings = normalizeSettings(response.settings || normalized);
        cacheSettings(settings);
        return { success: true, settings };
      },
      async () => {
        cacheSettings(normalized);
        return { success: true, settings: normalized };
      }
    );
  },
  uploadLogo: async (file) => {
    const formData = new FormData();
    formData.append("logo", file);
    return withLegacyFallback(
      async () => (await client.post("/settings/logo", formData)).data,
      async () => ({ success: true })
    );
  },
  uploadBrandingAssets: async ({ dashboardBanner, loginBackground }) => {
    const formData = new FormData();
    if (dashboardBanner) formData.append("dashboardBanner", dashboardBanner);
    if (loginBackground) formData.append("loginBackground", loginBackground);
    return withLegacyFallback(
      async () => (await client.post("/settings/branding-assets", formData)).data,
      async () => ({ success: true })
    );
  }
};

export const notificationService = {
  list: async () => (await client.get("/notifications")).data,
  markRead: async (id) => (await client.patch(`/notifications/${id}/read`)).data,
  markAllRead: async () => (await client.patch("/notifications/read-all")).data
};
