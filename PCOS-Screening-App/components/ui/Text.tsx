/**
 * Text — the only text primitive in the app.
 *
 * Takes a variant from the type scale and a colour name from the palette, so
 * a screen can never invent a font size or a hex value. Replaces the ad-hoc
 * `fontSize` / `color` pairs currently spread across 33 StyleSheets.
 */

import React from "react";
import { Text as RNText, TextProps as RNTextProps, StyleSheet } from "react-native";

import { useTheme, typography as typeScale, tabularNums, type ColorName, type TypographyVariant } from "@/theme";

export type TextProps = RNTextProps & {
  variant?: TypographyVariant;
  color?: ColorName;
  /** Use tabular figures so changing numbers don't shift layout width. */
  numeric?: boolean;
  center?: boolean;
};

export function Text({
  variant = "body",
  color = "textPrimary",
  numeric = false,
  center = false,
  style,
  ...rest
}: TextProps) {
  const { colors } = useTheme();

  return (
    <RNText
      // Let text grow with the OS font-size setting, but cap the multiplier so
      // dense screens don't break apart at the largest accessibility sizes.
      maxFontSizeMultiplier={1.6}
      style={[
        typeScale[variant],
        { color: colors[color] },
        numeric && tabularNums,
        center && styles.center,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  center: { textAlign: "center" },
});
