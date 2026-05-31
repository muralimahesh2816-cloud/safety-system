import axios from "axios";
import { API_BASE_URL } from "../config/appConfig";
import { getMediaUrl } from "../utils/media";
import { normalizePermissions } from "../utils/permissions";

const ACCESS_TOKEN_KEY = "hse_access_token";
const USER_KEY = "hse_user";
const CSRF_KEY = "hse_csrf_token";

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

const setSession = ({ token, user, csrfToken }) => {
  const normalizedUser = user
    ? {
        ...user,
        permissions: normalizePermissions(user.permissions, user.role)
      }
    : null;
  const normalizedUserId = normalizedUser?.id || normalizedUser?._id || "";
  const profileImageUrl = normalizedUser?.profilePhoto
    ? getMediaUrl(normalizedUser.profilePhoto?.url || normalizedUser.profilePhoto)
    : "";

  if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token);
  if (normalizedUser) localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  if (csrfToken) localStorage.setItem(CSRF_KEY, csrfToken);

  // Legacy key compatibility for existing business modules.
  if (token) localStorage.setItem("token", token);
  if (normalizedUserId) localStorage.setItem("id", normalizedUserId);
  if (normalizedUserId) localStorage.setItem("userId", normalizedUserId);
  if (normalizedUser?.name) localStorage.setItem("name", normalizedUser.name);
  if (normalizedUser?.email) localStorage.setItem("email", normalizedUser.email);
  if (normalizedUser?.mobile) localStorage.setItem("mobile", normalizedUser.mobile);
  if (normalizedUser?.role) localStorage.setItem("role", normalizedUser.role);
  if (profileImageUrl) localStorage.setItem("profileImage", profileImageUrl);
  localStorage.setItem("loginTime", new Date().toLocaleString());
  localStorage.setItem("lastLogin", new Date().toLocaleString());
};

const clearSession = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(CSRF_KEY);
  localStorage.removeItem("token");
  localStorage.removeItem("id");
  localStorage.removeItem("userId");
  localStorage.removeItem("name");
  localStorage.removeItem("email");
  localStorage.removeItem("mobile");
  localStorage.removeItem("role");
  localStorage.removeItem("profileImage");
  localStorage.removeItem("loginTime");
  localStorage.removeItem("lastLogin");
};

const getStoredUser = () => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      ...parsed,
      permissions: normalizePermissions(parsed?.permissions, parsed?.role)
    };
  } catch (_error) {
    return null;
  }
};

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const csrfToken = localStorage.getItem(CSRF_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (!["get", "head", "options"].includes((config.method || "get").toLowerCase())) {
    if (csrfToken) {
      config.headers["x-csrf-token"] = csrfToken;
    }
  }
  return config;
});

let refreshPromise = null;
const refreshToken = async () => {
  if (!refreshPromise) {
    refreshPromise = client
      .post("/auth/refresh")
      .then((res) => {
        setSession({
          token: res.data.token,
          csrfToken: res.data.csrfToken
        });
        return res.data.token;
      })
      .catch((error) => {
        clearSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    if (
      status === 401 &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      original._retry = true;
      try {
        const newToken = await refreshToken();
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch (_refreshError) {
        clearSession();
      }
    }
    return Promise.reject(error);
  }
);

export { client, setSession, clearSession, getStoredUser, ACCESS_TOKEN_KEY };
