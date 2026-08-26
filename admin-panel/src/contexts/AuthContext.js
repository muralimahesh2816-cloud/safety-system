import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService, mobileAuthService } from "../api/services";
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
    if (res.pendingOtp) {
      return res;
    }
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

  /* ----------------------------------------- mobile number + OTP sign-in --- */

  // Requesting a code establishes nothing — no session, no tokens. It only
  // asks the server to send one, and returns the masked destination so the UI
  // can confirm where it went.
  const requestMobileOtp = useCallback(async (mobile) => {
    const csrf = await authService.getCsrf();
    setSession({ csrfToken: csrf.csrfToken });
    return mobileAuthService.requestOtp(mobile);
  }, []);

  // Verification is what authenticates. It stores exactly the same session the
  // email/password path stores — same access token, same CSRF token, same user
  // shape — so everything downstream is unaware of which door was used.
  const verifyMobileOtp = useCallback(async (mobile, otp) => {
    const res = await mobileAuthService.verifyOtp(mobile, otp);
    setSession({ token: res.token, user: res.user, csrfToken: res.csrfToken });
    setUser(res.user);
    return res.user;
  }, []);

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
      requestMobileOtp,
      verifyMobileOtp,
      logout,
      setUser
    }),
    [user, loading, login, verifyOtp, resendOtp, requestMobileOtp, verifyMobileOtp, logout]
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
