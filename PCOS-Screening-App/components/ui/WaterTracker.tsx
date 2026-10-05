import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { useTheme, radius, spacing } from "@/theme";
import { Text } from "./Text";

type WaterTrackerProps = { value: number; goal: number; onAdd: () => void };
const GLASS_HEIGHT = 142;

export function WaterTracker({ value, goal, onAdd }: WaterTrackerProps) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const bounce = useSharedValue(1);
  const shimmer = useSharedValue(0);
  const complete = value >= goal;

  useEffect(() => {
    progress.value = withSpring(value / goal, { damping: 16, stiffness: 110 });
    if (value > 0) {
      bounce.value = withSequence(
        withSpring(1.08, { damping: 9, stiffness: 260 }),
        withSpring(1, { damping: 12, stiffness: 210 })
      );
      shimmer.value = 0;
      shimmer.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) });
    }
  }, [bounce, goal, progress, shimmer, value]);

  const glassStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bounce.value }],
  }));
  const fillStyle = useAnimatedStyle(() => ({
    height: interpolate(progress.value, [0, 1], [8, GLASS_HEIGHT - 8]),
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 0.25, 1], [0, 0.5, 0]),
    transform: [
      { translateY: interpolate(shimmer.value, [0, 1], [GLASS_HEIGHT, -40]) },
      { rotate: "-12deg" },
    ],
  }));

  const add = () => !complete && onAdd();

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={add}
        disabled={complete}
        accessibilityRole="button"
        accessibilityLabel={complete ? `Hydration goal complete. ${value} of ${goal} glasses.` : `Add a glass of water. ${value} of ${goal} logged today.`}
        style={styles.visualButton}
      >
        <Animated.View style={[styles.glass, { borderColor: colors.primary }, glassStyle]}>
          <Animated.View style={[styles.water, { backgroundColor: colors.primary }, fillStyle]}>
            <View style={[styles.wave, { backgroundColor: colors.primarySubtle }]} />
            {value > 0 && (
              <Animated.View key={value} entering={FadeInUp.duration(650)} style={styles.bubbles}>
                <View style={[styles.bubble, styles.bubbleOne]} />
                <View style={[styles.bubble, styles.bubbleTwo]} />
                <View style={[styles.bubble, styles.bubbleThree]} />
              </Animated.View>
            )}
            <Animated.View style={[styles.shimmer, shimmerStyle]} />
          </Animated.View>
          <View style={styles.glassLabel}>
            <Text variant="display" numeric style={{ color: complete ? colors.onPrimary : colors.textPrimary }}>{value}</Text>
            <Text variant="caption" style={{ color: complete ? colors.onPrimary : colors.textSecondary }}>of {goal}</Text>
          </View>
        </Animated.View>
        <View style={[styles.base, { backgroundColor: colors.primarySubtle }]} />
      </Pressable>

      <View style={styles.copy}>
        <View style={styles.titleRow}>
          <Ionicons name={complete ? "sparkles" : "water"} size={22} color={complete ? colors.riskModerate : colors.primary} />
          <Text variant="subhead">{complete ? "Goal crushed!" : value === 0 ? "Start hydrating" : "Keep it flowing"}</Text>
        </View>
        <Text variant="callout" color="textSecondary">
          {complete ? "Eight glasses logged today. Beautiful work." : `${goal - value} ${goal - value === 1 ? "glass" : "glasses"} left in today’s goal.`}
        </Text>
        <Pressable
          onPress={add}
          disabled={complete}
          accessibilityRole="button"
          accessibilityLabel={complete ? "Hydration goal complete" : "Add one glass"}
          style={({ pressed }) => [styles.addButton, { backgroundColor: complete ? colors.primarySubtle : colors.primary }, pressed && !complete && styles.pressed]}
        >
          <Ionicons name={complete ? "checkmark-circle" : "add"} size={20} color={complete ? colors.primary : colors.onPrimary} />
          <Text variant="bodyStrong" style={{ color: complete ? colors.primary : colors.onPrimary }}>
            {complete ? "Done for today" : "Pour a glass"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flexDirection: "row", alignItems: "center", gap: spacing.xl },
  visualButton: { width: 106, alignItems: "center", paddingTop: spacing.sm },
  glass: { width: 88, height: GLASS_HEIGHT, borderWidth: 3, borderTopWidth: 1, borderRadius: 18, borderTopLeftRadius: 10, borderTopRightRadius: 10, overflow: "hidden", justifyContent: "flex-end" },
  water: { position: "absolute", left: 0, right: 0, bottom: 0, overflow: "hidden" },
  wave: { position: "absolute", width: 110, height: 18, borderRadius: radius.pill, top: -9, left: -12, opacity: 0.45 },
  bubbles: { ...StyleSheet.absoluteFillObject },
  bubble: { position: "absolute", width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.78)" },
  bubbleOne: { left: 17, bottom: 18 },
  bubbleTwo: { right: 19, bottom: 42, width: 11, height: 11, borderRadius: 6 },
  bubbleThree: { left: 39, bottom: 72, width: 6, height: 6 },
  shimmer: { position: "absolute", width: 24, height: 190, left: 24, backgroundColor: "rgba(255,255,255,0.7)" },
  glassLabel: { flex: 1, alignItems: "center", justifyContent: "center", zIndex: 2 },
  base: { width: 104, height: 8, borderRadius: radius.pill, marginTop: spacing.sm },
  copy: { flex: 1, gap: spacing.sm },
  titleRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  addButton: { minHeight: 48, marginTop: spacing.sm, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.lg },
  pressed: { transform: [{ scale: 0.97 }] },
});
