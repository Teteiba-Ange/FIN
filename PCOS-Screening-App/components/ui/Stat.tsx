/**
 * Stat — a single labelled figure, with an optional change indicator.
 *
 * Used across trends and the dashboard. Figures use tabular numerals so a
 * changing value doesn't shift the layout around it, and any trend direction
 * is carried by an arrow as well as by colour.
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, spacing } from "@/theme";
import { Text } from "./Text";

type Trend = "up" | "down" | "flat";

type StatProps = {
  label: string;
  value: string;
  unit?: string;
  trend?: Trend;
  /** The change itself, e.g. "+2 days". */
  delta?: string;
  /**
   * Whether an upward trend is good. For cycle regularity a rise may be
   * unwelcome, so the colour cannot be inferred from direction alone.
   */
  upIsGood?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Stat({
  label,
  value,
  unit,
  trend,
  delta,
  upIsGood = true,
  style,
}: StatProps) {
  const { colors } = useTheme();

  const trendIcon: Record<Trend, keyof typeof Ionicons.glyphMap> = {
    up: "arrow-up",
    down: "arrow-down",
    flat: "remove",
  };

  const trendColor =
    trend == null || trend === "flat"
      ? colors.textTertiary
      : (trend === "up") === upIsGood
        ? colors.riskLow
        : colors.riskModerate;

  // One announcement for the whole group, so a screen reader says
  // "Average cycle, 31 days, up 2 days" instead of three disconnected items.
  const announcement = [label, `${value}${unit ? ` ${unit}` : ""}`, delta]
    .filter(Boolean)
    .join(", ");

  return (
    <View
      style={[styles.container, style]}
      accessible
      accessibilityLabel={announcement}
    >
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>

      <View style={styles.valueRow}>
        <Text variant="title" numeric>
          {value}
        </Text>
        {unit && (
          <Text variant="callout" color="textSecondary" style={styles.unit}>
            {unit}
          </Text>
        )}
      </View>

      {trend && delta && (
        <View style={styles.trendRow}>
          <Ionicons name={trendIcon[trend]} size={13} color={trendColor} />
          <Text variant="caption" style={{ color: trendColor }} numeric>
            {delta}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 2 },
  valueRow: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs },
  unit: { paddingBottom: 2 },
  trendRow: { flexDirection: "row", alignItems: "center", gap: 3 },
});
