import axios from "axios";
import { API_BASE_URL } from "../config/appConfig";
import { getMediaUrl } from "../utils/media";
import { normalizePermissions } from "../utils/permissions";

const ACCESS_TOKEN_KEY = "hse_access_token";
const USER_KEY = "hse_user";
const CSRF_KEY = "hse_csrf_token";
const MUTATING_METHODS = ["post", "put", "patch", "delete"];

const client = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true
});

const csrfClient = axios.create({
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
  const profileImageUrl = getMediaUrl(
    normalizedUser?.profilePhoto?.url ||
      normalizedUser?.profilePhoto?.path ||
      normalizedUser?.profilePhoto?.filename ||
      normalizedUser?.profilePhoto ||
      normalizedUser?.profileImage ||
      normalizedUser?.photo ||
      normalizedUser?.photoUrl ||
      normalizedUser?.avatar
  );

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
  if (profileImageUrl) {
    localStorage.setItem("profileImage", profileImageUrl);
  } else {
    localStorage.removeItem("profileImage");
  }
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

client.interceptors.request.use(async (config) => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  const method = (config.method || "get").toLowerCase();
  const isMutating = MUTATING_METHODS.includes(method);
  let csrfToken = localStorage.getItem(CSRF_KEY);
  config.headers = config.headers || {};

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (isMutating && token && !csrfToken && !config._skipCsrfFetch) {
    csrfToken = await refreshCsrfToken();
  }

  if (isMutating && csrfToken) {
    config.headers["x-csrf-token"] = csrfToken;
  }
  return config;
});

let refreshPromise = null;
let csrfPromise = null;

const refreshCsrfToken = async () => {
  if (!csrfPromise) {
    csrfPromise = csrfClient
      .get("/auth/csrf", { _skipCsrfRetry: true })
      .then((res) => {
        const csrfToken = res.data?.csrfToken || "";
        if (csrfToken) {
          localStorage.setItem(CSRF_KEY, csrfToken);
        }
        return csrfToken;
      })
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
};

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
    const message = error.response?.data?.message || "";
    const method = (original?.method || "get").toLowerCase();

    if (
      status === 403 &&
      original &&
      !original?._csrfRetry &&
      !original?._skipCsrfRetry &&
      MUTATING_METHODS.includes(method) &&
      message.toLowerCase().includes("csrf")
    ) {
      original._csrfRetry = true;
      try {
        const csrfToken = await refreshCsrfToken();
        if (csrfToken) {
          original.headers = original.headers || {};
          original.headers["x-csrf-token"] = csrfToken;
        }
        return client(original);
      } catch (_csrfError) {
        return Promise.reject(error);
      }
    }

    if (
      status === 401 &&
      original &&
      !original?._retry &&
      !original?.url?.includes("/auth/login") &&
      !original?.url?.includes("/auth/refresh")
    ) {
      original._retry = true;
      try {
        const newToken = await refreshToken();
        original.headers = original.headers || {};
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
