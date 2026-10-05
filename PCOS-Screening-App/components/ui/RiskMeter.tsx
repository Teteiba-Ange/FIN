/**
 * RiskMeter — the assessment result gauge.
 *
 * The single most consequential thing the app displays, so it follows the
 * rules strictly:
 *
 *   - risk level is carried by an icon and a word, never by colour alone
 *   - the score reads as one sentence to a screen reader, not as loose parts
 *   - the arc is drawn to the actual value, not an approximation
 *   - it does not animate under reduced-motion, and never blocks reading
 */

import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, spacing } from "@/theme";
import { Text } from "./Text";

export type RiskLevel = "low" | "moderate" | "high";

type RiskMeterProps = {
  /** 0–100. Ignored while `pending`. */
  score: number;
  level: RiskLevel;
  size?: number;
  /** Shown under the figure, e.g. "Assessed 3 days ago". */
  caption?: string;
  /**
   * True while the real score is still being computed.
   *
   * The result screen used to pass its *local fallback* score with a
   * "Calculating…" caption, so a full risk figure — a number, a colour and a
   * level — appeared on screen and then changed once the model replied. A
   * wrong risk score sticks with someone even when it is on screen for a
   * second, so the meter now shows no figure at all until there is a real one.
   */
  pending?: boolean;
  style?: StyleProp<ViewStyle>;
};

const LEVEL_META: Record<
  RiskLevel,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  low: { label: "Low risk", icon: "shield-checkmark" },
  moderate: { label: "Moderate risk", icon: "alert-circle" },
  high: { label: "High risk", icon: "warning" },
};

/** Derives the level from a score, so callers can't drift out of sync. */
export function levelFromScore(score: number): RiskLevel {
  if (score < 30) return "low";
  if (score < 60) return "moderate";
  return "high";
}

export function RiskMeter({
  score,
  level,
  size = 180,
  caption,
  pending = false,
  style,
}: RiskMeterProps) {
  const { colors } = useTheme();

  // Nothing is drawn to a value while pending — no arc, no figure, no level.
  const clamped = pending ? 0 : Math.max(0, Math.min(100, score));
  const meta = LEVEL_META[level];

  const tone: Record<RiskLevel, string> = {
    low: colors.riskLow,
    moderate: colors.riskModerate,
    high: colors.riskHigh,
  };
  const accent = tone[level];

  const strokeWidth = 12;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dash = (clamped / 100) * circumference;

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        pending
          ? `Working out your result.${caption ? ` ${caption}.` : ""}`
          : `Your PCOS risk score is ${Math.round(clamped)} out of 100. ${meta.label}.${
              caption ? ` ${caption}.` : ""
            }`
      }
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={colors.sunken}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Value — rotated so the arc starts at 12 o'clock. Not drawn while
              pending: an arc at any length is a claim about the score. */}
          {!pending && (
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={accent}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circumference - dash}`}
              fill="none"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          )}
        </Svg>

        {/* The figure sits inside the ring; hidden from the reader because the
            wrapper already announces the whole result as one sentence. */}
        <View
          style={styles.center}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {pending ? (
            <ActivityIndicator size="large" color={colors.primary} />
          ) : (
            <>
              <Text variant="display" numeric>
                {Math.round(clamped)}
              </Text>
              <Text variant="caption" color="textTertiary">
                out of 100
              </Text>
            </>
          )}
        </View>
      </View>

      {/* No level badge while pending — "Low risk" appearing before the real
          answer is the same wrong claim as a wrong number. */}
      {!pending && (
        <View style={[styles.badge, { backgroundColor: colors.sunken }]}>
          <Ionicons name={meta.icon} size={16} color={accent} />
          <Text variant="bodyStrong" style={{ color: accent }}>
            {meta.label}
          </Text>
        </View>
      )}

      {caption && (
        <Text variant="caption" color="textTertiary">
          {caption}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: spacing.md },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
});
