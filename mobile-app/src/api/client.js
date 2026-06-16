import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/api";
import { clearSessionStorage, storageKeys } from "../utils/storage";

export const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000
});

let onSessionExpired = null;

export const setSessionExpiredHandler = (handler) => {
  onSessionExpired = handler;
};

export const getAccessToken = async () => AsyncStorage.getItem(storageKeys.accessToken);
export const getRefreshToken = async () => AsyncStorage.getItem(storageKeys.refreshToken);

client.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  config.headers = config.headers || {};
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retry = true;
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        try {
          const refreshed = await client.post("/auth/refresh", { refreshToken });
          const token = refreshed.data?.token || refreshed.data?.accessToken;
          const nextRefreshToken = refreshed.data?.refreshToken || refreshToken;
          if (token) {
            await AsyncStorage.setItem(storageKeys.accessToken, token);
            await AsyncStorage.setItem(storageKeys.refreshToken, nextRefreshToken);
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${token}`;
            return client(original);
          }
        } catch (_refreshError) {
          // Fall through to session expiration cleanup.
        }
      }
      await clearSessionStorage();
      if (onSessionExpired) onSessionExpired();
    }
    return Promise.reject(error);
  }
);

export const parseApiError = (error, fallback = "Something went wrong") =>
  error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;
