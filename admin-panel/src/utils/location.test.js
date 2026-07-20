import {
  buildGoogleMapsUrl,
  formatLocationAccuracy,
  formatLocationCoordinates,
  normalizeEvidenceLocation
} from "./location";

test("normalizes canonical location values for display", () => {
  const location = normalizeEvidenceLocation({
    formattedAddress: "Karkada Badaholi and Mooduholi, Saligrama, Karnataka 576225",
    latitude: 13.494759,
    longitude: 74.719246,
    accuracyMeters: 18,
    capturedAt: "2026-07-20T10:52:00.000Z",
    source: "device_gps",
    status: "captured"
  });

  expect(formatLocationCoordinates(location)).toBe("13.494759, 74.719246");
  expect(formatLocationAccuracy(location)).toBe("±18 metres");
  expect(buildGoogleMapsUrl(location)).toBe("https://www.google.com/maps?q=13.494759,74.719246");
});

test("supports legacy lat and lng plus GeoJSON coordinates", () => {
  expect(normalizeEvidenceLocation({ lat: 13.494759, lng: 74.719246 }).latitude).toBe(13.494759);
  expect(normalizeEvidenceLocation({ coordinates: [74.719246, 13.494759] }).longitude).toBe(74.719246);
});

test("handles address-only, missing, and invalid coordinates safely", () => {
  const addressOnly = normalizeEvidenceLocation({ formattedAddress: "Address only" });
  expect(addressOnly.status).toBe("address_only");
  expect(formatLocationCoordinates(addressOnly)).toBe("Not recorded");
  expect(buildGoogleMapsUrl({ latitude: 91, longitude: 74 })).toBe("");
  expect(normalizeEvidenceLocation({})).toBeNull();
});

