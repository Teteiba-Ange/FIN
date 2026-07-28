// utils/notifications.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import apiService from "../context/apiService";

// ── How notifications appear when the app is open ────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

/**
 * Call once after login/signup.
 * Asks for permission → gets Expo push token → saves to backend.
 * Safe to call multiple times (idempotent).
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log("[PUSH] Real device required — skipping in simulator");
    return null;
  }

  // Check existing permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[PUSH] User denied notification permission");
    return null;
  }

  // Android notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("pmos-reminders", {
      name:             "PMOS Reminders",
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       "#1f7a7a",
      sound:            "default",
    });
  }

  // Get Expo push token
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: token } = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  console.log("[PUSH] Token:", token);

  // Save to backend — wrapped so it never crashes the auth flow
  try {
    await apiService.savePushToken(token);
    console.log("[PUSH] Token saved to backend");
  } catch (err) {
    console.warn("[PUSH] Could not save token to backend:", err);
  }

  return token;
};

/**
 * Screen map — maps the data.screen value from notifications
 * to the actual Expo Router path.
 */
const SCREEN_MAP: Record<string, string> = {
  "symptom-log":     "/(drawer)/symptom-log",
  "cycle-tracker":   "/(drawer)/cycle-tracker",
  "wellness-library":"/(drawer)/wellness-library",
  "community-feed":  "/(drawer)/community-feed",
  "dashboard":       "/(drawer)/drawer",
  "profile":         "/(drawer)/profile",
};

/**
 * Attach notification listeners for the app lifetime.
 * Returns a cleanup function — call it in a useEffect return.
 *
 * Usage in _layout.tsx:
 *   useEffect(() => {
 *     const cleanup = useNotificationListeners();
 *     return cleanup;
 *   }, []);
 */
export const useNotificationListeners = () => {
  // Fired when a notification arrives while the app is open
  const receivedListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log("[PUSH] Received while app open:", notification.request.content.title);
    }
  );

  // Fired when the user taps the notification
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      console.log("[PUSH] User tapped notification, screen:", screen);

      if (screen) {
        const route = SCREEN_MAP[screen] || screen;
        try {
          router.push(route as any);
        } catch (err) {
          console.warn("[PUSH] Navigation failed:", err);
        }
      }
    }
  );

  // Return cleanup function
  return () => {
    receivedListener.remove();
    responseListener.remove();
  };
};