/**
 * Scale — a 1–n rating row where every step carries a word.
 *
 * Two screens ask the user to rate something: symptom severity and mood. Both
 * previously showed bare numbers or emoji, which is the same problem in two
 * costumes — a "4" and a 🙂 both mean whatever the tapper decides they mean,
 * so the same person rates the same day differently a fortnight apart and the
 * series is not comparable with itself.
 *
 * Anchoring each step to a phrase is the fix. The phrase is also what a screen
 * reader announces, so the control is not a row of undifferentiated numbers.
 *
 * Optional `icon` per step, for scales where a glyph genuinely helps. Icons
 * come from Ionicons rather than emoji so they take a token colour and render
 * identically on both platforms.
 */

import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, minTouchTarget, radius, spacing } from "@/theme";
import { Text } from "./Text";

export type ScaleStep = {
  value: number;
  /** The anchor phrase. Shown under the row when selected, and always announced. */
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
};

type ScaleProps = {
  steps: readonly ScaleStep[];
  value: number;
  onChange: (value: number) => void;
  /** Announced as the group's name, e.g. "Severity". */
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
};

export function Scale({
  steps,
  value,
  onChange,
  accessibilityLabel,
  style,
}: ScaleProps) {
  const { colors } = useTheme();
  const active = steps.find((s) => s.value === value);

  return (
    <View style={[styles.block, style]}>
      <View
        style={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
      >
        {steps.map((step) => {
          const selected = step.value === value;
          return (
            <Pressable
              key={step.value}
              onPress={() => onChange(step.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${step.value} of ${steps.length}, ${step.label}`}
              android_ripple={{ color: colors.primarySubtle, borderless: true }}
              style={({ pressed }) => [
                styles.step,
                {
                  backgroundColor: selected ? colors.primary : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                  borderWidth: selected ? 0 : StyleSheet.hairlineWidth * 2,
                },
                pressed && !selected && { backgroundColor: colors.sunken },
              ]}
            >
              {step.icon ? (
                <Ionicons
                  name={step.icon}
                  size={20}
                  color={selected ? colors.onPrimary : colors.textSecondary}
                />
              ) : (
                <Text
                  variant="bodyStrong"
                  numeric
                  style={{ color: selected ? colors.onPrimary : colors.textSecondary }}
                >
                  {step.value}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      {/*
        The anchor phrase for the current selection. Hidden from the reader
        because each step already announces its own phrase — repeating it here
        would have the group read twice.
      */}
      <Text
        variant="callout"
        color="textSecondary"
        style={styles.caption}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {active?.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  step: {
    flex: 1,
    height: minTouchTarget,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  // Reserved height, so selecting a step with a shorter phrase doesn't
  // shift everything below it up by a line.
  caption: { minHeight: 18 },
});
