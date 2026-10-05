/**
 * theme/tokens.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * The single source of truth for every visual value in the app.
 *
 * Rule: no screen or component writes a raw hex, a raw font size, or a raw
 * spacing number. Everything comes from here, so the app has one visual
 * language instead of thirty-five.
 *
 * Direction: "clinical calm" — quiet, precise, trustworthy. Hierarchy is
 * carried by type and whitespace, not by stacking rounded cards.
 */

import { Platform, TextStyle } from "react-native";

// ─── Palette ─────────────────────────────────────────────────────────────────
// Semantic names only. `primary` keeps the existing brand teal so the app
// still feels like itself after the redesign.

export const lightPalette = {
  bg: "#fbfcfc",
  surface: "#ffffff",
  sunken: "#f1f5f4",

  textPrimary: "#10201f",
  textSecondary: "#4d6462",
  /**
   * Darkened from #7b908e, which measured 3.35:1 on `bg` — under the 4.5:1
   * required for the 12px caption and label variants it is paired with
   * throughout. This clears 4.75:1. The dark equivalent below already passes.
   */
  textTertiary: "#5f7573",

  border: "#e3eae8",
  borderStrong: "#cbd8d5",

  primary: "#1f7a7a",
  primaryPressed: "#175f5f",
  primarySubtle: "#e8f2f1",
  onPrimary: "#ffffff",

  /**
   * Risk states are deliberately separate from the brand ramp — a risk level
   * must never read as "the app's accent colour". Each is paired with a label
   * and an icon at the component level so meaning never rests on colour alone.
   */
  riskLow: "#1f6b4d",
  riskLowSubtle: "#e7f2ec",
  riskModerate: "#9a6212",
  riskModerateSubtle: "#f9f0df",
  riskHigh: "#b02a25",
  riskHighSubtle: "#fbeae9",

  danger: "#b02a25",
  dangerSubtle: "#fbeae9",
  onDanger: "#ffffff",

  /** Overlay behind modals and sheets. */
  scrim: "rgba(10, 26, 25, 0.45)",
};

export const darkPalette: typeof lightPalette = {
  bg: "#0b1413",
  surface: "#121e1d",
  sunken: "#0e1817",

  textPrimary: "#e6efed",
  textSecondary: "#a3b7b4",
  textTertiary: "#7e918e",

  border: "#22322f",
  borderStrong: "#31453f",

  primary: "#4dada7",
  primaryPressed: "#3d908b",
  primarySubtle: "#16302e",
  onPrimary: "#06201f",

  // Lightened so normal-size text still clears 4.5:1 on the dark ground.
  riskLow: "#63c294",
  riskLowSubtle: "#10261e",
  riskModerate: "#dcb45c",
  riskModerateSubtle: "#2a2110",
  riskHigh: "#f08a84",
  riskHighSubtle: "#2c1616",

  danger: "#f08a84",
  dangerSubtle: "#2c1616",
  onDanger: "#2c1616",

  scrim: "rgba(0, 0, 0, 0.6)",
};

export type Palette = typeof lightPalette;
export type ColorName = keyof Palette;

// ─── Spacing ─────────────────────────────────────────────────────────────────
// 4-based. The current app mixes 2, 4, 6, 8, 10, 14, 16, 18, 20, 24 with no
// system; this is the whole set.

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// ─── Radius ──────────────────────────────────────────────────────────────────
// Deliberately tighter and more varied than the current uniform 16–20, so
// radius can signal hierarchy instead of being wallpaper.

export const radius = {
  none: 0,
  sm: 8,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

// ─── Typography ──────────────────────────────────────────────────────────────
// Scale: 12 / 13 / 15 / 17 / 20 / 26 / 34, each with a fixed line-height.
// Body is 15/22. Nothing sits below 12 — the current app uses 11px in several
// places, which is under the readable minimum on a phone.

export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: "700" },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "700" },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: "600" },
  subhead: { fontSize: 17, lineHeight: 24, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
  callout: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  /** Uppercase eyebrow labels. Tracking is what makes small caps legible. */
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/**
 * Tabular figures, so numbers in columns and counters don't shift width as
 * they change. Used by Stat, RiskMeter and anything showing a live count.
 */
export const tabularNums: TextStyle = {
  fontVariant: ["tabular-nums"],
};

// ─── Elevation ───────────────────────────────────────────────────────────────
// Three levels, no more. Android uses `elevation`; iOS uses shadow props.

export const elevation = {
  none: Platform.select({
    ios: {},
    android: { elevation: 0 },
    default: {},
  }),
  low: Platform.select({
    ios: {
      shadowColor: "#0a1a19",
      shadowOpacity: 0.06,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 1 },
    default: {},
  }),
  medium: Platform.select({
    ios: {
      shadowColor: "#0a1a19",
      shadowOpacity: 0.1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 3 },
    default: {},
  }),
} as const;

// ─── Touch ───────────────────────────────────────────────────────────────────
// iOS wants 44pt, Android wants 48dp. Collapsing them into one number is
// explicitly called out as wrong by the platform guidance, so we don't.

export const minTouchTarget = Platform.select({
  ios: 44,
  android: 48,
  default: 44,
}) as number;

/** Minimum gap between adjacent touch targets. */
export const touchGap = spacing.sm;

// ─── Motion ──────────────────────────────────────────────────────────────────
// Exit is shorter than enter so dismissal feels responsive.

export const duration = {
  press: 100,
  enter: 220,
  exit: 150,
} as const;
