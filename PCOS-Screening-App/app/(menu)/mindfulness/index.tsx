// app/(menu)/mindfulness/index.tsx
/**
 * Breathing exercises.
 *
 * Beyond the design system migration, this screen had the app's worst
 * truthfulness problem. It stated:
 *
 *   "Just 5 minutes of slow breathing daily can lower cortisol by up to 25%
 *    and improve hormonal balance over time."
 *
 * No source exists for that figure. Each exercise also asserted three clinical
 * effects as fact ("Reduces cortisol", "Balances hormones", "Reduces
 * inflammation"). All of it is rewritten to describe what the exercise *is*
 * and what people commonly report, which is both honest and loses nothing
 * useful. (C-04 in PLAN.md.)
 *
 * Also removed: the "FR-16 · Guided breathing exercises" subtitle — an internal
 * requirement ID printed where users read it — and seven emoji standing in for
 * icons.
 */

import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Button,
  Text,
  Stat,
} from "@/components/ui";
import { getBreathingSessions } from "@/lib/storage";
import { useTheme, spacing, radius } from "@/theme";

const CYCLES = 5;

type Exercise = {
  id: string;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** What the pattern is. Neutral description, no claimed mechanism. */
  description: string;
  /** What people commonly use it for — reported, not asserted as an effect. */
  commonlyUsedFor: string;
  inhale: number;
  hold: number;
  exhale: number;
};

const EXERCISES: Exercise[] = [
  {
    id: "box",
    title: "Box breathing",
    icon: "square-outline",
    description:
      "Four equal counts — in, hold, out, hold. The evenness is the point; it gives you something simple to follow.",
    commonlyUsedFor: "Settling before something stressful",
    inhale: 4,
    hold: 4,
    exhale: 4,
  },
  {
    id: "478",
    title: "4-7-8 breathing",
    icon: "moon-outline",
    description:
      "In for four, hold for seven, out for eight. The long exhale is what makes this one distinctive, and it takes practice.",
    commonlyUsedFor: "Winding down at night",
    inhale: 4,
    hold: 7,
    exhale: 8,
  },
  {
    id: "calm",
    title: "Slow breathing",
    icon: "water-outline",
    description:
      "Five counts in, five counts out, no hold. The simplest pattern here and the easiest to keep going.",
    commonlyUsedFor: "A short pause at any point in the day",
    inhale: 5,
    hold: 0,
    exhale: 5,
  },
  {
    id: "energising",
    title: "Longer exhale",
    icon: "flash-outline",
    description:
      "A short breath in and a longer one out. Some people find the asymmetry easier to hold attention on than an even count.",
    commonlyUsedFor: "When an even rhythm feels difficult",
    inhale: 3,
    hold: 0,
    exhale: 6,
  },
  {
    id: "coherent",
    title: "Six-count breathing",
    icon: "ellipse-outline",
    description:
      "Six in, six out — about five breaths a minute. Slower than it sounds, and worth building up to.",
    commonlyUsedFor: "A longer, steadier session",
    inhale: 6,
    hold: 0,
    exhale: 6,
  },
];

/** Total seconds for a full run, so the duration shown is the real one. */
const durationOf = (e: Exercise) => (e.inhale + e.hold + e.exhale) * CYCLES;

export default function MindfulnessScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getBreathingSessions().then((s) => {
        if (active) setSessionCount(s.length);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const start = (exercise: Exercise) =>
    router.push({
      pathname: "/mindfulness/breathing",
      params: {
        id: exercise.id,
        title: exercise.title,
        inhale: exercise.inhale,
        hold: exercise.hold,
        exhale: exercise.exhale,
      },
    });

  return (
    <Screen>
      <ScreenHeader
        title="Breathing"
        action={
          sessionCount > 0
            ? {
                icon: "time-outline",
                label: "Session history",
                onPress: () => router.push("/mindfulness/history"),
              }
            : undefined
        }
      />

      {sessionCount > 0 && (
        <Card variant="sunken" style={styles.summary}>
          <Stat
            label="Sessions completed"
            value={String(sessionCount)}
          />
        </Card>
      )}

      <Text variant="body" color="textSecondary" style={styles.intro}>
        Five patterns to breathe along with. Each runs {CYCLES} cycles and you
        can stop at any point. Pick whichever rhythm you can hold comfortably —
        none is better than the others.
      </Text>

      <Section title="Choose a pattern" style={styles.section}>
        <View style={styles.list}>
          {EXERCISES.map((exercise) => {
            const open = expanded === exercise.id;
            const seconds = durationOf(exercise);

            return (
              <Card key={exercise.id} padded={false} style={styles.card}>
                <Card
                  padded={false}
                  onPress={() => setExpanded(open ? null : exercise.id)}
                  accessibilityLabel={`${exercise.title}. About ${Math.round(
                    seconds / 60
                  )} minutes.`}
                  accessibilityHint={open ? "Collapse details" : "Show details"}
                  style={styles.cardHead}
                >
                  <View style={styles.headRow}>
                    <View
                      style={[styles.icon, { backgroundColor: colors.primarySubtle }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    >
                      <Ionicons name={exercise.icon} size={19} color={colors.primary} />
                    </View>

                    <View style={styles.headText}>
                      <Text variant="bodyStrong">{exercise.title}</Text>
                      <Text variant="caption" color="textTertiary" numeric>
                        {exercise.inhale}-{exercise.hold > 0 ? `${exercise.hold}-` : ""}
                        {exercise.exhale} · about {Math.round(seconds / 60)} min
                      </Text>
                    </View>

                    <Ionicons
                      name={open ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.textTertiary}
                    />
                  </View>
                </Card>

                {open && (
                  <Animated.View
                    entering={FadeInDown.duration(300)}
                    style={[styles.details, { borderTopColor: colors.border }]}
                  >
                    <Text variant="callout" color="textSecondary">
                      {exercise.description}
                    </Text>

                    <View style={styles.usedFor}>
                      <Ionicons
                        name="bookmark-outline"
                        size={14}
                        color={colors.textTertiary}
                      />
                      <Text variant="caption" color="textTertiary" style={styles.usedForText}>
                        Commonly used for: {exercise.commonlyUsedFor}
                      </Text>
                    </View>

                    <View style={[styles.timings, { backgroundColor: colors.sunken }]}>
                      {[
                        { label: "In", value: exercise.inhale },
                        ...(exercise.hold > 0
                          ? [{ label: "Hold", value: exercise.hold }]
                          : []),
                        { label: "Out", value: exercise.exhale },
                        { label: "Cycles", value: CYCLES },
                      ].map((t) => (
                        <View key={t.label} style={styles.timing}>
                          <Text variant="subhead" numeric>
                            {t.value}
                          </Text>
                          <Text variant="caption" color="textTertiary">
                            {t.label}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <Button
                      label={`Start ${exercise.title.toLowerCase()}`}
                      onPress={() => start(exercise)}
                      icon="play"
                    />
                  </Animated.View>
                )}
              </Card>
            );
          })}
        </View>
      </Section>

      {/*
        What replaced the "lowers cortisol by 25%" claim. Everything here is
        either mechanically true (a longer exhale is slower breathing) or
        framed as what people report rather than what the practice does.
      */}
      <Card variant="sunken" style={styles.note}>
        <Text variant="label" color="textTertiary">
          Why this is here
        </Text>
        <Text variant="callout" color="textSecondary">
          Slow, deliberate breathing is a widely used way to settle yourself,
          and many people find it helps with stress. It isn&apos;t a treatment
          for PCOS and it won&apos;t change your symptoms on its own — but it
          costs nothing, works anywhere, and you can stop whenever you like.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { marginBottom: spacing.lg },
  intro: { marginBottom: spacing.sm },
  section: { marginTop: spacing.xl },
  list: { gap: spacing.md },
  card: { overflow: "hidden" },
  cardHead: { padding: spacing.lg, backgroundColor: "transparent", borderWidth: 0 },
  headRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { flex: 1, gap: 1 },

  details: {
    gap: spacing.lg,
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  usedFor: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  usedForText: { flex: 1 },
  timings: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  timing: { alignItems: "center", gap: 1 },

  note: { marginTop: spacing.xxl, gap: spacing.xs },
});
