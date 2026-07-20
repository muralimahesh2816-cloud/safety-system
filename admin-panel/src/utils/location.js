export const DEFAULT_LOCATION = Object.freeze({
  latitude: Number(process.env.REACT_APP_DEFAULT_MAP_LAT || 13.494759),
  longitude: Number(process.env.REACT_APP_DEFAULT_MAP_LNG || 74.719246),
  zoom: Number(process.env.REACT_APP_DEFAULT_MAP_ZOOM || 18),
  mapType: "roadmap",
  locationSource: "unavailable"
});

const finite = (value) => value !== "" && value != null && Number.isFinite(Number(value));

export const validCoordinates = (latitude, longitude) =>
  finite(latitude) && finite(longitude) && Number(latitude) >= -90 && Number(latitude) <= 90 && Number(longitude) >= -180 && Number(longitude) <= 180;

export const normalizeRecordLocation = (record = {}) => {
  const canonical = record.geoLocation || record.recordLocation || {};
  const media = [
    ...(record.beforeImages || []), ...(record.beforeVideos || []),
    ...(record.afterImages || []), ...(record.afterVideos || []),
    ...(record.evidenceImages || []), ...(record.evidenceVideos || []),
    ...(record.closureImages || []), ...(record.closureVideos || [])
  ].map((item) => item?.location).find((item) => validCoordinates(item?.latitude, item?.longitude)) || {};
  const geoJson = Array.isArray(record.coordinates) ? record.coordinates : record.geometry?.coordinates;
  const latitude = canonical.latitude ?? record.latitude ?? record.lat ?? media.latitude ?? (Array.isArray(geoJson) ? geoJson[1] : undefined);
  const longitude = canonical.longitude ?? record.longitude ?? record.lng ?? media.longitude ?? (Array.isArray(geoJson) ? geoJson[0] : undefined);
  return {
    ...media,
    ...canonical,
    ...(validCoordinates(latitude, longitude) ? { latitude: Number(latitude), longitude: Number(longitude) } : {}),
    formattedAddress: canonical.formattedAddress || media.formattedAddress || record.formattedAddress || "",
    mapType: canonical.mapType || "roadmap",
    zoom: Number(canonical.zoom || DEFAULT_LOCATION.zoom),
    locationSource: canonical.locationSource || canonical.source || media.locationSource || "legacy"
  };
};

export const locationChanged = (left = {}, right = {}) =>
  validCoordinates(right.latitude, right.longitude) && (
    Number(left.latitude).toFixed(7) !== Number(right.latitude).toFixed(7) ||
    Number(left.longitude).toFixed(7) !== Number(right.longitude).toFixed(7) ||
    String(left.formattedAddress || "") !== String(right.formattedAddress || "")
  );

export const googleMapsUrl = (location = {}) => validCoordinates(location.latitude, location.longitude)
  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${Number(location.latitude)},${Number(location.longitude)}`)}`
  : "";
