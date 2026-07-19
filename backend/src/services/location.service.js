const ApiError = require("../utils/api-error");
const { env } = require("../config/env");
const logger = require("../utils/logger");

const ADDRESS_UNAVAILABLE = "Address unavailable";

const cleanText = (value, maxLength = 240) =>
  String(value || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLength);

const validateCoordinates = (latitude, longitude) => {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new ApiError(400, "Latitude must be a number between -90 and 90");
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new ApiError(400, "Longitude must be a number between -180 and 180");
  }
  return { latitude: lat, longitude: lon };
};

const addressFromParts = (parts) => [
  parts.addressLine1,
  parts.addressLine2,
  parts.locality || parts.subLocality,
  parts.city,
  parts.district,
  parts.state,
  parts.postalCode,
  parts.country
].map((value) => cleanText(value)).filter((value, index, values) => value && values.indexOf(value) === index).join(", ");

const normalizeProviderResponse = (payload = {}, provider = "generic", coordinates = {}) => {
  const source = payload?.data || payload || {};
  let raw = source;

  if (provider === "google") {
    const result = source.results?.[0] || {};
    const components = Object.fromEntries((result.address_components || []).flatMap((component) =>
      (component.types || []).map((type) => [type, component.long_name])
    ));
    raw = {
      formattedAddress: result.formatted_address,
      addressLine1: [components.street_number, components.route].filter(Boolean).join(" "),
      subLocality: components.sublocality || components.sublocality_level_1,
      locality: components.locality,
      city: components.locality,
      district: components.administrative_area_level_2,
      state: components.administrative_area_level_1,
      postalCode: components.postal_code,
      country: components.country
    };
  } else if (provider === "mapbox") {
    const feature = source.features?.[0] || {};
    const context = [...(feature.context || []), feature];
    const find = (prefix) => context.find((entry) => String(entry.id || "").startsWith(prefix));
    raw = {
      formattedAddress: feature.place_name,
      addressLine1: [feature.address, feature.text].filter(Boolean).join(" "),
      locality: find("locality")?.text,
      city: find("place")?.text,
      district: find("district")?.text,
      state: find("region")?.text,
      postalCode: find("postcode")?.text,
      country: find("country")?.text
    };
  } else if (provider === "nominatim") {
    const address = source.address || {};
    raw = {
      formattedAddress: source.display_name,
      addressLine1: [address.house_number, address.road].filter(Boolean).join(" "),
      addressLine2: address.neighbourhood,
      subLocality: address.suburb,
      locality: address.village || address.town,
      city: address.city || address.municipality,
      district: address.state_district || address.county,
      state: address.state,
      postalCode: address.postcode,
      country: address.country
    };
  }

  const normalized = {
    formattedAddress: cleanText(raw.formattedAddress || raw.formatted_address || raw.display_name, 500),
    addressLine1: cleanText(raw.addressLine1 || raw.address_line_1),
    addressLine2: cleanText(raw.addressLine2 || raw.address_line_2),
    locality: cleanText(raw.locality, 160),
    subLocality: cleanText(raw.subLocality || raw.sub_locality, 160),
    city: cleanText(raw.city, 160),
    district: cleanText(raw.district, 160),
    state: cleanText(raw.state, 160),
    postalCode: cleanText(raw.postalCode || raw.postal_code, 32),
    country: cleanText(raw.country, 160),
    latitude: coordinates.latitude,
    longitude: coordinates.longitude
  };
  if (!normalized.formattedAddress) normalized.formattedAddress = addressFromParts(normalized);
  return normalized;
};

const buildProviderRequest = ({ provider, apiUrl, apiKey, latitude, longitude, signal }) => {
  if (provider === "google") {
    const url = new URL(apiUrl);
    url.searchParams.set("latlng", `${latitude},${longitude}`);
    if (apiKey) url.searchParams.set("key", apiKey);
    return { url, options: { signal, headers: { Accept: "application/json" } } };
  }
  if (provider === "mapbox") {
    const expanded = apiUrl.replace("{longitude}", longitude).replace("{latitude}", latitude);
    const url = new URL(expanded);
    if (apiKey) url.searchParams.set("access_token", apiKey);
    return { url, options: { signal, headers: { Accept: "application/json" } } };
  }
  if (provider === "nominatim") {
    const url = new URL(apiUrl);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    url.searchParams.set("lat", latitude);
    url.searchParams.set("lon", longitude);
    return {
      url,
      options: {
        signal,
        headers: { Accept: "application/json", "User-Agent": "SafetyManagementSystem/1.0" }
      }
    };
  }
  return {
    url: apiUrl,
    options: {
      method: "POST",
      signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {})
      },
      body: JSON.stringify({ latitude, longitude })
    }
  };
};

const reverseGeocode = async (latitude, longitude, { requestId } = {}) => {
  const coordinates = validateCoordinates(latitude, longitude);
  const provider = String(env.media.reverseGeocodingProvider || "none").toLowerCase();
  const apiUrl = env.media.reverseGeocodingApiUrl;
  const startedAt = Date.now();

  if (provider === "none" || !apiUrl) {
    logger.info("Reverse geocoding unavailable", { requestId, provider, durationMs: Date.now() - startedAt });
    return {
      ...coordinates,
      formattedAddress: ADDRESS_UNAVAILABLE,
      reverseGeocodeProvider: provider,
      reverseGeocodeStatus: "unavailable"
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, env.media.reverseGeocodingTimeoutMs));
  try {
    const request = buildProviderRequest({
      provider,
      apiUrl,
      apiKey: env.media.reverseGeocodingApiKey,
      ...coordinates,
      signal: controller.signal
    });
    const response = await fetch(request.url, request.options);
    if (!response.ok) throw new Error(`Provider returned ${response.status}`);
    const normalized = normalizeProviderResponse(await response.json(), provider, coordinates);
    const completed = Boolean(normalized.formattedAddress);
    logger.info("Reverse geocoding completed", {
      requestId,
      provider,
      success: completed,
      durationMs: Date.now() - startedAt
    });
    return {
      ...normalized,
      formattedAddress: normalized.formattedAddress || ADDRESS_UNAVAILABLE,
      reverseGeocodeProvider: provider,
      reverseGeocodeStatus: completed ? "completed" : "failed",
      reverseGeocodedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.warn("Reverse geocoding failed", {
      requestId,
      provider,
      reason: error?.name === "AbortError" ? "timeout" : "provider_error",
      durationMs: Date.now() - startedAt
    });
    return {
      ...coordinates,
      formattedAddress: ADDRESS_UNAVAILABLE,
      reverseGeocodeProvider: provider,
      reverseGeocodeStatus: "failed"
    };
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { ADDRESS_UNAVAILABLE, validateCoordinates, normalizeProviderResponse, reverseGeocode };
