// features/mindfulness/components/BreathingCircle.tsx
/**
 * The animated circle that paces the breath.
 *
 * Changes from the previous version:
 *
 *   - Colours come from the theme. It previously hardcoded #1f7a7a, #4a6a86
 *     and #8a6a3d, so the circle stayed light-mode teal on a dark screen and
 *     the phase colours were three unrelated hues from nowhere in the system.
 *   - Reduced motion is honoured. `RiskMeter`'s comment claims the app does
 *     this; nothing actually did. A large element pulsing continuously is
 *     precisely what the setting exists to suppress — under it, the circle
 *     changes size in one step instead of springing.
 *   - It can be paused, so the animation matches the session state instead of
 *     continuing to breathe at a user who has stopped.
 */

import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useTheme, radius } from "@/theme";

export type Phase = "inhale" | "hold" | "exhale";

interface Props {
  phase: Phase;
  paused?: boolean;
}

const SCALE: Record<Phase, number> = {
  inhale: 1.28,
  hold: 1.28,
  exhale: 0.84,
};

const ICON: Record<Phase, keyof typeof Ionicons.glyphMap> = {
  inhale: "arrow-up",
  hold: "pause",
  exhale: "arrow-down",
};

export default function BreathingCircle({ phase, paused = false }: Props) {
  const { colors } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const ringOpacity = useRef(new Animated.Value(0.6)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const target = SCALE[phase];

    if (reduceMotion) {
      // Step, don't animate. The countdown and the phase label still carry
      // the pacing, so nothing is lost by holding the circle still.
      scale.setValue(target);
      ringOpacity.setValue(phase === "hold" ? 0.9 : 0.6);
      return;
    }

    const animation = Animated.parallel([
      Animated.spring(scale, {
        toValue: target,
        friction: 7,
        tension: 34,
        useNativeDriver: true,
      }),
      Animated.timing(ringOpacity, {
        toValue: phase === "hold" ? 0.9 : 0.6,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [phase, reduceMotion, scale, ringOpacity]);

  return (
    <View
      style={styles.wrapper}
      // The screen announces the phase and the countdown; the circle is the
      // visual channel for the same information.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          styles.ring,
          {
            borderColor: colors.primarySubtle,
            opacity: paused ? 0.3 : ringOpacity,
            transform: [{ scale }],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.circle,
          {
            backgroundColor: colors.primary,
            opacity: paused ? 0.45 : 1,
            transform: [{ scale }],
          },
        ]}
      >
        <Ionicons
          name={paused ? "pause" : ICON[phase]}
          size={28}
          color={colors.onPrimary}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 220,
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  ring: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: radius.pill,
    borderWidth: 16,
  },
  circle: {
    width: 150,
    height: 150,
    borderRadius: radius.pill,
    justifyContent: "center",
    alignItems: "center",
  },
});
