import { client } from "./client";

const isVideo = (file) => String(file?.type || "").startsWith("video/");

const appendEvidence = (formData, files = []) => {
  const imageMetadata = [];
  const videoMetadata = [];
  let thumbnailIndex = 0;
  files.forEach((file) => {
    const metadata = { ...(file.evidenceMetadata || {}) };
    if (isVideo(file)) {
      if (file.evidencePosterFile) {
        formData.append("evidenceVideoThumbnails", file.evidencePosterFile);
        metadata.thumbnailUploadIndex = thumbnailIndex;
        thumbnailIndex += 1;
      }
      formData.append("evidenceVideos", file);
      videoMetadata.push(metadata);
    } else {
      formData.append("evidenceImages", file);
      imageMetadata.push(metadata);
    }
  });
  formData.append("evidenceImageMetadata", JSON.stringify(imageMetadata));
  formData.append("evidenceVideoMetadata", JSON.stringify(videoMetadata));
};

const toFormData = (payload = {}) => {
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (["evidence", "documents"].includes(key) || value === undefined || value === null) return;
    if (["data", "checklist", "tags", "participants", "geoLocation"].includes(key)) {
      formData.append(key, JSON.stringify(value));
    } else {
      formData.append(key, value);
    }
  });
  appendEvidence(formData, payload.evidence || []);
  (payload.documents || []).forEach((document) => formData.append("documents", document));
  return formData;
};

export const enterpriseHseService = {
  modules: async () => (await client.get("/hse/modules")).data,
  assignees: async () => (await client.get("/hse/assignees")).data,
  checklistTemplates: async (moduleKey) => (await client.get("/hse/checklist-templates", { params: { moduleKey } })).data,
  createChecklistTemplate: async (payload) => (await client.post("/hse/checklist-templates", payload)).data,
  dashboard: async () => (await client.get("/hse/dashboard")).data,
  alerts: async () => (await client.get("/hse/alerts")).data,
  list: async (moduleKey, params = {}) => (await client.get(`/${moduleKey}`, { params })).data,
  summary: async (moduleKey) => (await client.get(`/${moduleKey}/summary`)).data,
  details: async (moduleKey, id) => (await client.get(`/${moduleKey}/${id}`)).data,
  create: async (moduleKey, payload, onUploadProgress) => (
    await client.post(`/${moduleKey}`, toFormData(payload), { onUploadProgress })
  ).data,
  update: async (moduleKey, id, payload, onUploadProgress) => (
    await client.patch(`/${moduleKey}/${id}`, toFormData(payload), { onUploadProgress })
  ).data,
  transition: async (moduleKey, id, payload) => (
    await client.post(`/${moduleKey}/${id}/transition`, payload)
  ).data,
  archive: async (moduleKey, id) => (await client.delete(`/${moduleKey}/${id}`)).data,
  exportRecords: async (moduleKey, params = {}) => (
    await client.get(`/${moduleKey}/export`, { params })
  ).data
};

export default enterpriseHseService;
