// app/(tabs)/health-trends.tsx
/**
 * Trends.
 *
 * The previous version fabricated the user's history. With a single assessment
 * on record it built a six-point series by subtracting from the current score
 * (`score - 18`, `score - 12`, …), labelled it Jan–May, and captioned it "How
 * your estimated risk has trended over time". Every user saw an invented
 * five-month improvement.
 *
 * This reads real records from GET /api/predictions/history, and shows a trend
 * line only once there are genuinely two or more of them.
 */

import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Button,
  Text,
  Stat,
  EmptyState,
  TrendChart,
  levelFromScore,
  type TrendPoint,
} from "@/components/ui";
import { apiService, type ShapFeature } from "@/lib/api";
import { useAssessment } from "@/features/assessment";
import { useTheme, spacing, radius } from "@/theme";

export default function HealthTrendsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { latestResult } = useAssessment();

  const [history, setHistory] = useState<TrendPoint[] | null>(null);
  const [storedDrivers, setStoredDrivers] = useState<ShapFeature[]>([]);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const requestAttempt = reloadKey;

      // Column casing is normalised in the API client now. (A-05.)
      apiService
        .getPredictionHistory()
        .then((rows) => {
          if (!active || requestAttempt !== reloadKey) return;
          const points = rows
            .map((r) => ({ value: r.score, at: r.predictedAt ?? "" }))
            .filter(
              (p) =>
                Number.isFinite(p.value) &&
                p.value >= 0 &&
                p.value <= 100 &&
                p.at &&
                Number.isFinite(new Date(p.at).getTime())
            )
            // Sort explicitly so the chart remains correct if the API order changes.
            .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
          setHistory(points);
          // Attributions now come back with the row, so "what influenced this"
          // survives a restart instead of living only in memory. (A-04.)
          setStoredDrivers(rows[0]?.topFeatures ?? []);
          setFailed(false);
        })
        .catch(() => {
          if (active && requestAttempt === reloadKey) {
            setHistory([]);
            setFailed(true);
          }
        });

      return () => {
        active = false;
      };
    }, [reloadKey])
  );

  const points = history ?? [];
  const current = points.at(-1)?.value ?? latestResult?.score ?? null;
  const previous = points.length >= 2 ? points.at(-2)!.value : null;
  const delta = current !== null && previous !== null ? current - previous : null;

  // Prefer the in-memory result (freshest), fall back to what the server stored.
  const drivers = latestResult?.topFeatures?.length
    ? latestResult.topFeatures
    : storedDrivers;

  // Nothing recorded yet, and nothing in memory either.
  if (current === null) {
    return (
      <Screen>
        <ScreenHeader title="Trends" showBack={false} />
        <EmptyState
          icon="trending-up-outline"
          title={failed ? "Can't load your history" : "No assessments yet"}
          description={
            failed
              ? "We couldn't reach the server. Check your connection and try again."
              : "Once you've completed an assessment, your score and how it changes over time will appear here."
          }
          actionLabel={failed ? "Try again" : "Start assessment"}
          onActionPress={() => {
            if (failed) {
              setHistory(null);
              setReloadKey((key) => key + 1);
            } else {
              router.push("/assess");
            }
          }}
        />
      </Screen>
    );
  }

  const level = levelFromScore(current);
  const tone = { low: colors.riskLow, moderate: colors.riskModerate, high: colors.riskHigh }[
    level
  ];
  const word = { low: "Low", moderate: "Moderate", high: "High" }[level];

  return (
    <Screen>
      <ScreenHeader title="Trends" showBack={false} />

      <Card variant="raised">
        <View style={styles.summary}>
          <Stat
            label="Current score"
            value={String(Math.round(current))}
            unit="/ 100"
            trend={delta === null ? undefined : delta > 0 ? "up" : delta < 0 ? "down" : "flat"}
            delta={
              delta === null || delta === 0
                ? undefined
                : `${delta > 0 ? "+" : ""}${Math.round(delta)} since last`
            }
            // For a risk score, a rise is the unwelcome direction.
            upIsGood={false}
          />
          <View style={[styles.levelPill, { backgroundColor: colors.sunken }]}>
            <Ionicons
              name={
                level === "low"
                  ? "shield-checkmark"
                  : level === "moderate"
                    ? "alert-circle"
                    : "warning"
              }
              size={15}
              color={tone}
            />
            <Text variant="callout" style={{ color: tone, fontWeight: "600" }}>
              {word}
            </Text>
          </View>
        </View>
      </Card>

      <Section title="Over time" style={styles.section}>
        {points.length >= 2 ? (
          <Card>
            <TrendChart points={points} label="Your PCOS risk score over time" />
          </Card>
        ) : (
          <Card variant="sunken" style={styles.singleRow}>
            <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
            <Text variant="callout" color="textSecondary" style={styles.singleText}>
              You&apos;ve completed one assessment. Take another in a few weeks
              and a trend line will appear here.
            </Text>
          </Card>
        )}
      </Section>

      {/*
        Only model-produced attributions reach `latestResult` now, so there is
        nothing to guard against here — an estimated result carries none.
      */}
      {drivers.length > 0 && (
        <Section title="What influenced your last result" style={styles.section}>
          <Card padded={false} style={styles.driverCard}>
            {drivers.map((d, i) => (
              <View
                key={d.feature}
                style={[
                  styles.driverRow,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={d.direction === "increases" ? "trending-up" : "trending-down"}
                  size={17}
                  color={d.direction === "increases" ? colors.riskHigh : colors.riskLow}
                />
                <View style={styles.driverText}>
                  <Text variant="bodyStrong">{d.feature}</Text>
                  <Text variant="caption" color="textSecondary">
                    {d.direction === "increases" ? "Raises" : "Lowers"} your score
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      )}

      <Section title="History" style={styles.section}>
        <Card padded={false} style={styles.driverCard}>
          {[...points].reverse().slice(0, 8).map((p, i) => (
            <View
              key={p.at + i}
              style={[
                styles.historyRow,
                i > 0 && {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: colors.border,
                },
              ]}
            >
              <Text variant="body" color="textSecondary">
                {new Date(p.at).toLocaleDateString(undefined, {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
              <Text
                variant="bodyStrong"
                numeric
                style={{
                  color: {
                    low: colors.riskLow,
                    moderate: colors.riskModerate,
                    high: colors.riskHigh,
                  }[levelFromScore(p.value)],
                }}
              >
                {Math.round(p.value)}
              </Text>
            </View>
          ))}
        </Card>
      </Section>

      <Button
        label="Take another assessment"
        onPress={() => router.push("/assess")}
        variant="secondary"
        icon="refresh-outline"
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  levelPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  section: { marginTop: spacing.xxl },
  singleRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  singleText: { flex: 1 },
  driverCard: { paddingHorizontal: spacing.lg },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  driverText: { flex: 1, gap: 1 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  cta: { marginTop: spacing.xxl },
});
