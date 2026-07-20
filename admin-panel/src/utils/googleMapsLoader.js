let mapsPromise;

export const loadGoogleMaps = () => {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  const mapId = process.env.REACT_APP_GOOGLE_MAP_ID;
  if (!apiKey) return Promise.reject(new Error("MAPS_NOT_CONFIGURED"));
  if (!mapId) return Promise.reject(new Error("MAP_ID_NOT_CONFIGURED"));
  if (window.google?.maps?.importLibrary) return Promise.resolve(window.google.maps);
  if (mapsPromise) return mapsPromise;

  mapsPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-sms-google-maps]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google.maps), { once: true });
      existing.addEventListener("error", () => reject(new Error("MAPS_LOAD_FAILED")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.dataset.smsGoogleMaps = "true";
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker`;
    script.onload = () => window.google?.maps ? resolve(window.google.maps) : reject(new Error("MAPS_LOAD_FAILED"));
    script.onerror = () => reject(new Error("MAPS_LOAD_FAILED"));
    document.head.appendChild(script);
  });
  return mapsPromise;
};

export const GOOGLE_MAP_ID = process.env.REACT_APP_GOOGLE_MAP_ID || "";
