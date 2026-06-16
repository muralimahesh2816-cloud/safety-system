import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

export const createPremiumTabOptions = (tabConfig) => ({ route }) => {
  const item = tabConfig.find((entry) => entry.name === route.name);
  return {
    headerShown: false,
    tabBarActiveTintColor: theme.colors.text,
    tabBarInactiveTintColor: theme.colors.muted,
    tabBarLabelStyle: styles.label,
    tabBarStyle: styles.tabBar,
    tabBarBackground: () => (
      <View style={StyleSheet.absoluteFill}>
        <BlurView intensity={32} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient colors={["rgba(15,23,42,0.95)", "rgba(2,6,23,0.88)"]} style={StyleSheet.absoluteFill} />
      </View>
    ),
    tabBarIcon: ({ color, focused }) => (
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Ionicons name={item?.icon || "ellipse-outline"} size={focused ? 21 : 19} color={focused ? theme.colors.accent : color} />
      </View>
    )
  };
};

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    height: 74,
    borderRadius: 28,
    paddingBottom: 8,
    paddingTop: 8,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: "hidden",
    shadowColor: theme.colors.accent,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12
  },
  label: {
    fontSize: 10,
    fontWeight: "900",
    marginTop: 1
  },
  iconWrap: {
    width: 30,
    height: 27,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  iconWrapActive: {
    backgroundColor: "rgba(34,211,238,0.16)",
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.32)"
  }
});
