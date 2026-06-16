import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AppHeader from "../components/AppHeader";
import FormField from "../components/FormField";
import GlassCard from "../components/GlassCard";
import Loader from "../components/Loader";
import { useAuth } from "../context/AuthContext";
import { gradients, theme } from "../theme";

const LoginScreen = () => {
  const { login, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async () => {
    if (!email || !password) {
      Alert.alert("Please fill required fields", "Email and password are required.");
      return;
    }
    setLoading(true);
    const result = await login({ email: email.trim(), password });
    setLoading(false);
    if (!result.success) Alert.alert("Login failed", result.message);
  };

  return (
    <LinearGradient colors={gradients.app} style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboard}
      >
        <View style={styles.heroGlow} />
        <AppHeader title="UTPL Safety HSE" subtitle="Mobile Operations Portal" />
        <GlassCard strong>
          <Text style={styles.title}>Secure Login</Text>
          <Text style={styles.subtitle}>Employee and supervisor access for daily site operations.</Text>

          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
            placeholder="Enter email"
            style={styles.field}
          />
          <View style={styles.passwordRow}>
            <FormField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              placeholder="Enter password"
              style={styles.passwordField}
            />
            <TouchableOpacity style={styles.eye} onPress={() => setShowPassword((prev) => !prev)}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={theme.colors.text} />
            </TouchableOpacity>
          </View>

          {authError ? <Text style={styles.error}>{authError}</Text> : null}

          <TouchableOpacity style={styles.button} onPress={onSubmit} disabled={loading}>
            <LinearGradient colors={gradients.teal} style={styles.buttonBg}>
              <Text style={styles.buttonText}>{loading ? "Logging in..." : "Login"}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.footnote}>No default credentials are displayed in production mobile UI.</Text>
        </GlassCard>
      </KeyboardAvoidingView>
      <Loader visible={loading} title="Please wait..." message="Signing in securely..." />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: theme.spacing.screen,
    justifyContent: "center"
  },
  keyboard: {
    width: "100%"
  },
  heroGlow: {
    position: "absolute",
    top: -80,
    right: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(34,211,238,0.22)"
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    color: theme.colors.muted,
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 20
  },
  field: {
    marginTop: 12
  },
  passwordRow: {
    position: "relative",
    marginTop: 12
  },
  passwordField: {
    paddingRight: 48
  },
  eye: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center"
  },
  error: {
    color: theme.colors.danger,
    marginTop: 12,
    fontWeight: "700"
  },
  button: {
    marginTop: 18,
    borderRadius: 18,
    overflow: "hidden"
  },
  buttonBg: {
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center"
  },
  buttonText: {
    color: theme.colors.text,
    fontWeight: "900",
    fontSize: 16
  },
  footnote: {
    color: theme.colors.dim,
    marginTop: 14,
    fontSize: 11,
    textAlign: "center"
  }
});

export default LoginScreen;
