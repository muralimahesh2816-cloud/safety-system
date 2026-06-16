import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

const EmptyState = ({ title = "No records found", message = "Pull to refresh or try again later." }) => (
  <View style={styles.box}>
    <Ionicons name="file-tray-outline" size={28} color={theme.colors.muted} />
    <Text style={styles.title}>{title}</Text>
    <Text style={styles.message}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 22,
    padding: 22,
    alignItems: "center",
    backgroundColor: theme.colors.cardSoft
  },
  title: {
    marginTop: 8,
    color: theme.colors.text,
    fontWeight: "800"
  },
  message: {
    marginTop: 4,
    color: theme.colors.muted,
    fontSize: 12,
    textAlign: "center"
  }
});

export default EmptyState;
