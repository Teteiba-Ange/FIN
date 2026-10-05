/**
 * lib/storage
 * ─────────────────────────────────────────────────────────────
 * AsyncStorage wrappers for data that lives only on the device:
 * symptom logs, cycle entries, mood entries, notification prefs.
 *
 * Community posts used to live here too, backed by hardcoded seed
 * data. That made the "community" device-local — nobody could see
 * anyone else's posts. The forum now goes through the API instead,
 * and the local copy has been removed.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Keys ─────────────────────────────────────────────────────
// The `pmos_` prefix predates the PCOS naming fix. It is kept as-is
// deliberately: these keys address data already on users' devices,
// and renaming them would silently discard it.
const KEYS = {
  SYMPTOM_LOGS: "pmos_symptom_logs",
  CYCLE_ENTRIES: "pmos_cycle_entries",
  MOOD_ENTRIES: "pmos_mood_entries",
  NOTIFICATION_SETTINGS: "pmos_notification_settings",
  WATER: "pcos_water_intake",
  BREATHING_SESSIONS: "pcos_breathing_sessions",
  DAILY_CHECK_INS: "pcos_daily_check_ins",
};

// ─── Generic helpers ──────────────────────────────────────────
const store = async (key: string, value: unknown): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

const load = async <T>(key: string): Promise<T | null> => {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
};

// ─── Symptom Logs ─────────────────────────────────────────────
export type SymptomLog = {
  id: string;
  symptom: string;
  severity: number;
  notes: string;
  date: string;
};

export const getSymptomLogs = async (): Promise<SymptomLog[]> =>
  (await load<SymptomLog[]>(KEYS.SYMPTOM_LOGS)) ?? [];

export const saveSymptomLogs = async (logs: SymptomLog[]): Promise<void> =>
  store(KEYS.SYMPTOM_LOGS, logs);

// ─── Cycle Entries ────────────────────────────────────────────
export type CycleEntry = {
  id: string;
  startDate: string;
  endDate: string;
  flow: "Light" | "Medium" | "Heavy";
  notes: string;
};

export const getCycleEntries = async (): Promise<CycleEntry[]> =>
  (await load<CycleEntry[]>(KEYS.CYCLE_ENTRIES)) ?? [];

export const saveCycleEntries = async (entries: CycleEntry[]): Promise<void> =>
  store(KEYS.CYCLE_ENTRIES, entries);

// ─── Mood Entries ─────────────────────────────────────────────
export type MoodEntry = {
  id: string;
  mood: number;
  notes: string;
  date: string;
};

export const getMoodEntries = async (): Promise<MoodEntry[]> =>
  (await load<MoodEntry[]>(KEYS.MOOD_ENTRIES)) ?? [];

export const saveMoodEntries = async (entries: MoodEntry[]): Promise<void> =>
  store(KEYS.MOOD_ENTRIES, entries);

// ─── Water intake ─────────────────────────────────────────────
// Stored against a date so the count resets naturally at midnight instead of
// on app restart. Previously this lived in component state, which meant the
// counter silently reset every time the user left the home screen.

const today = () => new Date().toISOString().slice(0, 10);

export const getWaterToday = async (): Promise<number> => {
  const record = await load<{ date: string; glasses: number }>(KEYS.WATER);
  return record?.date === today() ? record.glasses : 0;
};

export const saveWaterToday = async (glasses: number): Promise<void> =>
  store(KEYS.WATER, { date: today(), glasses });

// ─── Daily check-in streak ───────────────────────────────────────────────────
// Opening Home counts as a check-in once per local calendar day. Dates are
// retained rather than a mutable counter, so missed days and clock changes do
// not leave an inflated streak behind.
const localDateKey = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export type CheckInSummary = { streak: number; recent: boolean[] };

export const recordDailyCheckIn = async (): Promise<CheckInSummary> => {
  const stored = (await load<string[]>(KEYS.DAILY_CHECK_INS)) ?? [];
  const dates = Array.from(new Set([...stored, localDateKey()])).sort().slice(-365);
  await store(KEYS.DAILY_CHECK_INS, dates);

  const dateSet = new Set(dates);
  let streak = 0;
  const cursor = new Date();
  while (dateSet.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const recent = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    return dateSet.has(localDateKey(day));
  });

  return { streak, recent };
};

// ─── Breathing sessions ───────────────────────────────────────
// The mindfulness history screen previously rendered three hardcoded sessions
// ("Box Breathing · Today", "4-7-8 Relaxation · Yesterday", …) held in
// component state, so a user who had never opened a session still saw three
// they had supposedly completed. Sessions are now recorded when one finishes.

export type BreathingSession = {
  id: string;
  exercise: string;
  /** Cycles actually completed, not the number the exercise was set to run. */
  cycles: number;
  /** Seconds of breathing, derived from the phase timings actually used. */
  seconds: number;
  date: string;
};

export const getBreathingSessions = async (): Promise<BreathingSession[]> =>
  (await load<BreathingSession[]>(KEYS.BREATHING_SESSIONS)) ?? [];

export const addBreathingSession = async (
  session: BreathingSession
): Promise<BreathingSession[]> => {
  const existing = await getBreathingSessions();
  // Capped so a heavy user's history can't grow without bound on device.
  const next = [session, ...existing].slice(0, 100);
  await store(KEYS.BREATHING_SESSIONS, next);
  return next;
};

// ─── Notification Settings ────────────────────────────────────
/**
 * `communityActivity` is gone. It required the server to send a push, and
 * nothing in the backend can — so it was a switch that could never do
 * anything. It returns when there is something behind it. (C-01 in PLAN.md.)
 *
 * `symptomTime` is new: the reminder used to advertise a fixed 8:00 AM that
 * was never scheduled at all. It is now real, and the user picks the hour.
 */
export type NotificationSettings = {
  symptomReminder: boolean;
  /** 24-hour local time for the daily symptom prompt. */
  symptomTime: { hour: number; minute: number };
  cycleReminder: boolean;
  wellnessTips: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  symptomReminder: true,
  // Evening, because the prompt asks how the day has been.
  symptomTime: { hour: 20, minute: 0 },
  cycleReminder: true,
  wellnessTips: false,
};

export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  const stored = await load<Partial<NotificationSettings>>(KEYS.NOTIFICATION_SETTINGS);
  // Merged over the defaults so settings saved before `symptomTime` existed
  // don't come back with it undefined and crash the scheduler.
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...stored,
    symptomTime: {
      ...DEFAULT_NOTIFICATION_SETTINGS.symptomTime,
      ...(stored?.symptomTime ?? {}),
    },
  };
};

export const saveNotificationSettings = async (
  settings: NotificationSettings
): Promise<void> => store(KEYS.NOTIFICATION_SETTINGS, settings);
