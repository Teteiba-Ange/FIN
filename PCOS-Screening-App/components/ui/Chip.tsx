/**
 * Chip — a compact label, optionally selectable.
 *
 * Used for symptom selection, tags, and status. Selectable chips announce
 * their selected state rather than signalling it with colour alone.
 */

import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, minTouchTarget, radius, spacing } from "@/theme";
import { Text } from "./Text";

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function Chip({ label, selected = false, onPress, icon, style }: ChipProps) {
  const { colors } = useTheme();

  const body = (
    <View
      style={[
        styles.base,
        {
          backgroundColor: selected ? colors.primarySubtle : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2,
        },
        style,
      ]}
    >
      {/*
        A checkmark on selection, so the state is carried by shape as well as
        by colour — required for colour-blind users and low-contrast settings.
      */}
      {selected && (
        <Ionicons name="checkmark" size={15} color={colors.primary} />
      )}
      {!selected && icon && (
        <Ionicons name={icon} size={15} color={colors.textSecondary} />
      )}
      <Text
        variant="callout"
        color={selected ? "primary" : "textSecondary"}
        style={selected ? styles.selectedLabel : undefined}
      >
        {label}
      </Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      hitSlop={spacing.xs}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: minTouchTarget - 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  selectedLabel: { fontWeight: "600" },
});
