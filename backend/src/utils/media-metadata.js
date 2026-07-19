const mongoose = require("mongoose");
const ApiError = require("./api-error");
const { env } = require("../config/env");
const { normalizeRole, ROLES } = require("../constants/roles");

const locationSchema = new mongoose.Schema(
  {
    latitude: Number,
    longitude: Number,
    accuracyMeters: Number,
    altitude: Number,
    heading: Number,
    capturedAt: Date,
    permissionStatus: { type: String, default: "not_requested" },
    locationSource: { type: String, default: "browser_geolocation" },
    isVerified: { type: Boolean, default: false },
    formattedAddress: String,
    plaza: String,
    district: String,
    state: String,
    country: String
  },
  { _id: false }
);

const watermarkSchema = new mongoose.Schema(
  {
    applied: { type: Boolean, default: false },
    version: { type: String, default: "gps-stamp-v1" },
    appliedAt: Date,
    processingStatus: {
      type: String,
      enum: ["not_required", "pending", "processing", "completed", "failed"],
      default: "not_required"
    },
    processingError: String
  },
  { _id: false }
);

const assetSchema = new mongoose.Schema(
  {
    id: String,
    module: { type: String, enum: ["work_approval", "hazard"] },
    stage: { type: String, enum: ["before", "after", "completion"] },
    mediaType: { type: String, enum: ["image", "video"] },
    captureSource: { type: String, enum: ["camera", "gallery", "file"], default: "file" },
    url: String,
    originalUrl: String,
    secureUrl: String,
    thumbnailUrl: String,
    watermarkedUrl: String,
    publicId: String,
    storage: String,
    originalName: String,
    originalFileName: String,
    storedFileName: String,
    mimeType: String,
    size: Number,
    sizeBytes: Number,
    width: Number,
    height: Number,
    durationSeconds: Number,
    fileHash: String,
    location: locationSchema,
    watermark: watermarkSchema,
    videoOverlay: { type: String, enum: ["player_metadata", "permanent", "none"], default: "none" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    uploadedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const parseJsonArray = (raw, label) => {
  if (!raw) return [];
  if (String(raw).length > 100000) throw new ApiError(400, `${label} is too large`);
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch (_error) {
    throw new ApiError(400, `${label} is invalid`);
  }
};

const optionalFinite = (value) => value === null || value === undefined || value === ""
  ? undefined
  : Number(value);

const normalizeLocation = (raw = {}, captureSource) => {
  const permissionStatus = String(raw.permissionStatus || "not_requested").slice(0, 40);
  const latitude = optionalFinite(raw.latitude);
  const longitude = optionalFinite(raw.longitude);
  const accuracyMeters = optionalFinite(raw.accuracyMeters);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);

  if ((latitude !== undefined || longitude !== undefined) && !hasCoordinates) {
    throw new ApiError(400, "GPS latitude and longitude must both be valid numbers");
  }
  if (hasCoordinates && (latitude < -90 || latitude > 90)) {
    throw new ApiError(400, "GPS latitude must be between -90 and 90");
  }
  if (hasCoordinates && (longitude < -180 || longitude > 180)) {
    throw new ApiError(400, "GPS longitude must be between -180 and 180");
  }
  if (accuracyMeters !== undefined && (!Number.isFinite(accuracyMeters) || accuracyMeters <= 0)) {
    throw new ApiError(400, "GPS accuracy must be a positive number");
  }

  const capturedAt = raw.capturedAt ? new Date(raw.capturedAt) : new Date();
  if (Number.isNaN(capturedAt.getTime()) || capturedAt.getTime() > Date.now() + 10 * 60 * 1000) {
    throw new ApiError(400, "Capture timestamp is invalid");
  }

  const gpsRequired = env.media.gpsPolicy === "required" ||
    (env.media.gpsPolicy === "required_camera" && captureSource === "camera");
  if (gpsRequired && !hasCoordinates) {
    throw new ApiError(400, "Location permission is required for this evidence");
  }

  return {
    ...(hasCoordinates ? { latitude, longitude } : {}),
    ...(accuracyMeters !== undefined ? { accuracyMeters } : {}),
    altitude: optionalFinite(raw.altitude),
    heading: optionalFinite(raw.heading),
    capturedAt,
    permissionStatus,
    locationSource: "browser_geolocation",
    isVerified: false,
    formattedAddress: String(raw.formattedAddress || "").slice(0, 500),
    plaza: String(raw.plaza || "").slice(0, 160),
    district: String(raw.district || "").slice(0, 160),
    state: String(raw.state || "").slice(0, 160),
    country: String(raw.country || "").slice(0, 160)
  };
};

const normalizeMetadata = (raw, { module, stage, mediaType }) => {
  const captureSource = ["camera", "gallery", "file"].includes(raw?.captureSource)
    ? raw.captureSource
    : "file";
  const location = normalizeLocation(raw?.location || {}, captureSource);
  const processingStatus = ["not_required", "pending", "processing", "completed", "failed"].includes(raw?.watermark?.processingStatus)
    ? raw.watermark.processingStatus
    : "not_required";
  return {
    module,
    stage,
    mediaType,
    captureSource,
    originalFileName: String(raw?.originalFileName || "").slice(0, 255),
    location,
    watermark: {
      applied: mediaType === "image" && raw?.watermark?.applied === true,
      version: "gps-stamp-v1",
      appliedAt: raw?.watermark?.applied === true ? new Date() : undefined,
      processingStatus
    },
    videoOverlay: mediaType === "video" ? "player_metadata" : "none",
    thumbnailUploadIndex: Number.isInteger(raw?.thumbnailUploadIndex) ? raw.thumbnailUploadIndex : -1
  };
};

const parseMediaMetadata = (raw, options) => {
  const values = parseJsonArray(raw, "Media metadata");
  if (values.length > options.maxCount) throw new ApiError(400, "Too many media metadata entries");
  return values.map((value) => normalizeMetadata(value, options));
};

const mergeMediaMetadata = (assets, metadata, {
  userId,
  thumbnails = [],
  module = "work_approval",
  stage = "before",
  mediaType = "image"
} = {}) =>
  (assets || []).map((asset, index) => {
    const details = metadata[index] || normalizeMetadata({}, {
      module: asset.module || module,
      stage: asset.stage || stage,
      mediaType: asset.mediaType || mediaType
    });
    const thumbnail = details.thumbnailUploadIndex >= 0 ? thumbnails[details.thumbnailUploadIndex] : null;
    return {
      ...asset,
      id: new mongoose.Types.ObjectId().toString(),
      module: details.module,
      stage: details.stage,
      mediaType: details.mediaType,
      captureSource: details.captureSource,
      originalFileName: details.originalFileName || asset.originalName || "",
      storedFileName: asset.originalName || "",
      sizeBytes: asset.size,
      originalUrl: asset.url,
      secureUrl: asset.url,
      thumbnailUrl: thumbnail?.url || "",
      watermarkedUrl: details.mediaType === "image" && details.watermark.applied ? asset.url : "",
      location: details.location,
      watermark: details.watermark,
      videoOverlay: details.videoOverlay,
      uploadedBy: userId,
      uploadedAt: new Date()
    };
  });

const EXACT_LOCATION_ROLES = new Set([
  ROLES.SUPER_ADMIN,
  ROLES.ADMIN,
  ROLES.SAFETY_MANAGER,
  ROLES.PROJECT_MANAGER,
  ROLES.MAINTENANCE_MANAGER
]);

const canViewExactLocation = (user, record = {}) => {
  const role = normalizeRole(user?.role);
  if (EXACT_LOCATION_ROLES.has(role)) return true;
  const userId = String(user?.id || user?._id || "");
  return Boolean(userId && [record.createdBy, record.reportedBy, record.assignedTo]
    .filter(Boolean)
    .some((value) => String(value?._id || value) === userId));
};

const redactAssetLocation = (asset) => {
  if (!asset?.location) return asset;
  const { latitude, longitude, altitude, heading, ...limited } = asset.location;
  return { ...asset, location: { ...limited, recorded: Boolean(latitude !== undefined && longitude !== undefined) } };
};

const redactRecordLocations = (record, user, mediaFields) => {
  if (canViewExactLocation(user, record)) return record;
  const next = { ...record };
  mediaFields.forEach((field) => {
    next[field] = (record[field] || []).map(redactAssetLocation);
  });
  return next;
};

module.exports = {
  assetSchema,
  parseMediaMetadata,
  mergeMediaMetadata,
  redactRecordLocations,
  canViewExactLocation
};
