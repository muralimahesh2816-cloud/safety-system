import { useCallback, useState } from "react";

export const LOCATION_STATUS = {
  IDLE: "idle",
  REQUESTING: "requesting",
  CAPTURED: "captured",
  DENIED: "denied",
  UNAVAILABLE: "unavailable",
  TIMEOUT: "timeout",
  INSECURE: "insecure",
  UNSUPPORTED: "unsupported"
};

const isLocalDevelopment = () =>
  typeof window !== "undefined" && ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

const errorStatus = (error) => {
  if (error?.code === 1) return LOCATION_STATUS.DENIED;
  if (error?.code === 2) return LOCATION_STATUS.UNAVAILABLE;
  if (error?.code === 3) return LOCATION_STATUS.TIMEOUT;
  return LOCATION_STATUS.UNAVAILABLE;
};

export const getLocationMessage = (status) => ({
  [LOCATION_STATUS.REQUESTING]: "Requesting location...",
  [LOCATION_STATUS.CAPTURED]: "Location captured",
  [LOCATION_STATUS.DENIED]: "Location permission was not granted. Enable location access in your browser settings and try again.",
  [LOCATION_STATUS.UNAVAILABLE]: "Unable to detect your current location.",
  [LOCATION_STATUS.TIMEOUT]: "GPS timed out. Move to an open area and retry.",
  [LOCATION_STATUS.INSECURE]: "A secure HTTPS connection is required for camera and location evidence.",
  [LOCATION_STATUS.UNSUPPORTED]: "Location capture is not supported in this browser."
}[status] || "Location has not been requested.");

export default function useDeviceLocation({ accuracyWarningMeters = 100 } = {}) {
  const [status, setStatus] = useState(LOCATION_STATUS.IDLE);
  const [location, setLocation] = useState(null);

  const captureLocation = useCallback(() => {
    if (typeof window === "undefined" || (!window.isSecureContext && !isLocalDevelopment())) {
      setStatus(LOCATION_STATUS.INSECURE);
      return Promise.resolve({ status: LOCATION_STATUS.INSECURE, location: null });
    }
    if (!navigator.geolocation) {
      setStatus(LOCATION_STATUS.UNSUPPORTED);
      return Promise.resolve({ status: LOCATION_STATUS.UNSUPPORTED, location: null });
    }

    setStatus(LOCATION_STATUS.REQUESTING);
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const capturedAt = new Date().toISOString();
          const nextLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            altitude: Number.isFinite(position.coords.altitude) ? position.coords.altitude : null,
            altitudeMeters: Number.isFinite(position.coords.altitude) ? position.coords.altitude : null,
            heading: Number.isFinite(position.coords.heading) ? position.coords.heading : null,
            capturedAt,
            permissionStatus: "granted",
            locationSource: "browser_geolocation",
            isVerified: false,
            lowAccuracy: position.coords.accuracy > accuracyWarningMeters
          };
          setLocation(nextLocation);
          setStatus(LOCATION_STATUS.CAPTURED);
          resolve({ status: LOCATION_STATUS.CAPTURED, location: nextLocation });
        },
        (error) => {
          const nextStatus = errorStatus(error);
          setStatus(nextStatus);
          setLocation(null);
          resolve({ status: nextStatus, location: null });
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 15000 }
      );
    });
  }, [accuracyWarningMeters]);

  return { status, location, captureLocation };
}
