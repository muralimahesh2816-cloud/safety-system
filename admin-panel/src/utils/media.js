const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:5000/api/v1";

export const getBackendBaseUrl = () => {
  return API_BASE_URL.replace("/api/v1", "");
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

const normalizeBackendUploadUrl = (value = "") => {
  if (!value || typeof value !== "string") return value;
  if (!value.startsWith("http")) return value;
  return value.replace(/\/api\/v1\/uploads\//i, "/uploads/");
};

export const getMediaUrl = (file) => {
  if (!file) return "";

  if (typeof file === "string" && isDirectPreview(file)) return file;

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
