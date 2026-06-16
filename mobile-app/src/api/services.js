import { client } from "./client";
import { mediaToFormFile } from "../utils/media";

const appendIfValue = (formData, key, value) => {
  if (value !== undefined && value !== null && value !== "") {
    formData.append(key, String(value));
  }
};

const appendFile = (formData, key, asset, fallbackName) => {
  const file = mediaToFormFile(asset, fallbackName);
  if (file) formData.append(key, file);
};

export const authService = {
  login: async (payload) => (await client.post("/auth/login", payload)).data,
  me: async () => (await client.get("/auth/me")).data,
  logout: async () => {
    try {
      return (await client.post("/auth/logout")).data;
    } catch (_error) {
      return { success: true };
    }
  }
};

export const dashboardService = {
  summary: async () => (await client.get("/dashboard/summary")).data
};

export const workService = {
  list: async () => (await client.get("/work-approvals")).data,
  create: async ({ beforeImage, ...payload }) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => appendIfValue(formData, key, value));
    appendFile(formData, "beforeImages", beforeImage, "before-work.jpg");
    return (await client.post("/work-approvals", formData)).data;
  },
  updateStatus: async (id, status, approvedBy = "") =>
    (await client.patch(`/work-approvals/${id}/status`, { status, approvedBy })).data,
  uploadAfterImages: async (id, afterImage) => {
    const formData = new FormData();
    appendFile(formData, "afterImages", afterImage, "after-work.jpg");
    return (await client.post(`/work-approvals/${id}/images/after`, formData)).data;
  }
};

export const hazardService = {
  list: async () => (await client.get("/hazards")).data,
  create: async ({ evidenceImage, ...payload }) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => appendIfValue(formData, key, value));
    appendFile(formData, "evidenceImages", evidenceImage, "hazard-evidence.jpg");
    return (await client.post("/hazards", formData)).data;
  },
  close: async (id, closureImage) => {
    const formData = new FormData();
    formData.append("closureNotes", "");
    formData.append("status", "Closed");
    appendFile(formData, "closureImages", closureImage, "hazard-closure.jpg");
    return (await client.patch(`/hazards/${id}/close`, formData)).data;
  }
};

export const trainingService = {
  list: async (params = {}) => (await client.get("/training", { params })).data,
  history: async () => (await client.get("/training/history/me")).data,
  certificates: async () => (await client.get("/training/certificates/me")).data,
  recommendations: async () => (await client.get("/training/recommendations/me")).data,
  progress: async (id, progress, seconds = 120) =>
    (await client.patch(`/training/${id}/progress`, { progress, seconds })).data,
  create: async ({ video, thumbnail, ...payload }) => {
    const formData = new FormData();
    Object.entries(payload).forEach(([key, value]) => appendIfValue(formData, key, value));
    appendFile(formData, "thumbnail", thumbnail, "training-thumbnail.jpg");
    appendFile(formData, "video", video, "training-video.mp4");
    return (await client.post("/training", formData)).data;
  },
  remove: async (id) => (await client.delete(`/training/${id}`)).data
};

export const reportService = {
  analytics: async (period = "monthly") => (await client.get("/reports/analytics", { params: { period } })).data,
  work: async () => (await client.get("/reports/work")).data,
  hazard: async () => (await client.get("/reports/hazard")).data,
  exportRows: async (format = "csv", period = "monthly") =>
    (await client.get("/reports/export", { params: { format, period } })).data
};

export const userService = {
  list: async () => (await client.get("/users")).data
};

export const notificationService = {
  list: async () => (await client.get("/notifications")).data,
  readAll: async () => (await client.patch("/notifications/read-all")).data,
  savePushToken: async (token) => {
    if (!token) return { success: false };
    const payload = { expoPushToken: token, pushToken: token };
    try {
      return (await client.post("/notifications/push-token", payload)).data;
    } catch (_firstError) {
      try {
        return (await client.patch("/users/me/push-token", payload)).data;
      } catch (_secondError) {
        return { success: false, message: "Push token endpoint is not configured yet." };
      }
    }
  }
};
