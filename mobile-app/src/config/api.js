import Constants from "expo-constants";

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  Constants.expoConfig?.extra?.apiBaseUrl ||
  "https://utpl-safety-backend.onrender.com/api/v1";

export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/i, "").replace(/\/+$/, "");
export const UPLOADS_BASE_URL = `${BACKEND_BASE_URL}/uploads`;
