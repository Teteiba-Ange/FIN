/**
 * OptionGroup — single- or multi-select for the assessment steps.
 *
 * Steps 2, 3 and 4 each hand-rolled their own selectable tiles: emoji cards in
 * a two-column grid, pill rows, and a bespoke dropdown, all with different
 * selected states and none with accessible semantics.
 *
 * Two layouts:
 *   list  — a labelled row per option, for choices that need explanation
 *   chips — wrapped pills, for short mutually-understood values
 *
 * Selection is announced through radio/checkbox roles, and shown with a mark
 * as well as colour so it survives a colour-blind or high-contrast setting.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Text, Chip } from "@/components/ui";
import { useTheme, spacing, radius, minTouchTarget } from "@/theme";

export type Option = {
  value: string;
  label: string;
  description?: string;
};

type BaseProps = {
  label: string;
  options: Option[];
  layout?: "list" | "chips";
  required?: boolean;
  hint?: string;
  error?: string;
};

type SingleProps = BaseProps & {
  multiple?: false;
  value: string | null;
  onChange: (value: string) => void;
};

type MultipleProps = BaseProps & {
  multiple: true;
  value: string[];
  onChange: (value: string[]) => void;
};

export function OptionGroup(props: SingleProps | MultipleProps) {
  const { label, options, layout = "list", required, hint, error } = props;
  const { colors } = useTheme();

  const isSelected = (v: string) =>
    props.multiple ? props.value.includes(v) : props.value === v;

  const handlePress = (v: string) => {
    if (props.multiple) {
      const next = props.value.includes(v)
        ? props.value.filter((x) => x !== v)
        : [...props.value, v];
      props.onChange(next);
    } else {
      props.onChange(v);
    }
  };

  return (
    <View style={styles.group}>
      <Text variant="caption" color="textSecondary">
        {label}
        {required ? " *" : ""}
      </Text>

      {layout === "chips" ? (
        <View style={styles.chips}>
          {options.map((o) => (
            <Chip
              key={o.value}
              label={o.label}
              selected={isSelected(o.value)}
              onPress={() => handlePress(o.value)}
            />
          ))}
        </View>
      ) : (
        <View
          style={[styles.list, { borderColor: colors.border }]}
          accessibilityRole={props.multiple ? undefined : "radiogroup"}
        >
          {options.map((o, i) => {
            const selected = isSelected(o.value);
            return (
              <Pressable
                key={o.value}
                onPress={() => handlePress(o.value)}
                accessibilityRole={props.multiple ? "checkbox" : "radio"}
                accessibilityLabel={o.label}
                accessibilityHint={o.description}
                accessibilityState={
                  props.multiple ? { checked: selected } : { selected }
                }
                android_ripple={{ color: colors.sunken }}
                style={({ pressed }) => [
                  styles.row,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                  selected && { backgroundColor: colors.primarySubtle },
                  pressed && !selected && { backgroundColor: colors.sunken },
                ]}
              >
                <View style={styles.rowText}>
                  <Text
                    variant="body"
                    color={selected ? "primary" : "textPrimary"}
                    style={selected ? styles.selectedLabel : undefined}
                  >
                    {o.label}
                  </Text>
                  {o.description && (
                    <Text variant="caption" color="textTertiary">
                      {o.description}
                    </Text>
                  )}
                </View>

                <Ionicons
                  name={
                    props.multiple
                      ? selected
                        ? "checkbox"
                        : "square-outline"
                      : selected
                        ? "radio-button-on"
                        : "radio-button-off"
                  }
                  size={21}
                  color={selected ? colors.primary : colors.textTertiary}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      {error ? (
        <View style={styles.message} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text variant="caption" style={{ color: colors.danger, flex: 1 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text variant="caption" color="textTertiary">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  list: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    minHeight: minTouchTarget + 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1, gap: 1 },
  selectedLabel: { fontWeight: "600" },
  message: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
});
