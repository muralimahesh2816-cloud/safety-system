import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authService } from "../api/services";
import { parseApiError, setSessionExpiredHandler } from "../api/client";
import { clearSessionStorage, getJson, setJson, storageKeys } from "../utils/storage";
import { normalizePermissions } from "../utils/permissions";
import { registerForPushNotificationsAsync } from "../utils/notifications";

const AuthContext = createContext(null);

const normalizeUser = (user = {}) => ({
  ...user,
  id: user.id || user._id,
  permissions: normalizePermissions(user.permissions, user.role)
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [authError, setAuthError] = useState("");

  const persistSession = useCallback(async ({ token, accessToken, refreshToken, user: nextUser }) => {
    const resolvedToken = token || accessToken;
    if (resolvedToken) await AsyncStorage.setItem(storageKeys.accessToken, resolvedToken);
    if (refreshToken) await AsyncStorage.setItem(storageKeys.refreshToken, refreshToken);
    if (nextUser) {
      const normalized = normalizeUser(nextUser);
      await setJson(storageKeys.user, normalized);
      setUser(normalized);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (_error) {
      // Local logout must always succeed.
    }
    await clearSessionStorage();
    setUser(null);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      Alert.alert("Session expired", "Please login again.");
    });
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const token = await AsyncStorage.getItem(storageKeys.accessToken);
        const cachedUser = await getJson(storageKeys.user, null);
        if (token && cachedUser) setUser(normalizeUser(cachedUser));
        if (token) {
          const response = await authService.me();
          if (response?.user) await persistSession({ user: response.user });
        }
      } catch (_error) {
        await clearSessionStorage();
        setUser(null);
      } finally {
        setBooting(false);
      }
    };
    bootstrap();
  }, [persistSession]);

  const login = useCallback(
    async ({ email, password }) => {
      setAuthError("");
      try {
        const response = await authService.login({ email, password });
        await persistSession({
          token: response.token || response.accessToken,
          refreshToken: response.refreshToken,
          user: response.user
        });
        registerForPushNotificationsAsync();
        return { success: true };
      } catch (error) {
        const message = parseApiError(error, "Login failed");
        setAuthError(message);
        return { success: false, message };
      }
    },
    [persistSession]
  );

  const value = useMemo(
    () => ({ user, setUser, booting, authError, login, logout }),
    [user, booting, authError, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
