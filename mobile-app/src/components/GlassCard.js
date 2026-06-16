import React from "react";
import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { theme } from "../theme";

const GlassCard = ({ children, style, strong = false }) => (
  <View style={[styles.wrapper, style]}>
    <BlurView intensity={strong ? 34 : 22} tint="dark" style={StyleSheet.absoluteFill} />
    <LinearGradient
      colors={["rgba(255,255,255,0.10)", "rgba(255,255,255,0.035)"]}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.content}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    overflow: "hidden",
    borderRadius: theme.spacing.radius,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
    ...theme.shadow
  },
  content: {
    position: "relative",
    padding: 16
  }
});

export default GlassCard;
