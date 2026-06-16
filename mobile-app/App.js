import React from "react";
import { LogBox } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { AuthProvider } from "./src/context/AuthContext";
import { NetworkProvider } from "./src/context/NetworkContext";
import AppNavigator from "./src/navigation/AppNavigator";
import OfflineBanner from "./src/components/OfflineBanner";
import { theme } from "./src/theme";

LogBox.ignoreLogs(["Require cycle:"]);

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: theme.colors.background,
    card: theme.colors.panel,
    text: theme.colors.text,
    border: theme.colors.border,
    primary: theme.colors.accent
  }
};

export default function App() {
  return (
    <SafeAreaProvider>
      <NetworkProvider>
        <AuthProvider>
          <NavigationContainer theme={navigationTheme}>
            <StatusBar style="light" />
            <OfflineBanner />
            <AppNavigator />
          </NavigationContainer>
        </AuthProvider>
      </NetworkProvider>
    </SafeAreaProvider>
  );
}
