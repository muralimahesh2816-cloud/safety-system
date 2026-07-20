import { formatDateTime } from "./format";

const optionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const validCoordinates = (latitude, longitude) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  latitude >= -90 &&
  latitude <= 90 &&
  longitude >= -180 &&
  longitude <= 180;

const coordinatesFrom = (value = {}) => {
  const latitude = optionalNumber(value.latitude ?? value.lat);
  const longitude = optionalNumber(value.longitude ?? value.lng ?? value.lon);
  if (validCoordinates(latitude, longitude)) return { latitude, longitude };

  const coordinates = Array.isArray(value.coordinates)
    ? value.coordinates
    : Array.isArray(value.geometry?.coordinates)
      ? value.geometry.coordinates
      : null;
  if (!coordinates || coordinates.length < 2) return null;
  const geoLongitude = optionalNumber(coordinates[0]);
  const geoLatitude = optionalNumber(coordinates[1]);
  return validCoordinates(geoLatitude, geoLongitude)
    ? { latitude: geoLatitude, longitude: geoLongitude }
    : null;
};

export const normalizeEvidenceLocation = (value, fallback = {}) => {
  const primary = value && typeof value === "object" ? value : {};
  const secondary = fallback && typeof fallback === "object" ? fallback : {};
  const coordinates = coordinatesFrom(primary) || coordinatesFrom(secondary) ||
    coordinatesFrom(primary.geoLocation || secondary.geoLocation || {});
  const formattedAddress = String(
    primary.formattedAddress ||
    primary.address ||
    primary.plaza ||
    secondary.formattedAddress ||
    secondary.address ||
    ""
  ).trim();

  if (!coordinates && !formattedAddress) return null;

  const accuracy = optionalNumber(
    primary.accuracyMeters ?? primary.accuracy ?? secondary.accuracyMeters ?? secondary.accuracy
  );
  const capturedAt = primary.capturedAt || primary.timestamp || secondary.capturedAt || secondary.uploadedAt || null;
  const source = primary.source || primary.locationSource || secondary.source ||
    secondary.locationSource || secondary.captureSource || null;

  return {
    formattedAddress: formattedAddress || "Address unavailable",
    latitude: coordinates?.latitude ?? null,
    longitude: coordinates?.longitude ?? null,
    accuracyMeters: Number.isFinite(accuracy) && accuracy > 0 ? accuracy : null,
    capturedAt,
    source,
    status: primary.status || (coordinates ? "captured" : "address_only")
  };
};

export const hasValidCoordinates = (location) => {
  const normalized = normalizeEvidenceLocation(location);
  return validCoordinates(normalized?.latitude, normalized?.longitude);
};

export const formatLocationCoordinates = (location) => {
  const normalized = normalizeEvidenceLocation(location);
  if (!validCoordinates(normalized?.latitude, normalized?.longitude)) return "Not recorded";
  return `${normalized.latitude.toFixed(6)}, ${normalized.longitude.toFixed(6)}`;
};

export const formatLocationAccuracy = (location) => {
  const normalized = normalizeEvidenceLocation(location);
  return Number.isFinite(normalized?.accuracyMeters)
    ? `±${Math.round(normalized.accuracyMeters)} metres`
    : "Not available";
};

export const formatLocationCapturedAt = (location) => {
  const normalized = normalizeEvidenceLocation(location);
  return normalized?.capturedAt ? formatDateTime(normalized.capturedAt) : "Not recorded";
};

export const formatLocationSource = (location) => {
  const normalized = normalizeEvidenceLocation(location);
  const labels = {
    device_gps: "Device GPS",
    browser_geolocation: "Device GPS",
    map_adjusted: "Controlled correction",
    coordinate_entry: "Coordinate entry",
    place_search: "Place search",
    camera: "Camera capture",
    gallery: "Gallery upload",
    file: "File upload",
    legacy: "Legacy record"
  };
  return labels[String(normalized?.source || "").toLowerCase()] || "Not recorded";
};

export const buildGoogleMapsUrl = (location) => {
  const normalized = normalizeEvidenceLocation(location);
  if (!validCoordinates(normalized?.latitude, normalized?.longitude)) return "";
  return `https://www.google.com/maps?q=${normalized.latitude.toFixed(6)},${normalized.longitude.toFixed(6)}`;
};

