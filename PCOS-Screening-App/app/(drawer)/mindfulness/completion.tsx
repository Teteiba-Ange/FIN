import React, { useMemo } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";

const TEAL = "#1f7a7a";

const quotes = [
  "Every deep breath is a fresh beginning. 🌸",
  "Calmness is your superpower. 💙",
  "Small moments of mindfulness create lasting wellbeing. ✨",
  "Your mind and body thank you for taking this pause. 🌿",
  "One breath at a time. You are doing amazing. 💕",
  "Relax. Breathe. Reset. 🌼",
];

export default function CompletionScreen() {
  const router = useRouter();
  const quote = useMemo(() => {
    return quotes[Math.floor(Math.random() * quotes.length)];
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* ─── Header with Back Button ─── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Session Complete</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <Text style={styles.emoji}>🎉</Text>
          <Text style={styles.title}>Session Complete</Text>
          <Text style={styles.subtitle}>
            You successfully completed your breathing exercise.
          </Text>

          <View style={styles.summary}>
            <Text style={styles.summaryTitle}>Today's Achievement</Text>
            <Text style={styles.summaryText}>✅ 5 Breathing Cycles</Text>
            <Text style={styles.summaryText}>🧘 Improved Relaxation</Text>
            <Text style={styles.summaryText}>
              💙 Mindfulness Practice Completed
            </Text>
          </View>

          <View style={styles.quoteCard}>
            <Text style={styles.quote}>"{quote}"</Text>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace("/(drawer)/mindfulness")}
          >
            <Text style={styles.primaryText}>Practice Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.replace("/(drawer)/drawer")}
          >
            <Text style={styles.secondaryText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
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
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 25,
    elevation: 3,
    alignItems: "center",
  },
  emoji: {
    fontSize: 70,
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0f172a",
  },
  subtitle: {
    marginTop: 10,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 25,
  },
  summary: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    padding: 18,
    borderRadius: 16,
  },
  summaryTitle: {
    fontWeight: "700",
    fontSize: 18,
    marginBottom: 12,
    color: "#0f172a",
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 8,
    color: "#475569",
  },
  quoteCard: {
    marginTop: 25,
    backgroundColor: "#E0F7FA",
    padding: 18,
    borderRadius: 16,
  },
  quote: {
    color: TEAL,
    fontSize: 16,
    textAlign: "center",
    fontStyle: "italic",
    lineHeight: 24,
  },
  primaryButton: {
    marginTop: 30,
    width: "100%",
    backgroundColor: TEAL,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
  },
  secondaryButton: {
    marginTop: 15,
    width: "100%",
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: TEAL,
    alignItems: "center",
  },
  secondaryText: {
    color: TEAL,
    fontWeight: "700",
    fontSize: 17,
  },
});