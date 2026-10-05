/**
 * TrendChart — a small line chart for a series of scores over time.
 *
 * Drawn with react-native-svg rather than react-native-chart-kit so it can be
 * themed from tokens and given a proper accessible summary. Charts alone are
 * invisible to a screen reader; this one announces its own shape and always
 * has a readable caption beside it.
 *
 * It refuses to draw a trend from a single point — a one-point "trend" is how
 * the previous screen ended up inventing five months of history.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Line, Stop } from "react-native-svg";

import { useTheme, spacing } from "@/theme";
import { Text } from "./Text";

export type TrendPoint = {
  /** 0–100. */
  value: number;
  /** ISO timestamp. */
  at: string;
};

type TrendChartProps = {
  points: TrendPoint[];
  height?: number;
  /** Accessible description of what the series represents. */
  label: string;
};

const PAD = 10;

export function TrendChart({ points, height = 140, label }: TrendChartProps) {
  const { colors } = useTheme();
  const [width, setWidth] = React.useState(0);

  if (points.length < 2) return null;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Keep a flat series visually centred rather than pinned to an edge.
  const span = max - min < 5 ? 5 : max - min;
  const base = max - min < 5 ? (min + max) / 2 - 2.5 : min;

  const innerW = Math.max(width - PAD * 2, 1);
  const innerH = height - PAD * 2;

  const x = (i: number) => PAD + (i / (points.length - 1)) * innerW;
  const y = (v: number) => PAD + innerH - ((v - base) / span) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
  const areaPath = `${path} L ${x(points.length - 1).toFixed(1)} ${(
    height - PAD
  ).toFixed(1)} L ${x(0).toFixed(1)} ${(height - PAD).toFixed(1)} Z`;

  const first = values[0];
  const last = values[values.length - 1];
  const delta = last - first;
  const direction = delta > 2 ? "risen" : delta < -2 ? "fallen" : "stayed about the same";

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${label}. ${points.length} assessments, from ${Math.round(
        first
      )} to ${Math.round(last)} out of 100. Your score has ${direction}.`}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.primary} stopOpacity={0.28} />
              <Stop offset="1" stopColor={colors.primary} stopOpacity={0.02} />
            </LinearGradient>
          </Defs>
          {/* A single mid-line for reference — a full grid competes with the data. */}
          <Line
            x1={PAD}
            y1={PAD + innerH / 2}
            x2={width - PAD}
            y2={PAD + innerH / 2}
            stroke={colors.border}
            strokeWidth={1}
          />

          <Path
            d={areaPath}
            fill="url(#trendFill)"
          />

          <Path
            d={path}
            stroke={colors.primary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {points.map((p, i) => {
            const isLast = i === points.length - 1;
            return (
              <Circle
                key={p.at + i}
                cx={x(i)}
                cy={y(p.value)}
                // The most recent point is emphasised; it's the one that matters.
                r={isLast ? 5 : 3}
                fill={isLast ? colors.primary : colors.surface}
                stroke={colors.primary}
                strokeWidth={2}
              />
            );
          })}
        </Svg>
      )}

      <View style={styles.axis}>
        <Text variant="caption" color="textTertiary">
          {new Date(points[0].at).toLocaleDateString(undefined, {
            month: "short",
            year: "2-digit",
          })}
        </Text>
        <Text variant="caption" color="textTertiary">
          Now
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: "100%" },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
});
