// app/(tabs)/settings.tsx
/**
 * Settings.
 *
 * C-01 — the reminder switches now schedule real local notifications.
 *
 * Previously they wrote a boolean to storage and the API, and nothing ever
 * read it: `scheduleNotificationAsync` was called nowhere in the codebase
 * while this screen advertised "Daily reminder at 8:00 AM". Reminders are how
 * a tracking app gets used at all, so the entire retention loop was a promise
 * with no implementation.
 *
 * What changed on this screen:
 *
 *   - Toggling a switch schedules or cancels with the OS, immediately.
 *   - The daily prompt has a time the user picks, rather than a fixed hour
 *     that was advertised and never honoured.
 *   - Denied notification permission is surfaced, because a switch that is on
 *     while the OS refuses to post is the same lie in a new costume.
 *   - The cycle reminder reports what it actually scheduled. It needs two
 *     logged cycles to predict from; with fewer it says so instead of
 *     appearing to be armed.
 *   - "Community replies" is gone — it needed server push, which does not
 *     exist. It returns when there is something behind it.
 */

import React, { useCallback, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Switch, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  ListRow,
  Button,
  Text,
  useToast,
} from "@/components/ui";
import { apiService } from "@/lib/api";
import { useAuth } from "@/features/auth";
import {
  getNotificationSettings,
  saveNotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
  type NotificationSettings,
} from "@/lib/storage";
import { applyReminders, permissionStatus } from "@/lib/notifications";
import { useTheme, spacing, radius, minTouchTarget, type ThemeMode } from "@/theme";

const APPEARANCE: { mode: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { mode: "light", label: "Light", icon: "sunny-outline" },
  { mode: "dark", label: "Dark", icon: "moon-outline" },
  { mode: "system", label: "System", icon: "phone-portrait-outline" },
];

const REMINDERS: {
  key: "symptomReminder" | "cycleReminder" | "wellnessTips";
  label: string;
  description: string;
}[] = [
  {
    key: "symptomReminder",
    label: "Daily check-in",
    description: "A nudge to log how you're feeling",
  },
  {
    key: "cycleReminder",
    label: "Period due",
    description: "A heads-up two days before, from your logged cycles",
  },
  {
    key: "wellnessTips",
    label: "Weekly reading",
    description: "One suggestion each Sunday morning",
  },
];

const formatTime = ({ hour, minute }: { hour: number; minute: number }) => {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

export default function SettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors, mode, setMode } = useTheme();
  const { logout } = useAuth();

  const [prefs, setPrefs] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [blocked, setBlocked] = useState(false);
  const [cycleDate, setCycleDate] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      // Local storage is the source of truth for these — they drive on-device
      // scheduling, so a server round trip must not be able to change what the
      // OS has queued behind the user's back.
      getNotificationSettings().then((local) => {
        if (!active) return;
        setPrefs(local);
        // Re-apply on entry so the OS state matches the stored preferences
        // even if scheduling previously failed (permission denied, then granted).
        applyReminders({
          symptomReminder: local.symptomReminder,
          symptomTime: local.symptomTime,
          cycleReminder: local.cycleReminder,
          wellnessTips: local.wellnessTips,
        })
          .then(({ granted, cycleScheduledFor }) => {
            if (!active) return;
            setBlocked(!granted);
            setCycleDate(cycleScheduledFor);
          })
          .catch(() => {});
      });

      permissionStatus().then(({ granted, canAskAgain }) => {
        if (active && !granted && !canAskAgain) setBlocked(true);
      });

      return () => {
        active = false;
      };
    }, [])
  );

  const persist = async (next: NotificationSettings) => {
    setPrefs(next);
    await saveNotificationSettings(next);

    const { granted, cycleScheduledFor } = await applyReminders({
      symptomReminder: next.symptomReminder,
      symptomTime: next.symptomTime,
      cycleReminder: next.cycleReminder,
      wellnessTips: next.wellnessTips,
    });
    setBlocked(!granted);
    setCycleDate(cycleScheduledFor);

    // Best-effort mirror to the server. Local already won; a failure here just
    // means the preference doesn't follow to another device yet.
    apiService.saveNotificationSettings(next).catch(() => {});

    return { granted, cycleScheduledFor };
  };

  const toggle = async (key: (typeof REMINDERS)[number]["key"], value: boolean) => {
    const { granted, cycleScheduledFor } = await persist({ ...prefs, [key]: value });

    if (!value) return;
    if (!granted) {
      toast.show("Notifications are turned off for this app", { tone: "error" });
      return;
    }
    if (key === "cycleReminder" && !cycleScheduledFor) {
      toast.show("Log two cycles and this starts working", { tone: "info" });
      return;
    }
    toast.show("Reminder set");
  };

  const handleTimeChange = async (_: unknown, selected?: Date) => {
    setShowTimePicker(Platform.OS === "ios");
    if (!selected) return;
    await persist({
      ...prefs,
      symptomTime: { hour: selected.getHours(), minute: selected.getMinutes() },
    });
  };

  const handleLogout = () => {
    Alert.alert("Log out?", "You'll need to sign in again to sync your data.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const timeAsDate = (() => {
    const d = new Date();
    d.setHours(prefs.symptomTime.hour, prefs.symptomTime.minute, 0, 0);
    return d;
  })();

  return (
    <Screen>
      <ScreenHeader title="Settings" showBack={false} />

      <Section title="Appearance">
        <View
          style={[styles.segmented, { borderColor: colors.border }]}
          accessibilityRole="radiogroup"
        >
          {APPEARANCE.map((o, i) => {
            const active = mode === o.mode;
            return (
              <Pressable
                key={o.mode}
                onPress={() => setMode(o.mode)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${o.label} appearance`}
                android_ripple={{ color: colors.sunken }}
                style={({ pressed }) => [
                  styles.segment,
                  i > 0 && {
                    borderLeftWidth: StyleSheet.hairlineWidth,
                    borderLeftColor: colors.border,
                  },
                  active && { backgroundColor: colors.primarySubtle },
                  pressed && !active && { backgroundColor: colors.sunken },
                ]}
              >
                <Ionicons
                  name={o.icon}
                  size={16}
                  color={active ? colors.primary : colors.textSecondary}
                />
                <Text
                  variant="callout"
                  color={active ? "primary" : "textSecondary"}
                  style={active ? styles.segmentActive : undefined}
                >
                  {o.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <Section title="Reminders" style={styles.section}>
        {/*
          Permission denied at the OS level means every switch below is inert.
          Saying so is the difference between this screen being honest and
          being the same silent no-op it was before.
        */}
        {blocked && (
          <Card variant="sunken" style={[styles.blocked, { backgroundColor: colors.riskModerateSubtle }]}>
            <Ionicons name="notifications-off-outline" size={18} color={colors.riskModerate} />
            <View style={styles.blockedText}>
              <Text variant="callout" style={{ color: colors.riskModerate }}>
                Notifications are turned off for this app, so none of these can
                reach you. Turn them on in your phone&apos;s settings.
              </Text>
            </View>
          </Card>
        )}

        <Card padded={false} style={styles.group}>
          {REMINDERS.map((row, i) => (
            <View key={row.key}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <ListRow
                label={row.label}
                description={row.description}
                trailing={
                  <Switch
                    value={prefs[row.key]}
                    onValueChange={(v) => toggle(row.key, v)}
                    trackColor={{ false: colors.borderStrong, true: colors.primarySubtle }}
                    thumbColor={prefs[row.key] ? colors.primary : colors.textTertiary}
                    accessibilityLabel={row.label}
                  />
                }
              />

              {/* The daily prompt's time sits under its own switch. */}
              {row.key === "symptomReminder" && prefs.symptomReminder && (
                <View style={styles.subRow}>
                  <Button
                    label={formatTime(prefs.symptomTime)}
                    onPress={() => setShowTimePicker(true)}
                    variant="secondary"
                    size="sm"
                    icon="time-outline"
                    fullWidth={false}
                    accessibilityLabel={`Reminder time: ${formatTime(prefs.symptomTime)}. Change it.`}
                  />
                </View>
              )}

              {/* What the cycle reminder actually did, not what was asked of it. */}
              {row.key === "cycleReminder" && prefs.cycleReminder && (
                <View style={styles.subRow}>
                  <Text variant="caption" color="textTertiary">
                    {cycleDate
                      ? `Next period estimated around ${cycleDate.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "long",
                        })}`
                      : "Needs two logged cycles before it can predict anything"}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </Card>

        {showTimePicker && (
          <DateTimePicker
            value={timeAsDate}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
          />
        )}

        <Text variant="caption" color="textTertiary" style={styles.note}>
          These are scheduled on your phone, so they work without a connection.
        </Text>
      </Section>

      <Section title="Account" style={styles.section}>
        <Card padded={false} style={styles.group}>
          <ListRow
            label="Edit profile"
            description="Your details and health metrics"
            icon="person-outline"
            onPress={() => router.push("/edit-profile")}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <ListRow
            label="Your data"
            description="What we hold, export it, or delete your account"
            icon="shield-checkmark-outline"
            onPress={() => router.push("/privacy")}
          />
        </Card>
      </Section>

      {/* Destructive actions sit apart from everything else, by convention. */}
      <Card padded={false} style={[styles.group, styles.section]}>
        <ListRow label="Log out" icon="log-out-outline" destructive onPress={handleLogout} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: "row",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    minHeight: minTouchTarget,
  },
  segmentActive: { fontWeight: "600" },
  section: { marginTop: spacing.xxl },
  group: { paddingHorizontal: spacing.lg },
  divider: { height: StyleSheet.hairlineWidth },
  subRow: { paddingBottom: spacing.md, paddingLeft: spacing.xs },
  blocked: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  blockedText: { flex: 1 },
  note: { marginTop: spacing.md },
});
