import { renderHook, act } from "@testing-library/react";
import useDeviceLocation, { LOCATION_STATUS } from "./useDeviceLocation";

test("captures one high-accuracy device location request with altitude metadata", async () => {
  const getCurrentPosition = jest.fn((success) => success({
    coords: {
      latitude: 13.494759,
      longitude: 74.719246,
      accuracy: 18,
      altitude: 42,
      heading: null
    }
  }));
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition }
  });

  const { result } = renderHook(() => useDeviceLocation());
  let captured;
  await act(async () => {
    captured = await result.current.captureLocation();
  });

  expect(captured.status).toBe(LOCATION_STATUS.CAPTURED);
  expect(captured.location).toMatchObject({
    latitude: 13.494759,
    longitude: 74.719246,
    accuracyMeters: 18,
    altitudeMeters: 42,
    locationSource: "browser_geolocation",
    isVerified: false
  });
  expect(getCurrentPosition).toHaveBeenCalledTimes(1);
  expect(getCurrentPosition.mock.calls[0][2]).toEqual({
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 15000
  });
});
