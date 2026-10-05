/**
 * Step 1 — physical metrics.
 *
 * Age, weight and height, with BMI computed live. Validation is inline and
 * per-field: the old version fired a single Alert naming every missing field
 * at once, which is both harder to act on and an accessibility problem.
 */

import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { Field, Card, Text } from "@/components/ui";
import { useAssessment } from "@/features/assessment";
import { spacing } from "@/theme";

import { StepLayout } from "../components/StepLayout";

/**
 * Plausible human ranges. These are guard-rails against typos, not clinical
 * limits — a value outside them is far more likely a slip than a real reading,
 * and the model receives whatever passes through here.
 */
const LIMITS = {
  age: { min: 10, max: 80, unit: "years" },
  weight: { min: 25, max: 250, unit: "kg" },
  height: { min: 120, max: 220, unit: "cm" },
  waist: { min: 40, max: 200, unit: "cm" },
  hip: { min: 50, max: 220, unit: "cm" },
};

type FieldName = keyof typeof LIMITS;

/** Waist and hip are optional — see the note on the measurements section. */
const OPTIONAL: FieldName[] = ["waist", "hip"];

function validate(name: FieldName, raw: string): string | undefined {
  const optional = OPTIONAL.includes(name);
  if (!raw.trim()) return optional ? undefined : "Required";
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return "Enter a number";
  const { min, max, unit } = LIMITS[name];
  if (n < min || n > max) return `Enter a value between ${min} and ${max} ${unit}`;
  return undefined;
}

function bmiBand(bmi: number) {
  if (bmi < 18.5) return "Below the healthy range";
  if (bmi < 25) return "In the healthy range";
  if (bmi < 30) return "Above the healthy range";
  return "Well above the healthy range";
}

export default function Step1PhysicalMetrics({ onNext }: { onNext?: () => void }) {
  const { data, update } = useAssessment();
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});

  const errors: Partial<Record<FieldName, string>> = {
    age: validate("age", data.age),
    weight: validate("weight", data.weight),
    height: validate("height", data.height),
    waist: validate("waist", data.waist),
    hip: validate("hip", data.hip),
  };

  const bmi = useMemo(() => {
    const w = parseFloat(data.weight);
    const h = parseFloat(data.height) / 100;
    if (!w || !h || h <= 0) return null;
    return parseFloat((w / (h * h)).toFixed(1));
  }, [data.weight, data.height]);

  /**
   * Waist-to-hip ratio. The backend previously sent a hardcoded 0.85 for every
   * user in the system — one of four model features passed as a constant.
   * It is a genuine PCOS signal, so it is worth two optional fields.
   */
  const whr = useMemo(() => {
    const waist = parseFloat(data.waist);
    const hip = parseFloat(data.hip);
    if (!(waist > 0) || !(hip > 0)) return null;
    return parseFloat((waist / hip).toFixed(2));
  }, [data.waist, data.hip]);

  const hasErrors = Object.values(errors).some(Boolean);

  const handleNext = () => {
    // Reveal every error at once on a failed attempt, rather than only the
    // fields the user happened to visit.
    setTouched({ age: true, weight: true, height: true, waist: true, hip: true });
    if (!hasErrors) onNext?.();
  };

  /** Errors stay hidden until a field is left or submission is attempted. */
  const errorFor = (name: FieldName) => (touched[name] ? errors[name] : undefined);
  const markTouched = (name: FieldName) =>
    setTouched((prev) => ({ ...prev, [name]: true }));

  return (
    <StepLayout
      step={1}
      title="About you"
      description="These three numbers let us estimate your metabolic profile, which is one of the strongest signals in the assessment."
      rationale="Body composition is closely linked to insulin resistance, which is central to how PCOS presents."
      onNext={handleNext}
      nextDisabled={touched.age === true && hasErrors}
    >
      <Field
        label="Age"
        required
        value={data.age}
        onChangeText={(v) => update({ age: v.replace(/[^0-9]/g, "") })}
        onBlur={() => markTouched("age")}
        error={errorFor("age")}
        keyboardType="number-pad"
        maxLength={3}
        placeholder="28"
        icon="calendar-outline"
      />

      <Field
        label="Weight (kg)"
        required
        value={data.weight}
        onChangeText={(v) => update({ weight: v.replace(/[^0-9.]/g, "") })}
        onBlur={() => markTouched("weight")}
        error={errorFor("weight")}
        keyboardType="decimal-pad"
        maxLength={6}
        placeholder="65"
        icon="barbell-outline"
      />

      <Field
        label="Height (cm)"
        required
        value={data.height}
        onChangeText={(v) => update({ height: v.replace(/[^0-9]/g, "") })}
        onBlur={() => markTouched("height")}
        error={errorFor("height")}
        keyboardType="number-pad"
        maxLength={3}
        placeholder="165"
        icon="resize-outline"
      />

      {bmi !== null && (
        <Card variant="sunken">
          <View style={styles.bmiRow}>
            <View style={styles.bmiText}>
              <Text variant="label" color="textTertiary">
                Your BMI
              </Text>
              <Text variant="callout" color="textSecondary">
                {bmiBand(bmi)}
              </Text>
            </View>
            <Text variant="title" numeric>
              {bmi}
            </Text>
          </View>
        </Card>
      )}

      {/*
        Optional, and said so plainly. Requiring a tape measure would stop
        people completing the assessment at all; the model handles the value
        being absent, which is strictly better than the constant it used to
        receive.
      */}
      <View style={styles.optional}>
        <Text variant="label" color="textTertiary">
          If you have a tape measure
        </Text>
        <Text variant="callout" color="textSecondary">
          Waist and hip measurements sharpen the estimate noticeably. Skip them
          if you&apos;d rather — the assessment works without.
        </Text>
      </View>

      <View style={styles.pair}>
        <Field
          label="Waist (cm)"
          value={data.waist}
          onChangeText={(v) => update({ waist: v.replace(/[^0-9.]/g, "") })}
          onBlur={() => markTouched("waist")}
          error={errorFor("waist")}
          keyboardType="decimal-pad"
          maxLength={5}
          placeholder="78"
          containerStyle={styles.pairItem}
        />
        <Field
          label="Hip (cm)"
          value={data.hip}
          onChangeText={(v) => update({ hip: v.replace(/[^0-9.]/g, "") })}
          onBlur={() => markTouched("hip")}
          error={errorFor("hip")}
          keyboardType="decimal-pad"
          maxLength={5}
          placeholder="98"
          containerStyle={styles.pairItem}
        />
      </View>

      {whr !== null && (
        <Card variant="sunken">
          <View style={styles.bmiRow}>
            <View style={styles.bmiText}>
              <Text variant="label" color="textTertiary">
                Waist-to-hip ratio
              </Text>
              <Text variant="callout" color="textSecondary">
                Where the body stores fat is a separate signal from how much.
              </Text>
            </View>
            <Text variant="title" numeric>
              {whr}
            </Text>
          </View>
        </Card>
      )}
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  bmiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  bmiText: { gap: 2, flex: 1 },
  optional: { gap: 2, marginTop: spacing.sm },
  pair: { flexDirection: "row", gap: spacing.md },
  pairItem: { flex: 1 },
});
