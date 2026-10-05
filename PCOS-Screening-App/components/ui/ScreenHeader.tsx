/**
 * ScreenHeader — the title bar for every screen.
 *
 * Replaces both `component/backHeader.tsx` and the handful of screens using
 * the native Stack header, which is why chrome currently changes as you move
 * through the app. One header, used everywhere.
 */

import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { useTheme, minTouchTarget, radius, spacing } from "@/theme";
import { Text } from "./Text";

type Action = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
};

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Shows a back control. Defaults to true when the router can go back. */
  showBack?: boolean;
  onBack?: () => void;
  action?: Action;
  style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
  title,
  subtitle,
  showBack = true,
  onBack,
  action,
  style,
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();

  const canGoBack = showBack && (onBack != null || router.canGoBack());
  const lowerTitle = title.toLowerCase();
  const headerIcon: keyof typeof Ionicons.glyphMap = lowerTitle.includes("cycle")
    ? "calendar-outline"
    : lowerTitle.includes("mind") || lowerTitle.includes("session")
      ? "leaf-outline"
      : lowerTitle.includes("community")
        ? "chatbubbles-outline"
        : lowerTitle.includes("trend") || lowerTitle.includes("result")
          ? "analytics-outline"
          : lowerTitle.includes("profile")
            ? "person-outline"
            : lowerTitle.includes("setting") || lowerTitle.includes("privacy")
              ? "shield-checkmark-outline"
              : lowerTitle.includes("reading")
                ? "book-outline"
                : "sparkles-outline";

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.primarySubtle, borderColor: colors.border },
        style,
      ]}
    >
      <View style={styles.row}>
        {canGoBack && (
          <Pressable
            onPress={onBack ?? (() => router.back())}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={spacing.sm}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && { backgroundColor: colors.sunken },
            ]}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </Pressable>
        )}

        <View style={[styles.titleIcon, { backgroundColor: colors.surface }]}>
          <Ionicons name={headerIcon} size={19} color={colors.primary} />
        </View>

        <View style={styles.titleGroup}>
          <Text variant="title" accessibilityRole="header" numberOfLines={2}>
            {title}
          </Text>
        </View>

        {action && (
          <Pressable
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            hitSlop={spacing.sm}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && { backgroundColor: colors.sunken },
            ]}
          >
            <Ionicons name={action.icon} size={22} color={colors.textPrimary} />
          </Pressable>
        )}
      </View>

      {subtitle && (
        <Text
          variant="body"
          color="textSecondary"
          style={[
            styles.subtitle,
            { paddingLeft: (canGoBack ? minTouchTarget + spacing.sm : 0) + 42 + spacing.sm },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  titleGroup: { flex: 1 },
  titleIcon: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: minTouchTarget / 2,
    // Pull the icon flush with the screen's content edge — the touch target
    // stays full size, but the glyph aligns with the text below it.
  },
  subtitle: { maxWidth: "95%" },
});
