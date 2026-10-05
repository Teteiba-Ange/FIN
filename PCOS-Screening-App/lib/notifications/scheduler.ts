/**
 * lib/notifications/scheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * Local notification scheduling. This is the implementation behind the
 * reminder switches (C-01 in PLAN.md).
 *
 * Until now the settings screen promised "Daily reminder at 8:00 AM to log
 * your symptoms" and `scheduleNotificationAsync` was called nowhere in the
 * codebase. The toggles wrote a boolean that nothing read. Reminders are the
 * mechanism by which a tracking app actually gets used, so the entire
 * retention loop was a promise with no implementation behind it.
 *
 * Everything here is *local* — scheduled by the OS on the device. That matters:
 *
 *   - it needs no server, so it works for a project with no push infrastructure
 *   - it works offline
 *   - it works in Expo Go, unlike remote push, which Expo Go dropped on
 *     Android in SDK 53
 *
 * Community reply alerts are deliberately absent. Those genuinely require the
 * server to send a push, and nothing in the backend can do that yet — so
 * rather than offer a switch that quietly does nothing, the option is gone
 * until there is something behind it.
 */

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getCycleEntries } from "@/lib/logs";
import { analyseCycles, DAY_MS } from "@/lib/cycle/analysis";

// ─── Identity ────────────────────────────────────────────────────────────────
// Each reminder carries a stable key in its content data, so it can be found
// and cancelled without tracking identifiers separately. Cancelling by
// scheduled-notification id would break the moment the OS reschedules one.

export type ReminderKey = "symptom" | "cycle" | "wellness";

const DATA_KEY = "reminderKey";

export const CHANNEL_ID = "pcos-reminders";

/** Where a tapped notification should land, read by the response listener. */
const ROUTE: Record<ReminderKey, string> = {
  symptom: "symptom-log",
  cycle: "cycle-tracker",
  wellness: "wellness-library",
};

// ─── Setup ───────────────────────────────────────────────────────────────────

/**
 * Ensures the Android channel exists. Android silently drops notifications
 * posted to a channel that was never created, which is a failure with no
 * error attached to it.
 *
 * The previous channel id was `pmos-reminders`. A channel's user-visible
 * settings are frozen once created, so this registers a correctly-named one
 * and deletes the old rather than leaving both in the system settings list.
 */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Reminders",
    description: "Symptom logging, cycle predictions and reading suggestions.",
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 150, 200],
    lightColor: "#1f7a7a",
    sound: "default",
  });

  await Notifications.deleteNotificationChannelAsync("pmos-reminders").catch(() => {
    /* Never existed on this device. */
  });
}

/**
 * Requests permission if it hasn't been decided yet.
 *
 * Returns whether we can post. Deliberately does not re-prompt when the user
 * has already refused — the OS ignores repeat requests anyway, and the caller
 * needs to know so it can explain rather than appear broken.
 */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    await ensureChannel();
    return true;
  }
  if (!current.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  if (requested.granted) await ensureChannel();
  return requested.granted;
}

export async function permissionStatus(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
  return { granted, canAskAgain };
}

// ─── Cancelling ──────────────────────────────────────────────────────────────

async function cancel(key: ReminderKey): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.content.data?.[DATA_KEY] === key)
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ─── Symptom reminder ────────────────────────────────────────────────────────

export type TimeOfDay = { hour: number; minute: number };

/**
 * Evening rather than the 8:00 AM the old copy advertised. The prompt asks how
 * the day has been, which is not a question anyone can answer at breakfast.
 */
export const DEFAULT_SYMPTOM_TIME: TimeOfDay = { hour: 20, minute: 0 };

export async function scheduleSymptomReminder(time: TimeOfDay): Promise<void> {
  await cancel("symptom");
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "How has today been?",
      body: "Logging takes a few seconds. A few weeks of it is what makes patterns visible.",
      data: { [DATA_KEY]: "symptom", screen: ROUTE.symptom },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: time.hour,
      minute: time.minute,
      channelId: CHANNEL_ID,
    },
  });
}

// ─── Cycle reminder ──────────────────────────────────────────────────────────

/** Days before the predicted date to give a heads-up. */
const HEADS_UP_DAYS = 2;

/**
 * The prediction is not computed here.
 *
 * This module previously carried its own copy of the gap filter and averaging,
 * duplicating what the cycle tracker screen did — two copies of a rule being
 * one edit away from a notification claiming a date the screen contradicts.
 * Both now read `lib/cycle/analysis`, so they cannot disagree.
 */
async function predictNextPeriod(): Promise<Date | null> {
  const entries = await getCycleEntries();
  return analyseCycles(entries).nextExpected;
}

/**
 * Schedules a heads-up before the next predicted period.
 *
 * Re-run whenever cycle data changes — the prediction moves with every new
 * entry, and a reminder scheduled against stale history is worse than none.
 * Returns the date it scheduled for, or null when there was nothing to
 * predict from.
 */
export async function scheduleCycleReminder(): Promise<Date | null> {
  await cancel("cycle");

  const predicted = await predictNextPeriod();
  if (!predicted) return null;

  const fireAt = new Date(predicted.getTime() - HEADS_UP_DAYS * DAY_MS);
  fireAt.setHours(9, 0, 0, 0);

  // A prediction already in the past means the period is late. Nagging about
  // a date that has been and gone is not useful, so nothing is scheduled —
  // the tracker screen surfaces lateness where there is room to explain it.
  if (fireAt.getTime() <= Date.now()) return null;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Your period is due soon",
      body: `Based on your logged cycles, around ${predicted.toLocaleDateString(undefined, {
        day: "numeric",
        month: "long",
      })}. An estimate, not a certainty.`,
      data: { [DATA_KEY]: "cycle", screen: ROUTE.cycle },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: fireAt,
      channelId: CHANNEL_ID,
    },
  });

  return predicted;
}

// ─── Weekly reading ──────────────────────────────────────────────────────────

export async function scheduleWellnessTip(): Promise<void> {
  await cancel("wellness");
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Something to read",
      body: "A few minutes on how PCOS works, and what tends to help.",
      data: { [DATA_KEY]: "wellness", screen: ROUTE.wellness },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      // 1 = Sunday in the expo-notifications weekday numbering.
      weekday: 1,
      hour: 10,
      minute: 0,
      channelId: CHANNEL_ID,
    },
  });
}

// ─── Applying preferences ────────────────────────────────────────────────────

export type ReminderPreferences = {
  symptomReminder: boolean;
  symptomTime: TimeOfDay;
  cycleReminder: boolean;
  wellnessTips: boolean;
};

/**
 * Brings the OS's scheduled notifications in line with the user's preferences.
 *
 * Idempotent — each scheduler cancels its own key before re-adding, so calling
 * this repeatedly cannot accumulate duplicates. Call it after any preference
 * change and after cycle data changes.
 *
 * Returns what was actually scheduled, so the UI can describe reality rather
 * than restating the request. The cycle reminder in particular may be enabled
 * and still schedule nothing when there isn't enough history.
 */
export async function applyReminders(prefs: ReminderPreferences): Promise<{
  granted: boolean;
  cycleScheduledFor: Date | null;
}> {
  const wantsAny =
    prefs.symptomReminder || prefs.cycleReminder || prefs.wellnessTips;

  if (!wantsAny) {
    await cancelAll();
    return { granted: true, cycleScheduledFor: null };
  }

  const granted = await ensurePermission();
  if (!granted) {
    await cancelAll();
    return { granted: false, cycleScheduledFor: null };
  }

  if (prefs.symptomReminder) await scheduleSymptomReminder(prefs.symptomTime);
  else await cancel("symptom");

  let cycleScheduledFor: Date | null = null;
  if (prefs.cycleReminder) cycleScheduledFor = await scheduleCycleReminder();
  else await cancel("cycle");

  if (prefs.wellnessTips) await scheduleWellnessTip();
  else await cancel("wellness");

  return { granted, cycleScheduledFor };
}

/** Debug helper — what the OS currently holds. */
export async function listScheduled(): Promise<
  { key: string; title: string; trigger: unknown }[]
> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.map((n) => ({
    key: String(n.content.data?.[DATA_KEY] ?? "unknown"),
    title: n.content.title ?? "",
    trigger: n.trigger,
  }));
}
