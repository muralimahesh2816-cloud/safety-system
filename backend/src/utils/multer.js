const multer = require("multer");
const ApiError = require("./api-error");

const MB = 1024 * 1024;

const IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif"
];

const MIME_EXTENSIONS = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/avif": [".avif"],
  "video/mp4": [".mp4"],
  "video/webm": [".webm"],
  "video/quicktime": [".mov"],
  "video/x-msvideo": [".avi"],
  "video/x-matroska": [".mkv"]
};

const getExtension = (filename = "") => {
  const clean = String(filename || "").toLowerCase();
  const index = clean.lastIndexOf(".");
  return index >= 0 ? clean.slice(index) : "";
};

const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska"
];

const DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain"
];

Object.assign(MIME_EXTENSIONS, {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/csv": [".csv"],
  "text/plain": [".txt"]
});

const createMemoryUpload = ({
  allowedMimeTypes = IMAGE_MIME_TYPES,
  maxFileSizeMb = 10,
  maxFiles = 10
} = {}) =>
  multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSizeMb * MB,
      files: maxFiles
    },
    fileFilter: (_req, file, callback) => {
      const allowedByMime = !allowedMimeTypes.length || allowedMimeTypes.includes(file.mimetype);
      const expectedExtensions = MIME_EXTENSIONS[file.mimetype] || [];
      const extension = getExtension(file.originalname);
      const allowedByExtension = !expectedExtensions.length || expectedExtensions.includes(extension);

      if (allowedByMime && allowedByExtension) {
        callback(null, true);
        return;
      }

      callback(
        new ApiError(
          400,
          `Unsupported file format or extension. Allowed formats: ${allowedMimeTypes.join(", ")}`
        )
      );
    }
  });

module.exports = {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  DOCUMENT_MIME_TYPES,
  createMemoryUpload
};
