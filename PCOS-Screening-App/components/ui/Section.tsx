/**
 * Section — a titled block of content, with an optional action on the right.
 *
 * Replaces the repeated `sectionTitle` + "View All" row pattern. Using a
 * heading role means screen readers can jump between sections instead of
 * reading every screen top to bottom.
 */

import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, radius, spacing } from "@/theme";
import { Text } from "./Text";

type SectionProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Section({
  title,
  subtitle,
  actionLabel,
  onActionPress,
  children,
  style,
}: SectionProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <View style={styles.headingRow}>
            <View style={[styles.accent, { backgroundColor: colors.primary }]} />
            <Text variant="subhead" accessibilityRole="header">{title}</Text>
          </View>
          {subtitle && (
            <Text variant="callout" color="textSecondary">
              {subtitle}
            </Text>
          )}
        </View>

        {actionLabel && onActionPress && (
          <Pressable
            onPress={onActionPress}
            accessibilityRole="button"
            accessibilityLabel={`${actionLabel}, ${title}`}
            hitSlop={spacing.md}
            style={styles.action}
          >
            <Text variant="callout" color="primary" style={styles.actionText}>
              {actionLabel}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  titleGroup: { flex: 1, gap: 2 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  accent: { width: 4, height: 20, borderRadius: radius.pill },
  action: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionText: { fontWeight: "600" },
});
