import React, { useEffect, useState } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import BreathingCircle from "../../../component/mindfulness/BreathingCircle";

const TEAL = "#1f7a7a";

const PHASES = ["Inhale", "Hold", "Exhale"] as const;
type Phase = "inhale" | "hold" | "exhale";

export default function BreathingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const inhale = Number(params.inhale);
  const hold = Number(params.hold);
  const exhale = Number(params.exhale);
  const title = String(params.title);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [seconds, setSeconds] = useState(inhale);
  const [cycles, setCycles] = useState(0);
  const [completed, setCompleted] = useState(false);
  const phase = PHASES[phaseIndex].toLowerCase() as Phase;

  useEffect(() => {
    if (completed) return;
    const timer = setTimeout(() => {
      if (seconds > 1) {
        setSeconds(seconds - 1);
      } else {
        if (phaseIndex === 0) {
          if (hold > 0) {
            setPhaseIndex(1);
            setSeconds(hold);
          } else {
            setPhaseIndex(2);
            setSeconds(exhale);
          }
        } else if (phaseIndex === 1) {
          setPhaseIndex(2);
          setSeconds(exhale);
        } else {
          if (cycles >= 4) {
            setCompleted(true);
          } else {
            setCycles(cycles + 1);
            setPhaseIndex(0);
            setSeconds(inhale);
          }
        }
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [seconds, phaseIndex, completed, cycles, inhale, hold, exhale]);

  useEffect(() => {
    if (completed) {
      setTimeout(() => {
        router.replace("/(drawer)/mindfulness/completion");
      }, 1000);
    }
  }, [completed]);

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── Header with Back Button ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* 🔽 Convert phase to lowercase to match the component's expected prop */}
        <BreathingCircle phase={phase.toLowerCase()} />
        <Text style={styles.countdown}>{seconds}</Text>
        <Text style={styles.subtitle}>{phase}</Text>
        <Text style={styles.cycles}>Cycle {cycles + 1} of 5</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.stopButton, { backgroundColor: "#ef4444" }]}
            onPress={() => router.back()}
          >
            <Text style={styles.stopText}>End Session</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.stopButton, { backgroundColor: "#6b7280" }]}
            onPress={() => router.replace("/(drawer)/mindfulness")}
          >
            <Text style={styles.stopText}>Skip Session</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backBtn: { width: 40, height: 40, justifyContent: "center" },
  backIcon: { fontSize: 22, color: TEAL, fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#0f172a" },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  countdown: {
    fontSize: 72,
    fontWeight: "bold",
    marginTop: 25,
    color: "#1f7a7a",
  },
  subtitle: {
    fontSize: 24,
    marginTop: 10,
    color: "#64748b",
  },
  cycles: {
    marginTop: 25,
    fontSize: 18,
    color: "#475569",
  },
  buttonRow: {
    flexDirection: "row",
    marginTop: 45,
    gap: 15,
  },
  stopButton: {
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 14,
  },
  stopText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 18,
  },
});