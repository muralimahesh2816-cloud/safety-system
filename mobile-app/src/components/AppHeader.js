import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import GlassCard from "./GlassCard";
import MomentumSafetySVG from "./MomentumSafetySVG";
import { useAuth } from "../context/AuthContext";
import { theme } from "../theme";

const AppHeader = ({ title = "UTPL Safety HSE", subtitle = "Safety Management System", right }) => {
  const { user } = useAuth();
  const displayName = user?.name || user?.email?.split("@")?.[0] || "Profile";

  return (
    <GlassCard style={styles.card} strong>
      <View style={styles.glow} />
      <View style={styles.row}>
        <View style={styles.logo}>
          <MomentumSafetySVG size={46} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>SASTHAN UDUPI TOLLWAY PVT LTD</Text>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={styles.rightSlot}>{right}</View> : null}
        <View style={styles.actions}>
          <TouchableOpacity activeOpacity={0.84}>
            <LinearGradient colors={["rgba(34,211,238,0.28)", "rgba(255,255,255,0.07)"]} style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={18} color={theme.colors.text} />
              <View style={styles.badge} />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.84} style={styles.profileTouch}>
            <LinearGradient colors={["rgba(45,212,191,0.28)", "rgba(255,255,255,0.07)"]} style={styles.profile}>
              <Ionicons name="person" size={14} color={theme.colors.text} />
              <Text style={styles.profileText} numberOfLines={1}>{displayName}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26
  },
  glow: {
    position: "absolute",
    top: -44,
    right: -38,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(34, 211, 238, 0.14)"
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  logo: {
    width: 58,
    height: 58,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.5)",
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 5
  },
  copy: {
    flex: 1,
    minWidth: 0
  },
  eyebrow: {
    color: theme.colors.muted,
    fontSize: 9,
    letterSpacing: 1.8,
    fontWeight: "800"
  },
  title: {
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.2
  },
  subtitle: {
    color: theme.colors.accent2,
    fontSize: 12,
    marginTop: 2
  },
  rightSlot: {
    marginLeft: 2
  },
  actions: {
    flexDirection: "row",
    gap: 8
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  badge: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: theme.colors.danger
  },
  profileTouch: {
    maxWidth: 92
  },
  profile: {
    minWidth: 72,
    height: 38,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: theme.colors.border
  },
  profileText: {
    color: theme.colors.text,
    fontSize: 10,
    fontWeight: "900",
    maxWidth: 54
  }
});

export default AppHeader;
