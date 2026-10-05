// context/themeContext.tsx
/**
 * Theme provider — resolves the active palette and exposes it to the whole app.
 *
 * Three modes: "light", "dark", and "system" (follows the OS). The choice is
 * persisted; "system" is the default for a fresh install, which is what users
 * expect from a health app they may open at night.
 *
 * `isDark` and `toggleTheme` are kept for the screens that already use them,
 * so this stays a drop-in replacement while screens migrate to `colors`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  darkPalette,
  lightPalette,
  type Palette,
} from "./tokens";

const STORAGE_KEY = "pcos_theme_mode";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextType = {
  /** The resolved palette for the active theme. Use this for every colour. */
  colors: Palette;
  /** The user's stored preference, which may be "system". */
  mode: ThemeMode;
  /** What "system" actually resolved to. True when the app is rendering dark. */
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
  /** Cycles light → dark → light. Kept for the existing settings toggle. */
  toggleTheme: () => void;
  /** False until the stored preference has loaded, to avoid a theme flash. */
  ready: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [ready, setReady] = useState(false);

  // Load the stored preference once on mount.
  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (cancelled) return;
        // Migrate the previous "dark"/"light" string written by the old
        // provider, which used a different key shape but the same values.
        if (isThemeMode(stored)) setModeState(stored);
      })
      .catch(() => {
        // A failed read just means we stay on "system" — not worth surfacing.
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const isDark = mode === "system" ? systemScheme === "dark" : mode === "dark";

  const toggleTheme = useCallback(() => {
    setMode(isDark ? "light" : "dark");
  }, [isDark, setMode]);

  const value = useMemo<ThemeContextType>(
    () => ({
      colors: isDark ? darkPalette : lightPalette,
      mode,
      isDark,
      setMode,
      toggleTheme,
      ready,
    }),
    [isDark, mode, setMode, toggleTheme, ready]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
};
