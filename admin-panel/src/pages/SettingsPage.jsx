import { useEffect, useMemo, useRef, useState } from "react";
import GlassCard from "../components/common/GlassCard";
import PageHeader from "../components/common/PageHeader";
import AccessControlPanel from "../components/settings/AccessControlPanel";
import { settingsService } from "../api/services";
import { setSession } from "../api/client";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { closeLoadingPopup, showLoadingPopup, showSuccessPopup } from "../utils/alerts";
import { normalizePermissions } from "../utils/permissions";

const notificationStorageKey = "hse_notification_preferences";

const defaultNotifications = {
  browserNotifications: true,
  emailAlerts: true,
  workApprovalAlerts: true,
  hazardAlerts: true,
  trainingReminders: true
};

const tabs = [
  { key: "access", label: "Access Control" },
  { key: "security", label: "Security Settings" },
  { key: "notifications", label: "Notification Settings" },
  { key: "theme", label: "Theme Settings" }
];

const SettingsPage = ({ user }) => {
  const { setUser } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState("access");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingAction, setSavingAction] = useState("");
  const savingRef = useRef(false);

  const [security, setSecurity] = useState({
    sessionTimeout: 30,
    loginAttempts: 5,
    twoFactorAuthentication: false,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireNumber: true,
      requireSpecial: false
    }
  });

  const [branding, setBranding] = useState({
    themeSelection: "dark",
    accentColor: "#1dd3b0",
    dashboardBanner: "",
    loginBackground: ""
  });
  const [bannerFile, setBannerFile] = useState(null);
  const [loginBgFile, setLoginBgFile] = useState(null);

  const [notifications, setNotifications] = useState(defaultNotifications);

  const canManageAccess = useMemo(
    () => ["super_admin", "admin"].includes(user?.role),
    [user?.role]
  );

  const fetchSettings = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await settingsService.get();
      const value = response.settings || {};
      setSecurity({
        sessionTimeout: value.security?.sessionTimeout || 30,
        loginAttempts: value.security?.loginAttempts || 5,
        twoFactorAuthentication: value.security?.twoFactorAuthentication || false,
        passwordPolicy: {
          minLength: value.security?.passwordPolicy?.minLength || 8,
          requireUppercase: value.security?.passwordPolicy?.requireUppercase ?? true,
          requireLowercase: value.security?.passwordPolicy?.requireLowercase ?? true,
          requireNumber: value.security?.passwordPolicy?.requireNumber ?? true,
          requireSpecial: value.security?.passwordPolicy?.requireSpecial ?? false
        }
      });
      setBranding({
        themeSelection: value.branding?.themeSelection || "dark",
        accentColor: value.branding?.accentColor || "#1dd3b0",
        dashboardBanner: value.branding?.dashboardBanner || "",
        loginBackground: value.branding?.loginBackground || ""
      });
    } catch (fetchError) {
      setError(fetchError?.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    const raw = localStorage.getItem(notificationStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      setNotifications((prev) => ({ ...prev, ...(parsed || {}) }));
    } catch (_error) {
      setNotifications(defaultNotifications);
    }
  }, []);

  const saveSecurity = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingAction("security");
    setError("");
    await showLoadingPopup("Uploading Please Wait...", "Saving security settings...");
    try {
      await settingsService.updateSecurity(security);
      await showSuccessPopup("Settings Saved Successfully");
      fetchSettings();
    } catch (saveError) {
      setError(saveError?.response?.data?.message || "Failed to save security settings");
    } finally {
      savingRef.current = false;
      setSavingAction("");
      closeLoadingPopup();
    }
  };

  const saveTheme = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingAction("theme");
    setError("");
    await showLoadingPopup("Uploading Please Wait...", "Saving theme settings...");
    try {
      await settingsService.updateBranding(branding);
      if (bannerFile || loginBgFile) {
        await settingsService.uploadBrandingAssets({
          dashboardBanner: bannerFile,
          loginBackground: loginBgFile
        });
      }
      const selectedTheme =
        branding.themeSelection === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : branding.themeSelection;
      setTheme(selectedTheme);
      await showSuccessPopup("Theme Saved Successfully");
      setBannerFile(null);
      setLoginBgFile(null);
      fetchSettings();
    } catch (saveError) {
      setError(saveError?.response?.data?.message || "Failed to save theme settings");
    } finally {
      savingRef.current = false;
      setSavingAction("");
      closeLoadingPopup();
    }
  };

  const saveNotifications = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSavingAction("notifications");
    setError("");
    await showLoadingPopup("Uploading Please Wait...", "Saving notification settings...");
    try {
      localStorage.setItem(notificationStorageKey, JSON.stringify(notifications));
      await showSuccessPopup("Settings Saved Successfully");
    } finally {
      savingRef.current = false;
      setSavingAction("");
      closeLoadingPopup();
    }
  };

  const onPermissionUpdated = (updatedUser) => {
    const currentId = user?.id || user?._id;
    const updatedId = updatedUser?.id || updatedUser?._id;
    if (!currentId || !updatedId || currentId !== updatedId) return;
    const merged = {
      ...user,
      ...updatedUser,
      permissions: normalizePermissions(updatedUser.permissions, updatedUser.role || user.role)
    };
    setUser(merged);
    setSession({ user: merged });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Enterprise Settings"
        subtitle="Access Control, Security, Notification, and Theme management"
      />

      <GlassCard className="p-5">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-3 py-1.5 text-xs ${
                activeTab === tab.key ? "bg-teal-500/30 text-teal-100" : "bg-white/10 text-slate-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </GlassCard>

      {loading ? <p className="text-sm text-slate-300">Loading settings...</p> : null}
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}

      {!loading && activeTab === "access" ? (
        <AccessControlPanel currentUser={user} onPermissionUpdated={onPermissionUpdated} />
      ) : null}

      {!loading && activeTab === "security" ? (
        <GlassCard className="p-5">
          <h3 className="mb-3 text-lg font-semibold text-white">Security Settings</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="number"
              min="5"
              max="180"
              value={security.sessionTimeout}
              onChange={(event) =>
                setSecurity((prev) => ({ ...prev, sessionTimeout: Number(event.target.value) }))
              }
              placeholder="Session Timeout (minutes)"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            />
            <input
              type="number"
              min="3"
              max="10"
              value={security.loginAttempts}
              onChange={(event) =>
                setSecurity((prev) => ({ ...prev, loginAttempts: Number(event.target.value) }))
              }
              placeholder="Max Login Attempts"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            />
            <input
              type="number"
              min="8"
              max="24"
              value={security.passwordPolicy.minLength}
              onChange={(event) =>
                setSecurity((prev) => ({
                  ...prev,
                  passwordPolicy: { ...prev.passwordPolicy, minLength: Number(event.target.value) }
                }))
              }
              placeholder="Password Min Length"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            />
            <label className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={security.twoFactorAuthentication}
                onChange={(event) =>
                  setSecurity((prev) => ({ ...prev, twoFactorAuthentication: event.target.checked }))
                }
              />
              Enable Two Factor Authentication
            </label>
          </div>
          <button
            type="button"
            onClick={saveSecurity}
            disabled={savingAction === "security"}
            className="mt-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingAction === "security" ? "Saving..." : "Save Security Settings"}
          </button>
        </GlassCard>
      ) : null}

      {!loading && activeTab === "notifications" ? (
        <GlassCard className="p-5">
          <h3 className="mb-3 text-lg font-semibold text-white">Notification Settings</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Object.entries(notifications).map(([key, value]) => (
              <label
                key={key}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-slate-200"
              >
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) =>
                    setNotifications((prev) => ({ ...prev, [key]: event.target.checked }))
                  }
                />
                {key
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (letter) => letter.toUpperCase())}
              </label>
            ))}
          </div>
          <button
            type="button"
            onClick={saveNotifications}
            disabled={savingAction === "notifications"}
            className="mt-4 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingAction === "notifications" ? "Saving..." : "Save Notification Settings"}
          </button>
        </GlassCard>
      ) : null}

      {!loading && activeTab === "theme" ? (
        <GlassCard className="p-5">
          <h3 className="mb-3 text-lg font-semibold text-white">Theme Settings</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select
              value={branding.themeSelection}
              onChange={(event) =>
                setBranding((prev) => ({ ...prev, themeSelection: event.target.value }))
              }
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white"
            >
              <option value="dark" className="bg-slate-900 text-white">
                Dark
              </option>
              <option value="light" className="bg-slate-900 text-white">
                Light
              </option>
              <option value="system" className="bg-slate-900 text-white">
                System
              </option>
            </select>
            <input
              type="color"
              value={branding.accentColor}
              onChange={(event) =>
                setBranding((prev) => ({ ...prev, accentColor: event.target.value }))
              }
              className="h-10 rounded-xl border border-white/15 bg-white/5 px-2"
            />
            <input
              value={branding.dashboardBanner}
              onChange={(event) =>
                setBranding((prev) => ({ ...prev, dashboardBanner: event.target.value }))
              }
              placeholder="Dashboard Banner URL"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white md:col-span-2"
            />
            <input
              value={branding.loginBackground}
              onChange={(event) =>
                setBranding((prev) => ({ ...prev, loginBackground: event.target.value }))
              }
              placeholder="Login Background URL"
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white md:col-span-2"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setBannerFile(event.target.files?.[0] || null)}
              className="rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-300"
            />
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setLoginBgFile(event.target.files?.[0] || null)}
              className="rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-xs text-slate-300"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveTheme}
              disabled={savingAction === "theme"}
              className="rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingAction === "theme" ? "Saving..." : "Save Theme Settings"}
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm text-slate-200"
            >
              Toggle Instant Theme
            </button>
          </div>
        </GlassCard>
      ) : null}

      {!canManageAccess && activeTab === "access" ? (
        <p className="text-xs text-amber-300">Only Admin and Super Admin can manage access control.</p>
      ) : null}
    </div>
  );
};

export default SettingsPage;
