/**
 * utils/storage.ts
 * ─────────────────────────────────────────────────────────────
 * Centralised AsyncStorage wrapper for all local data.
 * Place this file at:  utils/storage.ts  (project root level)
 *
 * This fixes the 3 import errors in community-feed.tsx and
 * powers: symptom-log, cycle-tracker, mental-wellbeing,
 *         notification-settings, create-post, moderation.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Keys ─────────────────────────────────────────────────────
const KEYS = {
  COMMUNITY_POSTS:       "pmos_community_posts",
  SYMPTOM_LOGS:          "pmos_symptom_logs",
  CYCLE_ENTRIES:         "pmos_cycle_entries",
  MOOD_ENTRIES:          "pmos_mood_entries",
  NOTIFICATION_SETTINGS: "pmos_notification_settings",
};

// ─── Generic helpers ──────────────────────────────────────────
const store = async (key: string, value: unknown): Promise<void> => {
  await AsyncStorage.setItem(key, JSON.stringify(value));
};

const load = async <T>(key: string): Promise<T | null> => {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
};

// ─── Community Posts ──────────────────────────────────────────
export type CommunityPost = {
  id: string;
  userId: string;
  userName: string;
  title: string;
  content: string;
  timestamp: number;
  likes: number;
  comments: CommunityComment[];
  reported: boolean;
  approved: boolean;
};

export type CommunityComment = {
  id: string;
  userName: string;
  text: string;
  timestamp: number;
};

const SEED_POSTS: CommunityPost[] = [
  {
    id: "seed-1",
    userId: "seed",
    userName: "Abena M.",
    title: "Newly diagnosed — feeling overwhelmed",
    content:
      "Just got diagnosed with PMOS and I don't know where to start. Has anyone else felt this way at first? Any advice is welcome 🙏",
    timestamp: Date.now() - 86400000 * 5,
    likes: 12,
    comments: [
      { id: "c1", userName: "Efua B.", text: "You are not alone! It gets easier. Start small — just track your symptoms for now.", timestamp: Date.now() - 86400000 * 4 },
      { id: "c2", userName: "Anonymous", text: "Same here. One day at a time 💕", timestamp: Date.now() - 86400000 * 3 },
    ],
    reported: false,
    approved: true,
  },
  {
    id: "seed-2",
    userId: "seed",
    userName: "Ama O.",
    title: "Low-GI diet changed everything for me",
    content:
      "Three months on a low-GI diet and my cycles are finally regular. Brown rice, beans, lots of veggies. Anyone else tried this?",
    timestamp: Date.now() - 86400000 * 3,
    likes: 24,
    comments: [
      { id: "c3", userName: "Serwaa A.", text: "Yes! Cutting white rice made a huge difference for me too.", timestamp: Date.now() - 86400000 * 2 },
    ],
    reported: false,
    approved: true,
  },
  {
    id: "seed-3",
    userId: "seed",
    userName: "Anonymous",
    title: "Inositol supplement update",
    content:
      "6 weeks on myo-inositol + D-chiro-inositol (40:1 ratio). My mood swings have reduced significantly. Still early days but hopeful!",
    timestamp: Date.now() - 86400000 * 2,
    likes: 18,
    comments: [],
    reported: false,
    approved: true,
  },
  {
    id: "seed-4",
    userId: "seed",
    userName: "Yaa O.",
    title: "PCOS → PMOS name change thoughts?",
    content:
      "The renaming from PCOS to PMOS is such a big deal. The old name made everyone think it was only about cysts. This new name actually reflects the metabolic and endocrine nature of the condition. What do you all think?",
    timestamp: Date.now() - 86400000 * 1,
    likes: 31,
    comments: [
      { id: "c4", userName: "Nana A.", text: "100% agree. I was misdiagnosed for 2 years because my doctor only looked for cysts.", timestamp: Date.now() - 3600000 * 10 },
      { id: "c5", userName: "Dede A.", text: "About time! Better name = better awareness = faster diagnoses.", timestamp: Date.now() - 3600000 * 5 },
    ],
    reported: false,
    approved: true,
  },
  {
    id: "seed-5",
    userId: "seed",
    userName: "Maame A.",
    title: "Stress and PMOS cycles",
    content:
      "My cycles completely stopped during my final exams. Doctor confirmed stress-induced anovulation. Anyone else notice their symptoms get worse under pressure?",
    timestamp: Date.now() - 3600000 * 6,
    likes: 9,
    comments: [],
    reported: false,
    approved: true,
  },
];

export const initCommunityPosts = async (): Promise<void> => {
  const existing = await load<CommunityPost[]>(KEYS.COMMUNITY_POSTS);
  if (!existing || existing.length === 0) {
    await store(KEYS.COMMUNITY_POSTS, SEED_POSTS);
  }
};

export const getCommunityPosts = async (): Promise<CommunityPost[]> =>
  (await load<CommunityPost[]>(KEYS.COMMUNITY_POSTS)) ?? [];

export const saveCommunityPosts = async (posts: CommunityPost[]): Promise<void> =>
  store(KEYS.COMMUNITY_POSTS, posts);

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

// ─── Notification Settings ────────────────────────────────────
export type NotificationSettings = {
  symptomReminder: boolean;
  cycleReminder: boolean;
  communityActivity: boolean;
  wellnessTips: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  symptomReminder: true,
  cycleReminder: true,
  communityActivity: true,
  wellnessTips: false,
};

export const getNotificationSettings = async (): Promise<NotificationSettings> =>
  (await load<NotificationSettings>(KEYS.NOTIFICATION_SETTINGS)) ??
  DEFAULT_NOTIFICATION_SETTINGS;

export const saveNotificationSettings = async (
  settings: NotificationSettings
): Promise<void> => store(KEYS.NOTIFICATION_SETTINGS, settings);