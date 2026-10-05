// lib/notifications/index.ts
/**
 * Push-token registration and notification listeners.
 *
 * Local *scheduling* — the reminders that actually work without a server —
 * lives in `./scheduler`, and is re-exported at the bottom of this file.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { router } from "expo-router";
import { apiService } from "@/lib/api";
import { ensureChannel } from "./scheduler";

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

  // One channel definition, shared with the local scheduler. This previously
  // created a second channel ("pmos-reminders") with different settings, so
  // the user saw two entries in the system notification list for one app.
  await ensureChannel();

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
// Route-group segments like (tabs) and (menu) are organisational, not part of
// the URL, so they are omitted here — a link stays valid if a group is renamed.
const SCREEN_MAP: Record<string, string> = {
  "symptom-log":      "/symptom-log",
  "cycle-tracker":    "/cycle-tracker",
  "wellness-library": "/wellness-library",
  "community-feed":   "/forum",
  "dashboard":        "/menu",
  "profile":          "/profile",
};

/**
 * Attach notification listeners for the app lifetime, returning a cleanup.
 *
 * Deliberately NOT named `use…` — it calls no React hooks, and the prefix
 * made it look like one, which trips the rules-of-hooks lint and invites
 * callers to use it incorrectly.
 *
 *   useEffect(() => registerNotificationListeners(), []);
 */
export const registerNotificationListeners = () => {
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

// Local scheduling — the reminders that don't need a server. See ./scheduler.
export {
  applyReminders,
  ensurePermission,
  permissionStatus,
  scheduleSymptomReminder,
  scheduleCycleReminder,
  scheduleWellnessTip,
  cancelAll as cancelAllReminders,
  listScheduled,
  DEFAULT_SYMPTOM_TIME,
  CHANNEL_ID,
  type ReminderKey,
  type ReminderPreferences,
  type TimeOfDay,
} from "./scheduler";