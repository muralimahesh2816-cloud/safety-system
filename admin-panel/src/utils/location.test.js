import {
  googleMapsUrl,
  locationChanged,
  normalizeRecordLocation,
  validCoordinates
} from "./location";

describe("location utilities", () => {
  test("prefers the canonical record location", () => {
    expect(normalizeRecordLocation({
      geoLocation: { latitude: 13.476205, longitude: 74.713226, formattedAddress: "Udupi" },
      beforeImages: [{ location: { latitude: 1, longitude: 2 } }]
    })).toMatchObject({ latitude: 13.476205, longitude: 74.713226, formattedAddress: "Udupi" });
  });

  test("falls back to legacy evidence GPS", () => {
    expect(normalizeRecordLocation({ beforeImages: [{ location: { latitude: 12, longitude: 77 } }] }))
      .toMatchObject({ latitude: 12, longitude: 77 });
  });

  test("validates ranges and detects meaningful coordinate changes", () => {
    expect(validCoordinates(90, 180)).toBe(true);
    expect(validCoordinates(91, 180)).toBe(false);
    expect(locationChanged({ latitude: 12, longitude: 77 }, { latitude: 12.000001, longitude: 77 })).toBe(true);
  });

  test("builds an encoded HTTPS Google Maps link", () => {
    expect(googleMapsUrl({ latitude: 13.4, longitude: 74.7 }))
      .toBe("https://www.google.com/maps/search/?api=1&query=13.4%2C74.7");
  });
});
