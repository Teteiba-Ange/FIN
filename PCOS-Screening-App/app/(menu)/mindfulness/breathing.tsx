// app/(menu)/mindfulness/breathing.tsx
/**
 * The breathing session itself.
 *
 * Fixes beyond the design system:
 *
 *   - Sessions are recorded on completion. Nothing was ever saved, which is
 *     why the history screen fell back to three hardcoded entries.
 *   - Partial sessions count. Ending early after three cycles logged nothing
 *     at all, which is the wrong incentive for a wellbeing feature.
 *   - The timer used `setTimeout` chained off `seconds` in a dependency array
 *     that also included five other values, so it re-scheduled on every
 *     render. It's a single interval now.
 *   - The two buttons were "End Session" (red) and "Skip Session" (grey),
 *     which both did nearly the same thing and neither of which was pause.
 *     There's now a real pause and one exit.
 *   - `useEffect` on `completed` navigated after a bare `setTimeout` with no
 *     cleanup — leaving the screen mid-countdown pushed a route onto an
 *     unmounted stack.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen, ScreenHeader, Button, Text } from "@/components/ui";
import { BreathingCircle } from "@/features/mindfulness";
import { addBreathingSession } from "@/lib/storage";
import { useTheme, spacing } from "@/theme";

const TOTAL_CYCLES = 5;

type Phase = "inhale" | "hold" | "exhale";
const PHASE_LABEL: Record<Phase, string> = {
  inhale: "Breathe in",
  hold: "Hold",
  exhale: "Breathe out",
};

export default function BreathingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    inhale?: string;
    hold?: string;
    exhale?: string;
  }>();

  // Params arrive as strings and a malformed one would otherwise produce NaN
  // and freeze the countdown, so each is clamped to something workable.
  const timings = useMemo(() => {
    const read = (v: string | undefined, fallback: number) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 && n <= 20 ? n : fallback;
    };
    return {
      inhale: read(params.inhale, 4) || 4,
      hold: read(params.hold, 0),
      exhale: read(params.exhale, 4) || 4,
    };
  }, [params.inhale, params.hold, params.exhale]);

  const title = params.title ?? "Breathing";

  const sequence = useMemo<Phase[]>(
    () => (timings.hold > 0 ? ["inhale", "hold", "exhale"] : ["inhale", "exhale"]),
    [timings.hold]
  );

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [seconds, setSeconds] = useState(timings.inhale);
  const [cycle, setCycle] = useState(1);
  const [running, setRunning] = useState(true);
  const [done, setDone] = useState(false);

  const phase = sequence[phaseIndex];
  const elapsed = useRef(0);
  const saved = useRef(false);

  const durationFor = useCallback(
    (p: Phase) => timings[p],
    [timings]
  );

  /** Records what actually happened, whether the user finished or stopped. */
  const persist = useCallback(
    async (completedCycles: number) => {
      if (saved.current || completedCycles < 1) return;
      saved.current = true;
      await addBreathingSession({
        id: Date.now().toString(),
        exercise: title,
        cycles: completedCycles,
        seconds: elapsed.current,
        date: new Date().toISOString(),
      });
    },
    [title]
  );

  // One interval for the whole session rather than a timeout re-created on
  // every tick from a six-value dependency array.
  useEffect(() => {
    if (!running || done) return;

    const tick = setInterval(() => {
      elapsed.current += 1;

      setSeconds((remaining) => {
        if (remaining > 1) return remaining - 1;

        // Phase finished — advance, and roll the cycle when the sequence ends.
        let nextIndex = 0;
        setPhaseIndex((current) => {
          nextIndex = (current + 1) % sequence.length;
          return nextIndex;
        });

        if (nextIndex === 0) {
          setCycle((c) => {
            if (c >= TOTAL_CYCLES) {
              setDone(true);
              return c;
            }
            return c + 1;
          });
        }

        return durationFor(sequence[nextIndex]);
      });
    }, 1000);

    return () => clearInterval(tick);
  }, [running, done, sequence, durationFor]);

  // Announce each phase change, since the visual cue is a silent animation.
  useEffect(() => {
    if (!done) AccessibilityInfo.announceForAccessibility(PHASE_LABEL[phase]);
  }, [phase, done]);

  useEffect(() => {
    if (!done) return;
    let cancelled = false;

    persist(TOTAL_CYCLES).then(() => {
      if (cancelled) return;
      router.replace({
        pathname: "/mindfulness/completion",
        params: { title, cycles: String(TOTAL_CYCLES) },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [done, persist, router, title]);

  const handleStop = async () => {
    setRunning(false);
    // Whole cycles finished before stopping — the current partial one doesn't count.
    await persist(cycle - 1);
    router.back();
  };

  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      <ScreenHeader title={title} onBack={handleStop} />

      <View style={styles.stage}>
        <BreathingCircle phase={phase} paused={!running} />

        <View style={styles.readout} accessible accessibilityLiveRegion="polite">
          <Text variant="display" numeric style={styles.count}>
            {seconds}
          </Text>
          <Text variant="heading" color="textSecondary">
            {PHASE_LABEL[phase]}
          </Text>
        </View>

        <View style={styles.progress}>
          <Text variant="caption" color="textTertiary" numeric>
            Cycle {cycle} of {TOTAL_CYCLES}
          </Text>
          <View
            style={[styles.track, { backgroundColor: colors.sunken }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.primary,
                  width: `${((cycle - 1) / TOTAL_CYCLES) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        <Button
          label={running ? "Pause" : "Resume"}
          onPress={() => setRunning((r) => !r)}
          icon={running ? "pause" : "play"}
          size="lg"
        />
        <Button
          label="End session"
          onPress={handleStop}
          variant="ghost"
          size="sm"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl },
  readout: { alignItems: "center", gap: spacing.xs },
  count: { fontSize: 64, lineHeight: 70 },
  progress: { alignItems: "center", gap: spacing.sm, width: "70%" },
  track: { height: 4, width: "100%", borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 2 },
  controls: { gap: spacing.sm, paddingBottom: spacing.lg },
});
