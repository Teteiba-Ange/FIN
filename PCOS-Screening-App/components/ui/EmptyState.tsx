/**
 * EmptyState — what a screen shows before there is any data.
 *
 * An empty screen should explain why it's empty and offer the action that
 * fills it. Several screens currently render nothing at all in this case.
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, radius, spacing } from "@/theme";
import { Text } from "./Text";
import { Button } from "./Button";

type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onActionPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

export function EmptyState({
  icon = "document-text-outline",
  title,
  description,
  actionLabel,
  onActionPress,
  style,
}: EmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconWell, { backgroundColor: colors.sunken }]}>
        <Ionicons
          name={icon}
          size={26}
          color={colors.textTertiary}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>

      <View style={styles.copy}>
        <Text variant="subhead" center>
          {title}
        </Text>
        {description && (
          <Text variant="callout" color="textSecondary" center>
            {description}
          </Text>
        )}
      </View>

      {actionLabel && onActionPress && (
        <Button
          label={actionLabel}
          onPress={onActionPress}
          variant="secondary"
          size="sm"
          fullWidth={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  iconWell: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: spacing.xs, maxWidth: 320 },
});
