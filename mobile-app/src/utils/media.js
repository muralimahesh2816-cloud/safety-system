import { UPLOADS_BASE_URL, BACKEND_BASE_URL } from "../config/api";

const isDirect = (value = "") =>
  value.startsWith("http://") ||
  value.startsWith("https://") ||
  value.startsWith("file://") ||
  value.startsWith("content://") ||
  value.startsWith("blob:") ||
  value.startsWith("data:");

const normalizeUploadPath = (value = "") => {
  let next = String(value || "").trim().replace(/\\/g, "/");
  if (!next) return "";
  const uploadSplit = next.split("/uploads/");
  if (uploadSplit.length > 1) next = uploadSplit.pop() || "";
  next = next.replace(/^uploads\//i, "").replace(/^\/+/, "");
  return next;
};

export const getMediaUrl = (file) => {
  if (!file) return "";

  if (typeof file === "string") {
    const trimmed = file.trim();
    if (!trimmed || trimmed === "[object Object]") return "";
    if (isDirect(trimmed)) return trimmed.replace(/\/api\/v1\/uploads\//i, "/uploads/");
    if (trimmed.startsWith("/uploads/")) return `${BACKEND_BASE_URL}${trimmed}`;
    return `${UPLOADS_BASE_URL}/${encodeURI(normalizeUploadPath(trimmed))}`;
  }

  if (file.secure_url) return file.secure_url;
  if (file.uri) return file.uri;
  if (file.url) return getMediaUrl(file.url);
  if (file.path) return getMediaUrl(file.path);
  if (file.filename) return getMediaUrl(file.filename);
  if (file.name) return getMediaUrl(file.name);

  return "";
};

export const isVideoUrl = (url = "") => /\.(mp4|mov|m4v|webm|avi)(\?|$)/i.test(url);

export const mediaToFormFile = (asset, fallbackName = "upload") => {
  if (!asset?.uri) return null;
  const uriParts = asset.uri.split("/");
  const name = asset.fileName || uriParts[uriParts.length - 1] || fallbackName;
  const ext = name.includes(".") ? name.split(".").pop() : "jpg";
  const type =
    asset.mimeType || asset.type || (asset.mediaType === "video" ? `video/${ext}` : `image/${ext}`);
  return { uri: asset.uri, name, type };
};
