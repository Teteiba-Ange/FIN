/**
 * Field — a labelled text input.
 *
 * Platform guidance rates placeholder-only inputs as a Critical accessibility
 * failure: the label disappears the moment the user types. Every field here
 * carries a visible label, an accessible name, optional helper text, and an
 * error rendered next to the field rather than collected at the top.
 *
 * Forwards its ref to the underlying TextInput. Without that, `returnKeyType`
 * is decorative — the keyboard shows a "Next" key that does nothing, because
 * there is no handle on the following field to call `.focus()` on. Forms then
 * make the user dismiss the keyboard and tap each field in turn.
 */

import React, { forwardRef, useState } from "react";
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, minTouchTarget, radius, spacing, typography as typeScale } from "@/theme";
import { Text } from "./Text";

type FieldProps = Omit<TextInputProps, "style"> & {
  label: string;
  helper?: string;
  error?: string;
  required?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Renders a show/hide toggle and masks input. */
  secure?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  {
    label,
    helper,
    error,
    required = false,
    icon,
    secure = false,
    containerStyle,
    ...inputProps
  },
  ref
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary
      : colors.border;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text variant="caption" color="textSecondary" style={styles.label}>
        {label}
        {required ? " *" : ""}
      </Text>

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor,
            // Thickens on focus so the state is visible without relying on hue.
            borderWidth: focused || error ? 2 : StyleSheet.hairlineWidth * 2,
          },
        ]}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={colors.textTertiary}
            // Decorative: the visible label already names the field.
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        )}

        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={helper}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={secure && !revealed}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          style={[styles.input, typeScale.body, { color: colors.textPrimary }]}
          {...inputProps}
        />

        {secure && (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={spacing.md}
          >
            <Ionicons
              name={revealed ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
      </View>

      {/*
        Error takes precedence over helper — showing both stacks two lines of
        small text under the field and buries the thing the user must act on.
      */}
      {error ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text variant="caption" style={{ color: colors.danger, flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : helper ? (
        <Text variant="caption" color="textTertiary" style={styles.helper}>
          {helper}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { letterSpacing: 0.2 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: minTouchTarget + 6,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, paddingVertical: spacing.md },
  message: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  helper: { paddingHorizontal: spacing.xs },
});
