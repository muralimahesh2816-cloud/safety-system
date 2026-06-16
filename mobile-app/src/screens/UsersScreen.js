import React, { useEffect, useMemo, useState } from "react";
import { Image, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../components/AppHeader";
import EmptyState from "../components/EmptyState";
import GlassCard from "../components/GlassCard";
import Screen from "../components/Screen";
import StatusChip from "../components/StatusChip";
import { parseApiError } from "../api/client";
import { userService } from "../api/services";
import { getMediaUrl } from "../utils/media";
import { theme } from "../theme";

const normalizeUsers = (payload) => payload?.users || payload?.records || payload?.data || (Array.isArray(payload) ? payload : []);

const UsersScreen = () => {
  const [users, setUsers] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setRefreshing(true);
    setError("");
    try {
      const response = await userService.list();
      setUsers(normalizeUsers(response));
    } catch (loadError) {
      setError(parseApiError(loadError, "Unable to load users."));
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const active = users.filter((user) => user.isActive !== false && user.status !== "Blocked").length;
    const admins = users.filter((user) => /admin/i.test(user.role || "")).length;
    return { total: users.length, active, admins };
  }, [users]);

  return (
    <Screen scroll={false}>
      <AppHeader title="UTPL Safety HSE" subtitle="User Management" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl tintColor={theme.colors.accent} refreshing={refreshing} onRefresh={load} />}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.grid}>
          {[
            ["Total Users", stats.total, "people-outline"],
            ["Active Users", stats.active, "pulse-outline"],
            ["Admins", stats.admins, "shield-checkmark-outline"]
          ].map(([label, value, icon]) => (
            <GlassCard key={label} style={styles.kpi}>
              <Ionicons name={icon} size={20} color={theme.colors.accent} />
              <Text style={styles.kpiValue}>{value}</Text>
              <Text style={styles.kpiLabel}>{label}</Text>
            </GlassCard>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <GlassCard>
          <Text style={styles.sectionTitle}>Enterprise Users</Text>
          {users.length ? (
            users.map((item) => {
              const image = getMediaUrl(item.profilePhoto || item.profileImage || item.avatar || item.photo);
              const status = item.isActive === false || item.status === "Blocked" ? "Blocked" : "Active";
              return (
                <View key={item._id || item.id || item.email} style={styles.userRow}>
                  <View style={styles.avatar}>
                    {image ? <Image source={{ uri: image }} style={styles.avatarImage} resizeMode="cover" /> : <Ionicons name="person" size={20} color={theme.colors.text} />}
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.name}>{item.name || item.email || "User"}</Text>
                    <Text style={styles.meta}>{item.email || "-"}</Text>
                    <Text style={styles.role}>{item.role || "User"}</Text>
                  </View>
                  <StatusChip status={status} compact />
                </View>
              );
            })
          ) : (
            <EmptyState title="No users found" message="Users from the backend will appear here." />
          )}
        </GlassCard>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  scroll: { paddingBottom: 132, gap: 16 },
  grid: { flexDirection: "row", gap: 10 },
  kpi: { flex: 1, minHeight: 108 },
  kpiValue: { color: theme.colors.text, fontSize: 25, fontWeight: "900", marginTop: 8 },
  kpiLabel: { color: theme.colors.muted, fontSize: 10, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.8 },
  error: { color: theme.colors.warning },
  sectionTitle: { color: theme.colors.text, fontSize: 18, fontWeight: "900", marginBottom: 10 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" },
  avatar: { width: 48, height: 48, borderRadius: 18, alignItems: "center", justifyContent: "center", overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: theme.colors.border },
  avatarImage: { width: "100%", height: "100%" },
  copy: { flex: 1, minWidth: 0 },
  name: { color: theme.colors.text, fontWeight: "900" },
  meta: { color: theme.colors.muted, fontSize: 11, marginTop: 3 },
  role: { color: theme.colors.accent2, fontSize: 11, fontWeight: "800", marginTop: 3 }
});

export default UsersScreen;
