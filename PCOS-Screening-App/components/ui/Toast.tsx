/**
 * Toast — transient confirmation, replacing `Alert.alert` for success messages.
 *
 * Six screens currently use a blocking modal to say "Saved". A modal is the
 * heaviest UI the platform offers and it interrupts the thing the user was
 * doing to tell them it worked. This says the same thing without taking the
 * screen away.
 *
 * `Alert` is still correct for destructive confirmations — those *should*
 * block, because the user is about to lose something.
 *
 * Usage:
 *   const toast = useToast();
 *   toast.show("Symptom logged");
 *   toast.show("Couldn't save — we'll retry", { tone: "error" });
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, duration, elevation, radius, spacing } from "@/theme";
import { Text } from "./Text";

type Tone = "success" | "error" | "info";

type ToastOptions = {
  tone?: Tone;
  /** Milliseconds on screen. Errors default to longer — they need reading. */
  durationMs?: number;
};

type ToastContextValue = {
  show: (message: string, options?: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextValue>({ show: () => {} });

const ICONS: Record<Tone, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [toast, setToast] = useState<{ message: string; tone: Tone } | null>(
    null
  );
  const opacity = useRef(new Animated.Value(0)).current;
  const lift = useRef(new Animated.Value(12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      reduceMotion.current = on;
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (on) => {
        reduceMotion.current = on;
      }
    );
    return () => sub.remove();
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: reduceMotion.current ? 0 : duration.exit,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(lift, {
        toValue: 12,
        duration: reduceMotion.current ? 0 : duration.exit,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }, [opacity, lift]);

  const show = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const tone = options.tone ?? "success";
      const ms = options.durationMs ?? (tone === "error" ? 4000 : 2400);

      if (timer.current) clearTimeout(timer.current);
      setToast({ message, tone });

      opacity.setValue(0);
      lift.setValue(12);
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: reduceMotion.current ? 0 : duration.enter,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(lift, {
          toValue: 0,
          duration: reduceMotion.current ? 0 : duration.enter,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();

      timer.current = setTimeout(hide, ms);
    },
    [opacity, lift, hide]
  );

  const tint =
    toast?.tone === "error"
      ? colors.danger
      : toast?.tone === "info"
        ? colors.textSecondary
        : colors.riskLow;

  return (
    <ToastContext.Provider value={{ show }}>
      {children}

      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.host,
            {
              // Clear the tab bar on the screens that have one.
              bottom: insets.bottom + spacing.xxxl + spacing.lg,
              opacity,
              transform: [{ translateY: lift }],
            },
          ]}
        >
          <View
            style={[
              styles.toast,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
          >
            <Ionicons name={ICONS[toast.tone]} size={18} color={tint} />
            <Text variant="callout" style={styles.message} numberOfLines={2}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: "100%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    ...Platform.select({
      ios: elevation.medium,
      android: elevation.medium,
      default: {},
    }),
  },
  message: { flexShrink: 1 },
});
