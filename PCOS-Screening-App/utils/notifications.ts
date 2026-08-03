// utils/notifications.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import apiService from "../context/apiService";

// ── FIX 1: SDK 53 removed shouldSetBadge from setNotificationHandler ─────────
// The entire handleNotification config shape changed — use the new format below.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,   // ← must be false in SDK 53; badge is managed separately
    priority: Notifications.AndroidNotificationPriority.HIGH,
  }),
});

/**
 * Call once after login/signup.
 * Asks for permission → gets Expo push token → saves to backend.
 *
 * NOTE: Remote push notifications (getExpoPushTokenAsync) require a
 * Development Build — they do NOT work in Expo Go from SDK 53 onwards.
 * Run:  npx expo run:android   OR   npx expo run:ios
 */
export const registerForPushNotifications = async (): Promise<string | null> => {
  if (!Device.isDevice) {
    console.log("[PUSH] Real device required — skipping in simulator");
    return null;
  }

  // Check / request permission
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

  // Android needs a named notification channel
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("pmos-reminders", {
      name:             "PMOS Reminders",
      importance:       Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor:       "#1f7a7a",
      sound:            "default",
    });
  }

  // ── FIX 2: getExpoPushTokenAsync cannot receive undefined ─────────────────
  // Must always pass an object. If no projectId, fall back to local device token.
  let token: string | null = null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

    if (projectId) {
      // Remote push token — works only in a Development Build, not Expo Go
      const result = await Notifications.getExpoPushTokenAsync({ projectId });
      token = result.data;
    } else {
      // Local device token — works in Expo Go for local/testing notifications
      const result = await Notifications.getDevicePushTokenAsync();
      token = result.data as string;
      console.log("[PUSH] No projectId found — using device token (local only)");
    }
  } catch (err) {
    console.warn(
      "[PUSH] Could not get push token. " +
      "If you are using Expo Go, remote push notifications require a Development Build. " +
      "Run: npx expo run:android",
      err
    );
    return null;
  }

  if (!token) return null;
  console.log("[PUSH] Token obtained:", token);

  // ── FIX 3: savePushToken must exist on apiService ─────────────────────────
  // See apiService addition below. Wrapped so it never crashes the auth flow.
  try {
    await apiService.savePushToken(token);
    console.log("[PUSH] Token saved to backend ✅");
  } catch (err) {
    console.warn("[PUSH] Could not save token to backend (non-fatal):", err);
  }

  return token;
};

// ── Screen route map ──────────────────────────────────────────────────────────
const SCREEN_MAP: Record<string, string> = {
  "symptom-log":      "/(drawer)/symptom-log",
  "cycle-tracker":    "/(drawer)/cycle-tracker",
  "wellness-library": "/(drawer)/wellness-library",
  "community-feed":   "/(drawer)/community-feed",
  "dashboard":        "/(drawer)/drawer",
  "profile":          "/(drawer)/profile",
};

/**
 * Attach notification listeners for the app lifetime.
 * Returns a cleanup function to use in useEffect.
 *
 * Usage in app/_layout.tsx:
 *   useEffect(() => {
 *     const cleanup = useNotificationListeners();
 *     return cleanup;
 *   }, []);
 */
export const useNotificationListeners = () => {
  // Fires when notification arrives while app is open
  const receivedListener = Notifications.addNotificationReceivedListener(
    (notification) => {
      console.log("[PUSH] Received:", notification.request.content.title);
    }
  );

  // Fires when user taps the notification banner
  const responseListener = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const screen = response.notification.request.content.data?.screen as string | undefined;
      console.log("[PUSH] Tapped — navigating to:", screen);

      if (screen) {
        const route = SCREEN_MAP[screen] ?? screen;
        try {
          router.push(route as any);
        } catch (err) {
          console.warn("[PUSH] Navigation failed:", err);
        }
      }
    }
  );

  return () => {
    receivedListener.remove();
    responseListener.remove();
  };
};