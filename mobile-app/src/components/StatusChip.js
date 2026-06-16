import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../theme";

const toneMap = {
  Pending: theme.colors.warning,
  Approved: theme.colors.accent2,
  Rejected: theme.colors.danger,
  Completed: theme.colors.success,
  Open: theme.colors.warning,
  Closed: theme.colors.success,
  Active: theme.colors.success,
  Blocked: theme.colors.danger
};

const StatusChip = ({ status = "Pending", compact = false }) => {
  const color = toneMap[status] || theme.colors.accent;
  return (
    <View style={[styles.chip, { borderColor: `${color}80`, backgroundColor: `${color}22` }, compact && styles.compact]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{status}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 5
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  text: {
    fontSize: 11,
    fontWeight: "900"
  }
});

export default StatusChip;
