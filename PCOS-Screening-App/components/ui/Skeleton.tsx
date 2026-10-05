/**
 * Skeleton — a placeholder shaped like the content that's loading.
 *
 * The lists in this app currently show either a bare spinner on an empty
 * screen or nothing at all, so the layout jumps when data lands. A skeleton
 * that matches the real row height reserves the space, which is the actual
 * fix — the shimmer is secondary.
 *
 * Hidden from screen readers: the loading state is announced by the container
 * via `accessibilityState={{ busy: true }}`, so reading out placeholder
 * rectangles would only add noise.
 */

import React, { useEffect, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme, radius, spacing } from "@/theme";

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function Skeleton({ width = "100%", height = 14, style }: SkeletonProps) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (reduced) {
        pulse.setValue(0.7);
        return;
      }
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0.5,
            duration: 700,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    });

    return () => loop?.stop();
  }, [pulse]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius.sm,
          backgroundColor: colors.sunken,
          opacity: pulse,
        },
        style,
      ]}
    />
  );
}

/**
 * A stack of skeleton rows shaped like `ListRow` — icon well, two lines of
 * text — for the list screens while their first fetch is in flight.
 */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  const { colors } = useTheme();

  return (
    <View
      accessibilityState={{ busy: true }}
      accessibilityLabel="Loading"
      accessible
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[
            styles.row,
            i > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            },
          ]}
        >
          <Skeleton width={38} height={38} style={styles.well} />
          <View style={styles.lines}>
            <Skeleton width="62%" height={13} />
            <Skeleton width="40%" height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  well: { borderRadius: radius.md },
  lines: { flex: 1, gap: spacing.sm },
});
