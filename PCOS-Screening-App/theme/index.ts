/**
 * The theme module — design tokens and the provider that resolves them.
 *
 *   import { useTheme, spacing, typography } from "@/theme";
 */

export * from "./tokens";
export { ThemeProvider, useTheme, type ThemeMode } from "./themeContext";
