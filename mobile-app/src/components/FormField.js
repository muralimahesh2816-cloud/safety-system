import React from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "../theme";

const FormField = ({ label, style, ...props }) => (
  <View style={style}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TextInput
      placeholderTextColor={theme.colors.dim}
      style={[styles.input, props.multiline && styles.multiline]}
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  label: {
    color: theme.colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    color: theme.colors.text,
    paddingHorizontal: 14,
    backgroundColor: "rgba(15, 23, 42, 0.72)"
  },
  multiline: {
    minHeight: 92,
    textAlignVertical: "top",
    paddingTop: 12
  }
});

export default FormField;
