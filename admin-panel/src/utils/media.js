import { API_BASE_URL } from "../config/appConfig";

export const getBackendBaseUrl = () => {
  return API_BASE_URL.replace(/\/api\/v1\/?$/i, "").replace(/\/+$/, "");
};

const isDirectPreview = (value = "") => value.startsWith("blob:") || value.startsWith("data:");

const normalizeUploadPath = (value = "") => {
  let next = String(value || "").trim();
  if (!next) return "";

  next = next.replace(/\\/g, "/");

  if (/^[A-Za-z]:\//.test(next)) {
    const parts = next.split("/");
    const uploadsIndex = parts.findIndex((part) => part.toLowerCase() === "uploads");
    if (uploadsIndex >= 0 && parts.length > uploadsIndex + 1) {
      next = parts.slice(uploadsIndex + 1).join("/");
    } else {
      next = parts[parts.length - 1] || "";
    }
  }

  const uploadsSplit = next.split("/uploads/");
  if (uploadsSplit.length > 1) {
    next = uploadsSplit.pop() || "";
  }

  next = next.replace(/^\.?\//, "");
  next = next.replace(/^uploads\//i, "");
  next = next.replace(/^\/+/, "");
  return next;
};

const toUploadsUrl = (value) => {
  const safePath = normalizeUploadPath(value);
  if (!safePath) return "";
  return `${getBackendBaseUrl()}/uploads/${encodeURI(safePath)}`;
};

const isLocalHostName = (hostname = "") => ["localhost", "127.0.0.1", "0.0.0.0"].includes(hostname);

const normalizeBackendUploadUrl = (value = "") => {
  if (!value || typeof value !== "string") return value;
  if (!value.startsWith("http")) return value;

  try {
    const parsed = new URL(value);
    const backend = new URL(getBackendBaseUrl());
    const rawPath = parsed.pathname.replace(/\/api\/v1\/uploads\//i, "/uploads/");
    const uploadPath = normalizeUploadPath(rawPath);
    const isUploadPath =
      parsed.pathname.toLowerCase().includes("/uploads/") ||
      parsed.pathname.toLowerCase().includes("/api/v1/uploads/");

    if (!isUploadPath || !uploadPath) return value;

    const forceBackendUploadPath =
      parsed.pathname.toLowerCase().includes("/api/v1/uploads/") ||
      isLocalHostName(parsed.hostname.toLowerCase()) ||
      parsed.origin !== backend.origin;

    if (forceBackendUploadPath) {
      return `${backend.origin}/uploads/${encodeURI(uploadPath)}`;
    }

    return `${parsed.origin}/uploads/${encodeURI(uploadPath)}`;
  } catch {
    return value.replace(/\/api\/v1\/uploads\//i, "/uploads/");
  }
};

export const getMediaUrl = (file) => {
  if (!file) return "";

  if (typeof file === "string") {
    const trimmed = file.trim();
    if (!trimmed || trimmed === "[object Object]") return "";

    if (isDirectPreview(trimmed)) return trimmed;

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return getMediaUrl(parsed[0]);
        }
      } catch (_error) {
        // Keep original handling if not valid JSON.
      }
    }

    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.url || parsed?.path || parsed?.filename || parsed?.name || parsed?.secure_url) {
          return getMediaUrl(parsed);
        }
      } catch (_error) {
        // Keep original handling if not valid JSON.
      }
    }
  }

  if (typeof file === "string" && file.startsWith("http")) return normalizeBackendUploadUrl(file);

  if (file?.secure_url) return file.secure_url;

  if (file?.url) {
    if (typeof file.url === "string" && file.url.startsWith("http")) {
      return normalizeBackendUploadUrl(file.url);
    }
    if (typeof file.url === "string" && isDirectPreview(file.url)) return file.url;
    if (typeof file.url === "string" && file.url.replace(/\\/g, "/").startsWith("/uploads/")) {
      return `${getBackendBaseUrl()}${file.url.replace(/\\/g, "/")}`;
    }
    return toUploadsUrl(file.url);
  }

  if (file?.path) {
    if (typeof file.path === "string" && file.path.startsWith("http")) {
      return normalizeBackendUploadUrl(file.path);
    }
    if (typeof file.path === "string" && isDirectPreview(file.path)) return file.path;
    if (typeof file.path === "string" && file.path.replace(/\\/g, "/").startsWith("/uploads/")) {
      return `${getBackendBaseUrl()}${file.path.replace(/\\/g, "/")}`;
    }
    return toUploadsUrl(file.path);
  }

  if (file?.filename) return toUploadsUrl(file.filename);

  if (file?.name) return toUploadsUrl(file.name);

  if (typeof file === "string" && file.replace(/\\/g, "/").startsWith("/uploads/")) {
    return `${getBackendBaseUrl()}${file.replace(/\\/g, "/")}`;
  }

  if (typeof file === "string") return toUploadsUrl(file);

  return "";
};

export const resolveAssetUrl = (asset) => getMediaUrl(asset);

export const normalizeImageItems = (items = []) =>
  items
    .map((item) => {
      if (typeof item === "string") return { url: getMediaUrl(item) };
      return { ...item, url: getMediaUrl(item) };
    })
    .filter((item) => Boolean(item.url));
