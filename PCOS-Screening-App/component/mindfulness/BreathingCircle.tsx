// component/mindfulness/BreathingCircle.tsx
// Animated expanding/contracting circle that responds to breathing phase

import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

const TEAL       = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

type Phase = "Inhale" | "Hold" | "Exhale";

interface Props {
  phase: String;
}

const PHASE_CONFIG: Record<Phase, { scale: number; color: string; label: string }> = {
  Inhale: { scale: 1.3,  color: TEAL,        label: "Breathe In"  },
  Hold:   { scale: 1.3,  color: "#8b5cf6",   label: "Hold"        },
  Exhale: { scale: 0.85, color: "#f59e0b",   label: "Breathe Out" },
};

export default function BreathingCircle({ phase }: Props) {
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.7)).current;
  const config      = PHASE_CONFIG[phase] ?? PHASE_CONFIG["Inhale"];

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue:         config.scale,
        friction:        6,
        tension:         40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue:         phase === "Hold" ? 1 : 0.75,
        duration:        600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [phase]);

  return (
    <View style={styles.wrapper}>
      {/* Outer ripple ring */}
      <Animated.View
        style={[
          styles.outerRing,
          {
            borderColor:  config.color + "33",
            transform:    [{ scale: scaleAnim }],
            opacity:      opacityAnim,
          },
        ]}
      />

      {/* Main circle */}
      <Animated.View
        style={[
          styles.circle,
          {
            backgroundColor: config.color,
            transform:       [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={styles.phaseEmoji}>
          {phase === "Inhale" ? "🌬️" : phase === "Hold" ? "🧘" : "😮‍💨"}
        </Text>
        <Text style={styles.phaseLabel}>{config.label}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width:           220,
    height:          220,
    justifyContent:  "center",
    alignItems:      "center",
    marginVertical:  20,
  },

  outerRing: {
    position:     "absolute",
    width:        220,
    height:       220,
    borderRadius: 110,
    borderWidth:  18,
  },

  circle: {
    width:           160,
    height:          160,
    borderRadius:    80,
    justifyContent:  "center",
    alignItems:      "center",
    shadowColor:     "#000",
    shadowOpacity:   0.15,
    shadowRadius:    12,
    elevation:       6,
  },

  phaseEmoji: {
    fontSize:     36,
    marginBottom: 4,
  },

  phaseLabel: {
    color:      "#fff",
    fontWeight: "700",
    fontSize:   14,
  },
});