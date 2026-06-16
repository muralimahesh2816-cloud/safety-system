import React, { useMemo, useState } from "react";
import { Alert, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AppHeader from "../components/AppHeader";
import GlassCard from "../components/GlassCard";
import Loader from "../components/Loader";
import Screen from "../components/Screen";
import StatusChip from "../components/StatusChip";
import { API_BASE_URL } from "../config/api";
import { useAuth } from "../context/AuthContext";
import { clearAppCache } from "../utils/storage";
import { registerForPushNotificationsAsync } from "../utils/notifications";
import { gradients, theme } from "../theme";

const pages = ["Dashboard", "Work", "Hazards", "Training", "Users", "Reports", "Settings"];

const SettingTile = ({ icon, title, text, tone = theme.colors.accent }) => (
  <View style={styles.tile}>
    <View style={[styles.tileIcon, { borderColor: `${tone}70`, backgroundColor: `${tone}18` }]}>
      <Ionicons name={icon} size={18} color={tone} />
    </View>
    <View style={styles.tileCopy}>
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileText}>{text}</Text>
    </View>
  </View>
);

const SettingsScreen = () => {
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(true);
  const [busy, setBusy] = useState(false);

  const allowedPages = useMemo(() => {
    const permissions = user?.permissions || {};
    return pages.filter((page) => {
      const key = page.toLowerCase() === "hazards" ? "hazards" : page.toLowerCase();
      return user?.role?.toLowerCase()?.includes("admin") || permissions[key] || permissions.hazard;
    });
  }, [user]);

  const clearCache = async () => {
    await clearAppCache();
    Alert.alert("Cache cleared", "Offline cached lists were cleared.");
  };

  const setupNotifications = async () => {
    setBusy(true);
    const result = await registerForPushNotificationsAsync();
    setBusy(false);
    Alert.alert(result.success ? "Notifications ready" : "Notifications not enabled", result.message || result.token || "Push notification setup completed.");
  };

  return (
    <Screen>
      <AppHeader title="UTPL Safety HSE" subtitle="Enterprise Settings" />

      <GlassCard strong>
        <View style={styles.profileRow}>
          <LinearGradient colors={gradients.teal} style={styles.avatar}>
            <Ionicons name="person" size={26} color={theme.colors.text} />
          </LinearGradient>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{user?.name || "User"}</Text>
            <Text style={styles.meta}>{user?.email || "-"}</Text>
            <Text style={styles.meta}>Role: {user?.role || "-"}</Text>
          </View>
          <StatusChip status="Active" compact />
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Access Control</Text>
        <Text style={styles.about}>Visible mobile modules follow the same role and permission model as the web sidebar.</Text>
        <View style={styles.permissionWrap}>
          {allowedPages.map((page) => (
            <View key={page} style={styles.permissionPill}>
              <Ionicons name="checkmark-circle" size={14} color={theme.colors.success} />
              <Text style={styles.permissionText}>{page}</Text>
            </View>
          ))}
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Security Settings</Text>
        <SettingTile icon="shield-checkmark-outline" title="JWT Session" text="Secure bearer-token API access with automatic 401 cleanup." />
        <SettingTile icon="cloud-lock-outline" title="Backend" text={API_BASE_URL} tone={theme.colors.accent2} />
        <SettingTile icon="phone-portrait-outline" title="App Version" text={Constants.expoConfig?.version || "1.0.0"} tone={theme.colors.purple} />
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Notification Settings</Text>
        <SettingTile icon="notifications-outline" title="Mobile Alerts" text="Enable approval, hazard, and training reminders when supported." />
        <TouchableOpacity style={styles.button} onPress={setupNotifications}>
          <Text style={styles.buttonText}>Enable Notifications</Text>
        </TouchableOpacity>
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Theme Settings</Text>
        <View style={styles.row}>
          <View>
            <Text style={styles.rowText}>Dark Enterprise Theme</Text>
            <Text style={styles.meta}>Default premium cockpit visual mode</Text>
          </View>
          <Switch value={darkMode} onValueChange={setDarkMode} thumbColor={theme.colors.accent} />
        </View>
      </GlassCard>

      <GlassCard>
        <Text style={styles.sectionTitle}>Utilities</Text>
        <TouchableOpacity style={styles.button} onPress={clearCache}>
          <Text style={styles.buttonText}>Clear Offline Cache</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logout} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </GlassCard>

      <Loader visible={busy} title="Please wait..." message="Preparing notifications..." />
    </Screen>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { color: theme.colors.text, fontSize: 22, fontWeight: "900" },
  meta: { color: theme.colors.muted, marginTop: 4, fontSize: 12 },
  about: { color: theme.colors.muted, lineHeight: 20 },
  permissionWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  permissionPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: "rgba(34,197,94,0.12)", borderWidth: 1, borderColor: "rgba(34,197,94,0.26)" },
  permissionText: { color: theme.colors.text, fontSize: 11, fontWeight: "800" },
  tile: { flexDirection: "row", gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  tileIcon: { width: 38, height: 38, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  tileCopy: { flex: 1, minWidth: 0 },
  tileTitle: { color: theme.colors.text, fontWeight: "900" },
  tileText: { color: theme.colors.muted, fontSize: 12, marginTop: 4, lineHeight: 17 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, gap: 12 },
  rowText: { color: theme.colors.text, fontWeight: "900" },
  button: { borderRadius: 16, padding: 14, marginTop: 10, backgroundColor: "rgba(34,211,238,0.16)", borderWidth: 1, borderColor: theme.colors.border },
  buttonText: { color: theme.colors.text, fontWeight: "900", textAlign: "center" },
  logout: { borderRadius: 16, padding: 14, marginTop: 10, backgroundColor: "rgba(251,113,133,0.18)", borderWidth: 1, borderColor: "rgba(251,113,133,0.38)" },
  logoutText: { color: theme.colors.text, fontWeight: "900", textAlign: "center" }
});

export default SettingsScreen;
