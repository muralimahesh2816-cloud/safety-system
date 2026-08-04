const mongoose = require("mongoose");
const ApiError = require("./api-error");
const { env } = require("../config/env");

const locationSchema = new mongoose.Schema(
  {
    latitude: Number,
    longitude: Number,
    lat: Number,
    lng: Number,
    lon: Number,
    coordinates: [Number],
    geometry: mongoose.Schema.Types.Mixed,
    accuracyMeters: Number,
    accuracy: Number,
    altitude: Number,
    altitudeMeters: Number,
    heading: Number,
    placeId: String,
    mapType: { type: String, enum: ["roadmap", "satellite"], default: "roadmap" },
    zoom: { type: Number, min: 1, max: 22, default: 18 },
    capturedAt: Date,
    updatedAt: Date,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    permissionStatus: { type: String, default: "not_requested" },
    locationSource: { type: String, default: "browser_geolocation" },
    source: String,
    isVerified: { type: Boolean, default: false },
    formattedAddress: String,
    address: String,
    addressLine1: String,
    addressLine2: String,
    locality: String,
    subLocality: String,
    city: String,
    plaza: String,
    district: String,
    state: String,
    postalCode: String,
    country: String,
    reverseGeocodeProvider: String,
    reverseGeocodeStatus: {
      type: String,
      enum: ["pending", "completed", "failed", "unavailable"],
      default: "unavailable"
    },
    reverseGeocodedAt: Date
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
    module: { type: String, trim: true, maxlength: 80 },
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
    latitude: Number,
    longitude: Number,
    lat: Number,
    lng: Number,
    lon: Number,
    coordinates: [Number],
    geoLocation: mongoose.Schema.Types.Mixed,
    formattedAddress: String,
    address: String,
    accuracyMeters: Number,
    accuracy: Number,
    capturedAt: Date,
    source: String,
    locationSource: String,
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

const safeLocationText = (value, maxLength = 240) =>
  String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, maxLength);

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
    altitude: optionalFinite(raw.altitudeMeters ?? raw.altitude),
    altitudeMeters: optionalFinite(raw.altitudeMeters ?? raw.altitude),
    heading: optionalFinite(raw.heading),
    capturedAt,
    permissionStatus,
    locationSource: ["device_gps", "browser_geolocation", "map_adjusted", "coordinate_entry", "place_search", "legacy", "unavailable"].includes(raw.locationSource)
      ? raw.locationSource
      : captureSource === "camera" ? "browser_geolocation" : "unavailable",
    placeId: safeLocationText(raw.placeId, 180),
    mapType: raw.mapType === "satellite" ? "satellite" : "roadmap",
    zoom: Number.isFinite(Number(raw.zoom)) ? Math.min(22, Math.max(1, Number(raw.zoom))) : 18,
    updatedAt: raw.updatedAt && !Number.isNaN(new Date(raw.updatedAt).getTime()) ? new Date(raw.updatedAt) : new Date(),
    ...(raw.updatedBy && mongoose.Types.ObjectId.isValid(raw.updatedBy) ? { updatedBy: raw.updatedBy } : {}),
    isVerified: false,
    formattedAddress: safeLocationText(raw.formattedAddress, 500),
    addressLine1: safeLocationText(raw.addressLine1),
    addressLine2: safeLocationText(raw.addressLine2),
    locality: safeLocationText(raw.locality, 160),
    subLocality: safeLocationText(raw.subLocality, 160),
    city: safeLocationText(raw.city, 160),
    plaza: safeLocationText(raw.plaza, 160),
    district: safeLocationText(raw.district, 160),
    state: safeLocationText(raw.state, 160),
    postalCode: safeLocationText(raw.postalCode, 32),
    country: safeLocationText(raw.country, 160),
    reverseGeocodeProvider: safeLocationText(raw.reverseGeocodeProvider, 80),
    reverseGeocodeStatus: ["pending", "completed", "failed", "unavailable"].includes(raw.reverseGeocodeStatus)
      ? raw.reverseGeocodeStatus
      : "unavailable",
    reverseGeocodedAt: raw.reverseGeocodedAt && !Number.isNaN(new Date(raw.reverseGeocodedAt).getTime())
      ? new Date(raw.reverseGeocodedAt)
      : undefined
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

const toPlainObject = (value) =>
  value && typeof value.toObject === "function" ? value.toObject() : value;

const validCoordinates = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const coordinatesFrom = (raw = {}) => {
  const latitude = optionalFinite(raw.latitude ?? raw.lat);
  const longitude = optionalFinite(raw.longitude ?? raw.lng ?? raw.lon);
  if (validCoordinates(latitude, longitude)) return { latitude, longitude };

  const geoJsonCoordinates = Array.isArray(raw.coordinates)
    ? raw.coordinates
    : Array.isArray(raw.geometry?.coordinates)
      ? raw.geometry.coordinates
      : null;
  if (geoJsonCoordinates?.length >= 2) {
    const geoLongitude = optionalFinite(geoJsonCoordinates[0]);
    const geoLatitude = optionalFinite(geoJsonCoordinates[1]);
    if (validCoordinates(geoLatitude, geoLongitude)) {
      return { latitude: geoLatitude, longitude: geoLongitude };
    }
  }
  return null;
};

const normalizedDisplaySource = (value, fallback = "") => {
  const source = String(value || fallback || "").trim().toLowerCase();
  const allowed = new Set([
    "device_gps",
    "browser_geolocation",
    "map_adjusted",
    "coordinate_entry",
    "place_search",
    "camera",
    "gallery",
    "file",
    "legacy"
  ]);
  return allowed.has(source) ? source : "";
};

const normalizeLocationForDisplay = (rawLocation, fallback = {}) => {
  const primary = toPlainObject(rawLocation) || {};
  const secondary = toPlainObject(fallback) || {};
  const primaryCoordinates = coordinatesFrom(primary);
  const fallbackCoordinates = primaryCoordinates ? null : coordinatesFrom(secondary);
  const coordinates = primaryCoordinates || fallbackCoordinates;
  const legacyGeoCoordinates = coordinates || coordinatesFrom(primary.geoLocation || secondary.geoLocation || {});
  const formattedAddress = safeLocationText(
    primary.formattedAddress ||
    primary.address ||
    primary.plaza ||
    secondary.formattedAddress ||
    secondary.address ||
    "",
    500
  );

  if (!legacyGeoCoordinates && !formattedAddress) return null;

  const accuracyValue = optionalFinite(
    primary.accuracyMeters ?? primary.accuracy ?? secondary.accuracyMeters ?? secondary.accuracy
  );
  const capturedAtValue = primary.capturedAt || primary.timestamp || secondary.capturedAt || secondary.uploadedAt;
  const capturedAt = capturedAtValue ? new Date(capturedAtValue) : null;
  const hasCapturedAt = capturedAt && !Number.isNaN(capturedAt.getTime());
  const source = normalizedDisplaySource(
    primary.source || primary.locationSource,
    secondary.source || secondary.locationSource || secondary.captureSource || (fallbackCoordinates ? "legacy" : "")
  );

  return {
    formattedAddress: formattedAddress || "Address unavailable",
    latitude: legacyGeoCoordinates?.latitude ?? null,
    longitude: legacyGeoCoordinates?.longitude ?? null,
    accuracyMeters: Number.isFinite(accuracyValue) && accuracyValue > 0 ? accuracyValue : null,
    capturedAt: hasCapturedAt ? capturedAt.toISOString() : null,
    source: source || null,
    status: legacyGeoCoordinates ? "captured" : "address_only"
  };
};

const normalizeAssetLocationForDisplay = (asset) => {
  const plain = toPlainObject(asset) || {};
  const canonical = toPlainObject(plain.location);
  const location = normalizeLocationForDisplay(canonical, plain);
  return {
    module: plain.module || null,
    stage: plain.stage || null,
    mediaType: plain.mediaType || null,
    captureSource: plain.captureSource || null,
    url: plain.secureUrl || plain.url || plain.watermarkedUrl || "",
    secureUrl: plain.secureUrl || plain.url || "",
    thumbnailUrl: plain.thumbnailUrl || "",
    watermarkedUrl: plain.watermarkedUrl || "",
    originalName: plain.originalName || "",
    originalFileName: plain.originalFileName || plain.originalName || "",
    mimeType: plain.mimeType || "",
    size: plain.size ?? plain.sizeBytes ?? null,
    sizeBytes: plain.sizeBytes ?? plain.size ?? null,
    width: plain.width ?? null,
    height: plain.height ?? null,
    durationSeconds: plain.durationSeconds ?? null,
    location,
    watermark: plain.watermark
      ? {
          applied: plain.watermark.applied === true,
          processingStatus: plain.watermark.processingStatus || "not_required"
        }
      : null,
    videoOverlay: plain.videoOverlay || "none",
    uploadedAt: plain.uploadedAt || null
  };
};

const normalizeRecordLocations = (record, mediaFields = []) => {
  const plain = toPlainObject(record) || {};
  const next = { ...plain };
  if (Object.prototype.hasOwnProperty.call(plain, "geoLocation")) {
    next.geoLocation = normalizeLocationForDisplay(plain.geoLocation);
  }
  if (Array.isArray(plain.locationAuditHistory)) {
    next.locationAuditHistory = plain.locationAuditHistory.map((entry) => {
      const auditEntry = toPlainObject(entry) || {};
      return {
        reason: auditEntry.reason || "",
        updatedByName: auditEntry.updatedByName || "",
        updatedByRole: auditEntry.updatedByRole || "",
        updatedAt: auditEntry.updatedAt || null,
        previousLocation: normalizeLocationForDisplay(auditEntry.previousLocation),
        newLocation: normalizeLocationForDisplay(auditEntry.newLocation)
      };
    });
  }
  mediaFields.forEach((field) => {
    next[field] = (plain[field] || []).map(normalizeAssetLocationForDisplay);
  });
  return next;
};

// Backward-compatible export for callers outside this repository. Authorization is
// performed by the protected parent-record route; authorized viewers receive the
// same normalized display fields regardless of role or workflow assignment.
const redactRecordLocations = (record, _user, mediaFields = []) =>
  normalizeRecordLocations(record, mediaFields);

module.exports = {
  assetSchema,
  locationSchema,
  normalizeLocation,
  normalizeLocationForDisplay,
  normalizeRecordLocations,
  parseMediaMetadata,
  mergeMediaMetadata,
  redactRecordLocations
};
