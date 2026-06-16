import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import DashboardScreen from "../screens/DashboardScreen";
import HazardScreen from "../screens/HazardScreen";
import LoginScreen from "../screens/LoginScreen";
import ReportsScreen from "../screens/ReportsScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TrainingScreen from "../screens/TrainingScreen";
import UsersScreen from "../screens/UsersScreen";
import WorkApprovalScreen from "../screens/WorkApprovalScreen";
import { createPremiumTabOptions } from "../components/BottomTabs";
import { useAuth } from "../context/AuthContext";
import { canAccess } from "../utils/permissions";
import { theme } from "../theme";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const tabConfig = [
  { name: "Dashboard", component: DashboardScreen, permission: "dashboard", icon: "grid-outline" },
  { name: "Work", component: WorkApprovalScreen, permission: "work", icon: "clipboard-outline" },
  { name: "Hazard", component: HazardScreen, permission: "hazards", icon: "warning-outline" },
  { name: "Training", component: TrainingScreen, permission: "training", icon: "school-outline" },
  { name: "Users", component: UsersScreen, permission: "users", icon: "people-outline" },
  { name: "Reports", component: ReportsScreen, permission: "reports", icon: "analytics-outline" },
  { name: "Settings", component: SettingsScreen, permission: "settings", icon: "settings-outline" }
];

const BootScreen = () => (
  <View style={styles.boot}>
    <ActivityIndicator size="large" color={theme.colors.accent} />
    <Text style={styles.bootText}>Loading Safety HSE...</Text>
  </View>
);

const AccessDenied = () => (
  <View style={styles.boot}>
    <Ionicons name="lock-closed-outline" size={42} color={theme.colors.danger} />
    <Text style={styles.deniedTitle}>Access Denied</Text>
    <Text style={styles.bootText}>Your role does not have permission to access this module.</Text>
  </View>
);

const AppTabs = ({ user }) => {
  const allowedTabs = tabConfig.filter((item) => canAccess(user, item.permission));
  const tabs = allowedTabs.length ? allowedTabs : [tabConfig[0]];

  return (
    <Tab.Navigator
      screenOptions={createPremiumTabOptions(tabConfig)}
    >
      {tabs.map((item) => (
        <Tab.Screen key={item.name} name={item.name} component={item.component || AccessDenied} />
      ))}
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  const { user, booting } = useAuth();
  if (booting) return <BootScreen />;

  if (!user) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  return <AppTabs user={user} />;
};

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.background,
    padding: 24
  },
  bootText: {
    color: theme.colors.muted,
    marginTop: 12,
    textAlign: "center"
  },
  deniedTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 12
  },
  
});

export default AppNavigator;
