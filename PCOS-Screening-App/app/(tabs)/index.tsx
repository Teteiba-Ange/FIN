// app/(tabs)/index.tsx
/**
 * Home.
 *
 * The previous version was ten equal-weight rounded cards — nine distinct card
 * styles, 24 inline `isDark ? … : …` colour variables, emoji standing in for
 * icons, and a carousel auto-advancing every 2 seconds with no pause control.
 * Its "Latest Health Briefings" presented invented statistics as research
 * findings, and the onboarding card's progress bar was hardcoded to 33%.
 *
 * This version has one hierarchy: where you stand → the action that matters →
 * everything else, quieter.
 */

import React, { useCallback, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  Screen,
  Section,
  Card,
  Button,
  Text,
  ListRow,
  EmptyState,
  SyncBanner,
  levelFromScore,
  WaterTracker,
} from "@/components/ui";
import { useAuth } from "@/features/auth";
import { useAssessment } from "@/features/assessment";
import { apiService } from "@/lib/api";
import {
  getWaterToday,
  recordDailyCheckIn,
  saveWaterToday,
  type CheckInSummary,
} from "@/lib/storage";
import { useTheme, spacing, radius, minTouchTarget } from "@/theme";

const WATER_GOAL = 8;
const WEEK_LABELS = Array.from({ length: 7 }, (_, index) => {
  const day = new Date();
  day.setDate(day.getDate() - (6 - index));
  return day.toLocaleDateString(undefined, { weekday: "narrow" });
});

const QUICK_ACTIONS = [
  {
    label: "Log a symptom",
    description: "How you're feeling today",
    icon: "create-outline" as const,
    route: "/symptom-log",
  },
  {
    label: "Log your cycle",
    description: "Start, end or flow",
    icon: "calendar-outline" as const,
    route: "/cycle-tracker",
  },
  {
    label: "Take a moment",
    description: "A short breathing exercise",
    icon: "leaf-outline" as const,
    route: "/mindfulness",
  },
];

/** "3 days ago" — plain relative time, no extra dependency. */
function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return months === 1 ? "a month ago" : `${months} months ago`;
}

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { latestResult } = useAssessment();

  const [water, setWater] = useState(0);
  const [checkIn, setCheckIn] = useState<CheckInSummary>({
    streak: 0,
    recent: Array(7).fill(false),
  });
  const [remote, setRemote] = useState<{ score: number; at: string | null } | null>(
    null
  );

  const firstName = user?.fullName?.trim().split(" ")[0];

  // Refresh on focus rather than on mount — the user may have just finished an
  // assessment or logged something on another screen.
  useFocusEffect(
    useCallback(() => {
      let active = true;

      getWaterToday().then((n) => {
        if (active) setWater(n);
      });
      recordDailyCheckIn().then((summary) => {
        if (active) setCheckIn(summary);
      });

      // Casing is normalised in the API client now, and a never-assessed user
      // resolves to null rather than throwing. (A-05.)
      apiService
        .getLatestPrediction()
        .then((p) => {
          if (active && p) setRemote({ score: p.score, at: p.predictedAt });
        })
        .catch(() => {
          // Offline — the persisted result from the assessment context still shows.
        });

      return () => {
        active = false;
      };
    }, [])
  );

  const score = latestResult?.score ?? remote?.score ?? null;
  const assessedAt = latestResult?.completedAt ?? remote?.at ?? null;

  const addGlass = async () => {
    const next = Math.min(water + 1, WATER_GOAL);
    setWater(next);
    await saveWaterToday(next);
  };

  const riskTone = (s: number) =>
    ({ low: colors.riskLow, moderate: colors.riskModerate, high: colors.riskHigh })[
      levelFromScore(s)
    ];

  const riskWord = (s: number) =>
    ({ low: "Low", moderate: "Moderate", high: "High" })[levelFromScore(s)];

  return (
    <Screen>
      <Card style={[styles.hero, { backgroundColor: colors.primary, marginBottom: spacing.lg }]}>
        <View style={styles.heroGlow} />
        <View style={styles.header}>
          <View style={styles.greeting}>
            <Text variant="callout" style={{ color: colors.onPrimary, opacity: 0.82 }}>
              {firstName ? `Hello, ${firstName}` : "Hello"}
            </Text>
            <Text variant="title" accessibilityRole="header" style={{ color: colors.onPrimary }}>
              Make today count
            </Text>
          </View>
          <Button
            label="Menu"
            onPress={() => router.push("/menu")}
            variant="secondary"
            size="sm"
            icon="menu-outline"
            fullWidth={false}
            accessibilityLabel="Open menu"
          />
        </View>

        <View style={styles.streakRow}>
          <View style={[styles.streakBadge, { backgroundColor: colors.surface }]}>
            <Ionicons name="flame" size={22} color={colors.riskModerate} />
            <View>
              <Text variant="subhead" numeric>{checkIn.streak} day</Text>
              <Text variant="caption" color="textSecondary">check-in streak</Text>
            </View>
          </View>
          <View style={styles.week} accessibilityLabel={`${checkIn.streak} day check-in streak`}>
            {checkIn.recent.map((done, index) => (
              <View key={index} style={styles.dayWrap}>
                <View
                  style={[
                    styles.dayDot,
                    { backgroundColor: done ? colors.onPrimary : "rgba(255,255,255,0.24)" },
                  ]}
                >
                  {done && <Ionicons name="checkmark" size={11} color={colors.primary} />}
                </View>
                <Text variant="caption" style={{ color: colors.onPrimary, opacity: 0.75 }}>
                  {WEEK_LABELS[index]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </Card>

      {/* Only renders when something is actually queued, which is rare. */}
      <SyncBanner style={styles.syncBanner} />

      {/* Where you stand — the question this screen exists to answer. */}
      {score !== null ? (
        <Card
          variant="raised"
          onPress={() => router.push("/health-trends")}
          accessibilityLabel={`Your risk score is ${Math.round(score)} out of 100, ${riskWord(
            score
          )} risk, assessed ${assessedAt ? timeAgo(assessedAt) : "recently"}. Opens trends.`}
        >
          <Text variant="label" color="textTertiary">
            Latest assessment
          </Text>

          <View style={styles.scoreRow}>
            <Text variant="display" numeric style={{ color: riskTone(score) }}>
              {Math.round(score)}
            </Text>
            <View style={styles.scoreMeta}>
              <Text variant="subhead" style={{ color: riskTone(score) }}>
                {riskWord(score)} risk
              </Text>
              {assessedAt && (
                <Text variant="caption" color="textTertiary">
                  Assessed {timeAgo(assessedAt)}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </View>
        </Card>
      ) : (
        <Card variant="raised" padded={false}>
          <EmptyState
            icon="clipboard-outline"
            title="You haven't been assessed yet"
            description="Four short steps, about two minutes. It gives you something concrete to take to a doctor."
            actionLabel="Start assessment"
            onActionPress={() => router.push("/assess")}
          />
        </Card>
      )}

      <Section title="Log something" style={styles.section}>
        <Card padded={false} style={styles.group}>
          {QUICK_ACTIONS.map((a, i) => (
            <View key={a.route}>
              {i > 0 && (
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              )}
              <ListRow
                label={a.label}
                description={a.description}
                icon={a.icon}
                onPress={() => router.push(a.route as never)}
              />
            </View>
          ))}
        </Card>
      </Section>

      <Section title="Today" style={styles.section}>
        <Card>
          <WaterTracker value={water} goal={WATER_GOAL} onAdd={addGlass} />
        </Card>
      </Section>

      <Section
        title="Reading"
        actionLabel="See all"
        onActionPress={() => router.push("/wellness-library")}
        style={styles.section}
      >
        {/* Links to the article it names, not the library index. */}
        <Card
          padded={false}
          onPress={() =>
            router.push({ pathname: "/article", params: { id: "insulin-resistance" } })
          }
          accessibilityLabel="Read: Why insulin resistance matters"
        >
          <Image
            source={require("../../assets/images/wellness-hero-teal.png")}
            style={styles.readingImage}
            resizeMode="cover"
            accessibilityElementsHidden
          />
          <View style={styles.readingCopy}>
            <Text variant="label" color="primary">Understanding PCOS</Text>
            <Text variant="subhead" style={styles.readingTitle}>
              Why insulin resistance matters
            </Text>
            <Text variant="callout" color="textSecondary">
              How blood sugar, weight and cycle regularity connect — and what tends to help.
            </Text>
          </View>
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingBottom: spacing.lg,
    minHeight: minTouchTarget,
  },
  greeting: { flex: 1, gap: 2 },
  hero: { overflow: "hidden", marginTop: spacing.sm, borderWidth: 0 },
  heroGlow: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    right: -55,
    top: -85,
    backgroundColor: "rgba(255,255,255,0.11)",
  },
  streakRow: { gap: spacing.lg },
  streakBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  week: { flexDirection: "row", justifyContent: "space-between" },
  dayWrap: { alignItems: "center", gap: spacing.xs },
  dayDot: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  syncBanner: { marginBottom: spacing.lg },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  scoreMeta: { flex: 1, gap: 1 },
  section: { marginTop: spacing.xxl },
  group: { paddingHorizontal: spacing.lg },
  divider: { height: StyleSheet.hairlineWidth },
  readingTitle: { marginTop: spacing.xs, marginBottom: 2 },
  readingImage: { width: "100%", height: 180 },
  readingCopy: { padding: spacing.xl },
});
