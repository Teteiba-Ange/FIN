/**
 * ListRow — a navigable row with an icon, label and optional value.
 *
 * The building block for the menu screen and every settings list. Replaces
 * the emoji-and-card grids currently used for navigation.
 */

import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, minTouchTarget, radius, spacing } from "@/theme";
import { Text } from "./Text";

type ListRowProps = {
  label: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Right-hand text, e.g. a current setting value. */
  value?: string;
  onPress?: () => void;
  /** Replaces the chevron — for switches or custom controls. */
  trailing?: React.ReactNode;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ListRow({
  label,
  description,
  icon,
  value,
  onPress,
  trailing,
  destructive = false,
  style,
}: ListRowProps) {
  const { colors } = useTheme();
  const tint = destructive ? colors.danger : colors.textPrimary;

  const content = (
    <View style={[styles.row, style]}>
      {icon && (
        <View
          style={[styles.iconWell, { backgroundColor: colors.primarySubtle }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons
            name={icon}
            size={19}
            color={destructive ? colors.danger : colors.primary}
          />
        </View>
      )}

      <View style={styles.labelGroup}>
        <Text variant="body" style={{ color: tint, fontWeight: "500" }}>
          {label}
        </Text>
        {description && (
          <Text variant="caption" color="textTertiary" numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>

      {value && (
        <Text variant="callout" color="textSecondary" numberOfLines={1}>
          {value}
        </Text>
      )}

      {trailing ??
        (onPress && (
          <Ionicons
            name="chevron-forward"
            size={17}
            color={colors.textTertiary}
          />
        ))}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={description}
      android_ripple={{ color: colors.sunken }}
      style={({ pressed }) => pressed && { backgroundColor: colors.sunken }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: minTouchTarget + 8,
    paddingVertical: spacing.md,
  },
  iconWell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  labelGroup: { flex: 1, gap: 1 },
});
