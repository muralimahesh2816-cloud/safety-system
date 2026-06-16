import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../api/services";
import { clearSession, getStoredUser, setSession } from "../api/client";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(getStoredUser());
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    try {
      const csrf = await authService.getCsrf();
      setSession({ csrfToken: csrf.csrfToken });
      if (!getStoredUser()) {
        setLoading(false);
        return;
      }
      const res = await authService.me();
      setUser(res.user);
      setSession({ user: res.user });
    } catch (_error) {
      clearSession();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email, password) => {
    const csrf = await authService.getCsrf();
    setSession({ csrfToken: csrf.csrfToken });
    const res = await authService.login({ email, password });
    if (res.pendingOtp) return res;
    setSession({
      token: res.token,
      user: res.user,
      csrfToken: res.csrfToken
    });
    setUser(res.user);
    return res.user;
  }, []);

  const verifyOtp = useCallback(async (email, otp) => {
    const res = await authService.verifyOtp({ email, otp });
    setSession({
      token: res.token,
      user: res.user,
      csrfToken: res.csrfToken
    });
    setUser(res.user);
    return res.user;
  }, []);

  const resendOtp = useCallback(async (email) => authService.resendOtp({ email }), []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch (_error) {
      // Ignore logout errors and clear local session.
    }
    clearSession();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      verifyOtp,
      resendOtp,
      logout,
      setUser
    }),
    [user, loading, login, verifyOtp, resendOtp, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used inside AuthProvider");
  }
  return context;
};
