/**
 * Step 2 — menstrual health.
 *
 * E-04, second half. Cycle regularity is the highest-weight input the model
 * takes, and the app was asking the user to describe it from memory while
 * sitting on the logged dates that compute it exactly.
 *
 * So: when there is enough history, this step now *shows* what the logs say
 * and asks the user to confirm it, pre-filling the answer and the cycle
 * length. They can still override — the logs may not be complete, and the
 * person knows things the data doesn't — but the default is the evidence
 * rather than a guess.
 *
 * With no logged cycles the step behaves exactly as before, which is the
 * common case for a first-time user.
 */

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Field, Card, Text, Button } from "@/components/ui";
import { useAssessment } from "@/features/assessment";
import { getCycleEntries } from "@/lib/logs";
import { analyseCycles, type CycleAnalysis } from "@/lib/cycle/analysis";
import { useTheme, spacing } from "@/theme";

import { StepLayout } from "../components/StepLayout";
import { OptionGroup, type Option } from "../components/OptionGroup";

const REGULARITY: Option[] = [
  {
    value: "Regular",
    label: "Regular",
    description: "Arrives every 21–35 days, fairly predictably",
  },
  {
    value: "Irregular",
    label: "Irregular",
    description: "Timing varies a lot, or you skip months",
  },
  {
    value: "No Cycle",
    label: "No periods",
    description: "None for three months or more, and not pregnant",
  },
];

const CYCLE_LENGTH = { min: 15, max: 90 };
const PERIOD_DAYS = { min: 1, max: 14 };

export default function Step2MenstrualHealth({
  onNext,
  onBack,
}: {
  onNext?: () => void;
  onBack?: () => void;
}) {
  const { data, update } = useAssessment();
  const { colors } = useTheme();
  const [attempted, setAttempted] = useState(false);
  const [analysis, setAnalysis] = useState<CycleAnalysis | null>(null);
  const [overridden, setOverridden] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getCycleEntries().then((entries) => {
        if (active) setAnalysis(analyseCycles(entries));
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const derived = analysis?.regularity ?? null;

  // Pre-fill from the logs, but never overwrite an answer already given —
  // returning to this step must not silently discard what the user chose.
  useEffect(() => {
    if (!derived || overridden) return;
    if (!data.cycleRegularity) update({ cycleRegularity: derived });
    if (!data.cycleLength && analysis?.average) {
      update({ cycleLength: String(analysis.average) });
    }
    if (!data.avgPeriodDuration && analysis?.averagePeriodDays) {
      update({ avgPeriodDuration: String(analysis.averagePeriodDays) });
    }
    // `update` is stable; listing `data` would re-run on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived, analysis, overridden]);

  const rangeError = (raw: string, { min, max }: { min: number; max: number }) => {
    if (!raw.trim()) return undefined; // optional
    const n = parseFloat(raw);
    if (Number.isNaN(n) || n < min || n > max) return `Enter a value between ${min} and ${max}`;
    return undefined;
  };

  const cycleLengthError = rangeError(data.cycleLength, CYCLE_LENGTH);
  const periodError = rangeError(data.avgPeriodDuration, PERIOD_DAYS);
  const regularityError =
    attempted && !data.cycleRegularity ? "Choose one to continue" : undefined;

  const handleNext = () => {
    setAttempted(true);
    if (data.cycleRegularity && !cycleLengthError && !periodError) onNext?.();
  };

  const showsDerived = derived != null && data.cycleRegularity === derived && !overridden;

  return (
    <StepLayout
      step={2}
      title="Your cycle"
      description={
        derived
          ? "We've filled this in from the periods you've logged. Change anything that doesn't look right."
          : "Cycle patterns are the clearest signal in this assessment. Answer as best you can — an estimate is fine."
      }
      rationale="Irregular or absent periods are one of the criteria clinicians use when diagnosing PCOS."
      onNext={handleNext}
      onBack={onBack}
    >
      {/*
        Shown only when the answer below actually came from the logs. The
        moment the user changes it, this disappears rather than continuing to
        claim the assessment is using their data.
      */}
      {showsDerived && analysis && (
        <Card variant="sunken" style={styles.derived}>
          <View style={styles.derivedHead}>
            <Ionicons name="checkmark-circle" size={17} color={colors.primary} />
            <Text variant="caption" color="primary" style={styles.derivedLabel}>
              From your logged cycles
            </Text>
          </View>
          <Text variant="callout" color="textSecondary">
            {analysis.reason} Based on {analysis.sampleSize}{" "}
            {analysis.sampleSize === 1 ? "cycle" : "cycles"} you&apos;ve tracked.
          </Text>
        </Card>
      )}

      <OptionGroup
        label="How regular are your periods?"
        required
        options={REGULARITY}
        value={data.cycleRegularity}
        onChange={(v) => {
          setOverridden(true);
          update({ cycleRegularity: v as typeof data.cycleRegularity });
        }}
        error={regularityError}
        hint={
          derived && overridden
            ? "You've changed this from what your logs suggest, which is fine — they may not be complete."
            : undefined
        }
      />

      <Field
        label="Typical cycle length"
        helper="Days from the start of one period to the start of the next"
        value={data.cycleLength}
        onChangeText={(v) => update({ cycleLength: v.replace(/[^0-9]/g, "") })}
        error={cycleLengthError}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="28"
        icon="repeat-outline"
      />

      <Field
        label="How many days does bleeding last?"
        value={data.avgPeriodDuration}
        onChangeText={(v) => update({ avgPeriodDuration: v.replace(/[^0-9]/g, "") })}
        error={periodError}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="5"
        icon="water-outline"
      />

      {/* Nothing logged: point at the thing that would make this step accurate. */}
      {analysis && analysis.sortedStarts.length === 0 && (
        <Card variant="sunken" style={styles.nudge}>
          <Text variant="callout" color="textSecondary">
            If you track your periods in the cycle tracker, this step fills
            itself in next time — and the answer comes from dates rather than
            memory.
          </Text>
        </Card>
      )}

      {overridden && derived && (
        <Button
          label="Use what my logs say"
          onPress={() => {
            setOverridden(false);
            update({
              cycleRegularity: derived,
              ...(analysis?.average ? { cycleLength: String(analysis.average) } : {}),
            });
          }}
          variant="ghost"
          size="sm"
          icon="refresh-outline"
          fullWidth={false}
        />
      )}
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  derived: { gap: spacing.xs },
  derivedHead: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  derivedLabel: { fontWeight: "700", letterSpacing: 0.4 },
  nudge: { marginTop: spacing.sm },
});
