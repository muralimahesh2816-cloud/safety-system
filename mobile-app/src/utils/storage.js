import AsyncStorage from "@react-native-async-storage/async-storage";

export const storageKeys = {
  accessToken: "hse_mobile_access_token",
  refreshToken: "hse_mobile_refresh_token",
  user: "hse_mobile_user",
  dashboardCache: "hse_mobile_dashboard_cache",
  workCache: "hse_mobile_work_cache",
  hazardCache: "hse_mobile_hazard_cache",
  trainingCache: "hse_mobile_training_cache",
  theme: "hse_mobile_theme"
};

export const setJson = async (key, value) => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

export const getJson = async (key, fallback = null) => {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return fallback;
  }
};

export const removeMany = async (keys) => AsyncStorage.multiRemove(keys);

export const clearSessionStorage = async () =>
  removeMany([storageKeys.accessToken, storageKeys.refreshToken, storageKeys.user]);

export const clearAppCache = async () =>
  removeMany([
    storageKeys.dashboardCache,
    storageKeys.workCache,
    storageKeys.hazardCache,
    storageKeys.trainingCache
  ]);
