import React from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import GlassCard from "./GlassCard";
import { theme } from "../theme";

const Loader = ({ visible, title = "Please uploading...", message = "Please wait..." }) => (
  <Modal visible={Boolean(visible)} transparent animationType="fade">
    <View style={styles.overlay}>
      <GlassCard style={styles.card} strong>
        <ActivityIndicator color={theme.colors.accent} size="large" />
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
      </GlassCard>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(2, 6, 23, 0.76)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28
  },
  card: {
    width: "100%",
    maxWidth: 360
  },
  title: {
    color: theme.colors.text,
    fontSize: 19,
    fontWeight: "900",
    marginTop: 14,
    textAlign: "center"
  },
  message: {
    color: theme.colors.muted,
    fontSize: 13,
    marginTop: 8,
    textAlign: "center"
  }
});

export default Loader;
