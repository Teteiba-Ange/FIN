/**
 * Button — every tappable action in the app.
 *
 * Replaces the bespoke TouchableOpacity + Text pairs on almost every screen.
 * Uses Pressable (not TouchableOpacity) so Android gets a ripple and both
 * platforms get a real pressed state rather than a blanket opacity fade.
 *
 * Guarantees, per platform accessibility guidance:
 *   - minimum 44pt (iOS) / 48dp (Android) hit area
 *   - accessibilityRole="button" and a resolved accessible name
 *   - disabled and loading states are announced, not just drawn
 */

import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useTheme, minTouchTarget, radius, spacing, type ColorName, } from "@/theme";
import { Text } from "./Text";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "leading" | "trailing";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** Overrides the visible label for screen readers when it needs more context. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

const HEIGHTS: Record<Size, number> = {
  sm: minTouchTarget,
  md: 50,
  lg: 56,
};

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "leading",
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityLabel,
  accessibilityHint,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const isInert = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const surface: Record<Variant, { idle: string; pressed: string; border?: string }> = {
    primary: { idle: colors.primary, pressed: colors.primaryPressed },
    secondary: {
      idle: colors.surface,
      pressed: colors.sunken,
      border: colors.borderStrong,
    },
    ghost: { idle: "transparent", pressed: colors.sunken },
    danger: { idle: colors.danger, pressed: colors.danger },
  };

  const labelColor: Record<Variant, ColorName> = {
    primary: "onPrimary",
    secondary: "textPrimary",
    ghost: "primary",
    danger: "onDanger",
  };

  const tone = surface[variant];
  const contentColor = colors[labelColor[variant]];

  return (
    <Animated.View style={animatedStyle}>
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.97, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 260 });
      }}
      disabled={isInert}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInert, busy: loading }}
      android_ripple={
        variant === "ghost" ? { color: colors.primarySubtle } : undefined
      }
      style={({ pressed }) => [
        styles.base,
        {
          height: HEIGHTS[size],
          backgroundColor: pressed && !isInert ? tone.pressed : tone.idle,
          borderColor: tone.border ?? "transparent",
          borderWidth: tone.border ? StyleSheet.hairlineWidth * 2 : 0,
          opacity: isInert ? 0.45 : 1,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: fullWidth ? spacing.lg : spacing.xl,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === "leading" && (
            <Ionicons name={icon} size={18} color={contentColor} />
          )}
          <Text
            variant={size === "sm" ? "callout" : "bodyStrong"}
            style={{ color: contentColor }}
            numberOfLines={1}
          >
            {label}
          </Text>
          {icon && iconPosition === "trailing" && (
            <Ionicons name={icon} size={18} color={contentColor} />
          )}
        </View>
      )}
    </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
