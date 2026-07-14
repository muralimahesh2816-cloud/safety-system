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

const VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska"
];

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
      if (!allowedMimeTypes.length || allowedMimeTypes.includes(file.mimetype)) {
        callback(null, true);
        return;
      }

      callback(
        new ApiError(
          400,
          `Unsupported file format. Allowed formats: ${allowedMimeTypes.join(", ")}`
        )
      );
    }
  });

module.exports = {
  IMAGE_MIME_TYPES,
  VIDEO_MIME_TYPES,
  createMemoryUpload
};
