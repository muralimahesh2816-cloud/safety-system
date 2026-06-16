import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";
import { theme } from "../theme";

const ChipSelect = ({ options = [], value, onChange }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {options.map((option) => {
      const active = value === option;
      return (
        <TouchableOpacity
          key={option}
          onPress={() => onChange(option)}
          style={[styles.chip, active && styles.active]}
        >
          <Text style={[styles.text, active && styles.activeText]}>{option}</Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: {
    gap: 8,
    paddingVertical: 4
  },
  chip: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  active: {
    borderColor: theme.colors.accent,
    backgroundColor: "rgba(34, 211, 238, 0.18)"
  },
  text: {
    color: theme.colors.muted,
    fontWeight: "700",
    fontSize: 12
  },
  activeText: {
    color: theme.colors.text
  }
});

export default ChipSelect;
