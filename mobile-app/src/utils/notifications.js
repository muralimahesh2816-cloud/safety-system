import Constants from "expo-constants";
import { Platform } from "react-native";
import { notificationService } from "../api/services";

let notificationsModule = null;

const isExpoGo = Constants.appOwnership === "expo";

const loadNotificationsModule = async () => {
  if (notificationsModule) return notificationsModule;

  const Notifications = await import("expo-notifications");
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true
    })
  });
  notificationsModule = Notifications;
  return notificationsModule;
};

export const registerForPushNotificationsAsync = async () => {
  try {
    if (isExpoGo && Platform.OS === "android") {
      return {
        success: false,
        message: "Android push notifications need a development build on SDK 53+. Expo Go can still run the app."
      };
    }

    const Notifications = await loadNotificationsModule();

    if (!Constants.isDevice) {
      return { success: false, message: "Push notifications need a physical device." };
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    if (status !== "granted") {
      return { success: false, message: "Notification permission not granted." };
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Safety HSE",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#22D3EE"
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    const tokenResult = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenResult.data;
    await notificationService.savePushToken(token);
    return { success: true, token };
  } catch (error) {
    return { success: false, message: error.message };
  }
};
