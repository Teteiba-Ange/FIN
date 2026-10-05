// app/(menu)/mental-wellbeing.tsx
/**
 * Mood log.
 *
 * The critical fix here is the first line of the old file:
 *
 *     const router = useRouter();   // ← at module scope, outside the component
 *
 * That is a hook called at import time. ESLint flagged it as a hard
 * rules-of-hooks error and it threw the moment anyone tapped "Mental
 * wellbeing" in the menu — the screen has never opened. The variable was
 * never used, so it is simply gone. (B-01 in PLAN.md.)
 *
 * Beyond that: the design system, the shared `Scale` rather than emoji faces,
 * a toast instead of a blocking "Saved" alert, an empty state, and a small
 * seven-day strip so the log has a point beyond storage.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from "react-native-reanimated";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Button,
  Field,
  Text,
  Scale,
  EmptyState,
  useToast,
  type ScaleStep,
} from "@/components/ui";
import { getMoodEntries, addMoodEntry, type MoodEntry } from "@/lib/logs";
import { useTheme, spacing, radius } from "@/theme";

/**
 * Ionicons rather than emoji: 😊 renders as a different drawing on every OS
 * version, can't take a theme colour, and announces as "smiling face with
 * smiling eyes" to a screen reader. These three glyphs cover five steps
 * coherently, and the phrase does the precise work anyway.
 */
const MOODS: readonly ScaleStep[] = [
  { value: 1, label: "A really hard day", icon: "sad-outline" },
  { value: 2, label: "Low", icon: "sad-outline" },
  { value: 3, label: "Somewhere in the middle", icon: "remove-outline" },
  { value: 4, label: "Pretty good", icon: "happy-outline" },
  { value: 5, label: "Really good", icon: "happy-outline" },
];

const DAY_MS = 86_400_000;

const moodIcon = (value: number): keyof typeof Ionicons.glyphMap =>
  value <= 2 ? "sad-outline" : value === 3 ? "remove-outline" : "happy-outline";

function MoodSpotlight({ value }: { value: number }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const tilt = useSharedValue(0);
  const phrase = MOODS.find((item) => item.value === value)?.label;

  useEffect(() => {
    scale.value = withSequence(
      withSpring(0.88, { damping: 14, stiffness: 260 }),
      withSpring(1, { damping: 10, stiffness: 180 })
    );
    tilt.value = withSequence(
      withSpring(value < 3 ? -5 : value > 3 ? 5 : 0),
      withSpring(0)
    );
  }, [scale, tilt, value]);

  const faceStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${tilt.value}deg` }],
  }));

  return (
    <View style={[styles.spotlight, { backgroundColor: colors.primarySubtle }]}>
      <View style={[styles.spotlightOrb, styles.orbOne, { backgroundColor: colors.surface }]} />
      <View style={[styles.spotlightOrb, styles.orbTwo, { backgroundColor: colors.surface }]} />
      <Animated.View style={[styles.moodFace, { backgroundColor: colors.surface }, faceStyle]}>
        <Ionicons name={moodIcon(value)} size={54} color={colors.primary} />
      </Animated.View>
      <View style={styles.spotlightCopy}>
        <Text variant="label" color="primary">Right now</Text>
        <Text variant="heading">{phrase}</Text>
        <Text variant="callout" color="textSecondary">
          Tap a feeling below. There is no wrong answer.
        </Text>
      </View>
    </View>
  );
}

export default function MentalWellbeingScreen() {
  const { colors } = useTheme();
  const toast = useToast();

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [mood, setMood] = useState(3);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getMoodEntries().then((stored) => {
        if (active) setEntries(stored);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  /**
   * The last seven days as a strip, oldest first. Days with no entry render as
   * an empty well rather than being skipped — the gaps are information too.
   */
  const week = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(today.getTime() - (6 - i) * DAY_MS);
      const key = day.toDateString();
      const entry = entries.find((e) => new Date(e.date).toDateString() === key);
      return {
        day,
        value: entry?.mood ?? null,
        initial: day.toLocaleDateString(undefined, { weekday: "narrow" }),
      };
    });
  }, [entries]);

  const loggedToday = week.at(-1)?.value != null;

  const handleSave = async () => {
    setSaving(true);

    // Local write plus a queued server copy — see lib/logs. (A-02.)
    const updated = await addMoodEntry({
      mood,
      notes: notes.trim(),
      date: new Date().toISOString(),
    });
    setEntries(updated);
    setNotes("");
    setSaving(false);
    toast.show(loggedToday ? "Mood updated" : "Mood logged");
  };

  return (
    <Screen>
      <ScreenHeader title="How are you feeling?" />

      <View style={styles.form}>
        <MoodSpotlight value={mood} />

        <Scale
          steps={MOODS}
          value={mood}
          onChange={setMood}
          accessibilityLabel="Mood today"
        />

        <Field
          label="Notes"
          placeholder="What's on your mind?"
          helper="Optional. Only you can see this."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
        />

        <Button
          label={loggedToday ? "Update today's entry" : "Save entry"}
          onPress={handleSave}
          loading={saving}
          size="lg"
          icon="checkmark"
        />
      </View>

      {entries.length > 0 && (
        <Section title="This week" style={styles.section}>
          <Card>
            <View
              style={styles.week}
              accessible
              accessibilityLabel={`Mood over the last seven days. ${week
                .filter((d) => d.value != null)
                .map(
                  (d) =>
                    `${d.day.toLocaleDateString(undefined, { weekday: "long" })}, ${
                      MOODS.find((m) => m.value === d.value)?.label
                    }`
                )
                .join(". ")}`}
            >
              {week.map((d, index) => (
                <Animated.View
                  key={d.day.toISOString()}
                  entering={FadeInUp.delay(index * 55).duration(320)}
                  style={styles.weekDay}
                >
                  <Animated.View
                    style={[
                      styles.weekWell,
                      {
                        backgroundColor: d.value ? colors.primarySubtle : colors.sunken,
                        borderColor: d.value ? colors.primary : "transparent",
                        borderWidth: d.value ? StyleSheet.hairlineWidth * 2 : 0,
                        // Height carries the value as well as the fill does,
                        // so the shape reads without relying on colour.
                        height: d.value ? 20 + d.value * 6 : 22,
                      },
                    ]}
                  >
                    {d.value && (
                      <Ionicons
                        name={moodIcon(d.value)}
                        size={13}
                        color={colors.primary}
                      />
                    )}
                  </Animated.View>
                  <Text variant="caption" color="textTertiary">
                    {d.initial}
                  </Text>
                </Animated.View>
              ))}
            </View>
          </Card>
        </Section>
      )}

      <Section title="Recent entries" style={styles.section}>
        {entries.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="heart-outline"
              title="No entries yet"
              description="Logging how you feel takes a few seconds. Over a few weeks it shows how mood tracks with the rest of your cycle."
            />
          </Card>
        ) : (
          <Card padded={false} style={styles.list}>
            {entries.slice(0, 8).map((entry, i) => {
              const phrase = MOODS.find((m) => m.value === entry.mood)?.label;
              return (
                <Animated.View
                  key={entry.id}
                  entering={FadeInDown.delay(i * 45).duration(300)}
                  style={[
                    styles.entry,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}
                  accessible
                  accessibilityLabel={`${new Date(entry.date).toLocaleDateString()}, ${phrase}${
                    entry.notes ? `. Note: ${entry.notes}` : ""
                  }`}
                >
                  <View style={[styles.entryIcon, { backgroundColor: colors.primarySubtle }]}>
                    <Ionicons name={moodIcon(entry.mood)} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.entryText}>
                    <Text variant="bodyStrong">{phrase}</Text>
                    <Text variant="caption" color="textTertiary">
                      {new Date(entry.date).toLocaleDateString(undefined, {
                        weekday: "long",
                        day: "numeric",
                        month: "short",
                      })}
                    </Text>
                    {entry.notes ? (
                      <Text variant="callout" color="textSecondary" style={styles.entryNote}>
                        {entry.notes}
                      </Text>
                    ) : null}
                  </View>
                </Animated.View>
              );
            })}
          </Card>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  section: { marginTop: spacing.xxl },

  spotlight: {
    minHeight: 190,
    borderRadius: radius.lg,
    padding: spacing.xl,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  spotlightOrb: { position: "absolute", borderRadius: radius.pill, opacity: 0.5 },
  orbOne: { width: 130, height: 130, right: -55, top: -55 },
  orbTwo: { width: 70, height: 70, left: -30, bottom: -25 },
  moodFace: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#10201f",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  spotlightCopy: { flex: 1, gap: spacing.xs },

  week: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm },
  weekDay: { flex: 1, alignItems: "center", gap: spacing.sm },
  weekWell: {
    width: "100%",
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  list: { paddingHorizontal: spacing.lg },
  entry: {
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  entryIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  entryText: { flex: 1, gap: 1 },
  entryNote: { marginTop: spacing.xs },
});
