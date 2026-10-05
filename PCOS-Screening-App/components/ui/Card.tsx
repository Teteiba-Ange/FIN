/**
 * Card — one card, three weights.
 *
 * Replaces the nine separate card styles on the home screen alone. The point
 * of having exactly three variants is hierarchy: when every block is a
 * 16px-radius white card, nothing reads as more important than anything else.
 *
 *   plain   — the default container, hairline border, no shadow
 *   raised  — lifted off the page; use sparingly, for the one thing that matters
 *   sunken  — recedes; for supporting or secondary content
 */

import React from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useTheme, elevation, radius, spacing } from "@/theme";

type Variant = "plain" | "raised" | "sunken";

type CardProps = {
  children: React.ReactNode;
  variant?: Variant;
  /** Providing onPress makes the card a button, with the semantics to match. */
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({
  children,
  variant = "plain",
  onPress,
  accessibilityLabel,
  accessibilityHint,
  padded = true,
  style,
}: CardProps) {
  const { colors } = useTheme();

  const tone: Record<Variant, ViewStyle> = {
    plain: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth * 2,
    },
    raised: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderWidth: StyleSheet.hairlineWidth,
      ...elevation.medium,
    },
    sunken: {
      backgroundColor: colors.sunken,
      borderColor: "transparent",
    },
  };

  const body = (
    <Animated.View
      entering={FadeInDown.duration(360)}
      style={[styles.base, tone[variant], padded && styles.padded, style]}
    >
      {children}
    </Animated.View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg },
  padded: { padding: spacing.xl },
  // A slight recede rather than an opacity fade — reads as pressure, not a flicker.
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
});
