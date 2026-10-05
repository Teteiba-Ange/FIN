// app/(menu)/mindfulness/history.tsx
/**
 * Session history.
 *
 * This screen was the clearest fabrication in the app. It held three sessions
 * in `useState` as literals —
 *
 *     { exercise: "Box Breathing",     duration: "5 Minutes", date: "Today"      }
 *     { exercise: "4-7-8 Relaxation",  duration: "4 Minutes", date: "Yesterday"  }
 *     { exercise: "Calm Breathing",    duration: "3 Minutes", date: "2 Days Ago" }
 *
 * — so a user who had never opened a breathing session saw three they had
 * supposedly completed, dated relative to today so they always looked current.
 * The empty state below them was unreachable.
 *
 * Sessions are now read from storage and written by the breathing screen when
 * one finishes, including partial sessions.
 */

import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";

import {
  Screen,
  ScreenHeader,
  Card,
  Text,
  Stat,
  EmptyState,
} from "@/components/ui";
import { getBreathingSessions, type BreathingSession } from "@/lib/storage";
import { useTheme, spacing } from "@/theme";

/** "4 min 20s" — reads better than a raw second count at these lengths. */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest}s`;
}

function formatDay(iso: string): string {
  const then = new Date(iso);
  const today = new Date();
  const days = Math.floor(
    (new Date(today.toDateString()).getTime() - new Date(then.toDateString()).getTime()) /
      86_400_000
  );
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export default function MindfulnessHistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [sessions, setSessions] = useState<BreathingSession[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getBreathingSessions().then((stored) => {
        if (active) setSessions(stored);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const totals = useMemo(() => {
    if (!sessions?.length) return null;
    return {
      count: sessions.length,
      minutes: Math.round(sessions.reduce((sum, s) => sum + s.seconds, 0) / 60),
    };
  }, [sessions]);

  // `null` means the read hasn't returned yet; `[]` means genuinely empty.
  const loading = sessions === null;

  return (
    <Screen>
      <ScreenHeader title="Your sessions" />

      {loading ? null : !sessions.length ? (
        <Card padded={false}>
          <EmptyState
            icon="leaf-outline"
            title="No sessions yet"
            description="Finish a breathing exercise and it'll be recorded here, including ones you stop partway."
            actionLabel="Start one"
            onActionPress={() => router.replace("/mindfulness")}
          />
        </Card>
      ) : (
        <>
          {totals && (
            <Card variant="raised" style={styles.totals}>
              <Stat label="Sessions" value={String(totals.count)} />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Stat
                label="Time spent"
                value={String(totals.minutes)}
                unit={totals.minutes === 1 ? "min" : "mins"}
              />
            </Card>
          )}

          <Card padded={false} style={styles.list}>
            {sessions.slice(0, 20).map((session, i) => (
              <View
                key={session.id}
                style={[
                  styles.row,
                  i > 0 && {
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: colors.border,
                  },
                ]}
                accessible
                accessibilityLabel={`${session.exercise}, ${session.cycles} cycles, ${formatDuration(
                  session.seconds
                )}, ${formatDay(session.date)}`}
              >
                <View style={styles.rowText}>
                  <Text variant="bodyStrong">{session.exercise}</Text>
                  <Text variant="caption" color="textTertiary" numeric>
                    {session.cycles} {session.cycles === 1 ? "cycle" : "cycles"} ·{" "}
                    {formatDuration(session.seconds)}
                  </Text>
                </View>
                <Text variant="callout" color="textSecondary">
                  {formatDay(session.date)}
                </Text>
              </View>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  totals: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: "stretch",
    marginHorizontal: spacing.xl,
  },
  list: { paddingHorizontal: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 1 },
});
