// app/(drawer)/mindfulness/index.tsx
// FR-16: Mindfulness and Wellbeing Tools
// Guided breathing exercises accessible from the mental wellbeing section.

import React, { useState } from "react";
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";

const TEAL      = "#1f7a7a";
const TEAL_DARK = "#155555";
const TEAL_LIGHT= "#e6f4f4";

// ─── Exercise definitions ────────────────────────────────────────────────────
// Each exercise passes inhale / hold / exhale seconds to the breathing screen
const EXERCISES = [
  {
    id:          "box",
    title:       "Box Breathing",
    emoji:       "🟦",
    description: "A military technique used to calm the nervous system. Inhale, hold, exhale, hold — all equal counts.",
    benefit:     "Reduces cortisol · Calms anxiety · Improves focus",
    duration:    "~5 min",
    difficulty:  "Beginner",
    color:       TEAL,
    params:      { inhale: 4, hold: 4, exhale: 4 },
  },
  {
    id:          "478",
    title:       "4-7-8 Relaxation",
    emoji:       "🌙",
    description: "Dr. Weil's relaxation breath. A longer exhale activates the parasympathetic nervous system.",
    benefit:     "Promotes sleep · Reduces PMOS stress hormones · Deep relaxation",
    duration:    "~4 min",
    difficulty:  "Intermediate",
    color:       "#8b5cf6",
    params:      { inhale: 4, hold: 7, exhale: 8 },
  },
  {
    id:          "calm",
    title:       "Calm Breathing",
    emoji:       "🌊",
    description: "Simple slow breathing to bring you back to the present moment. No hold phase.",
    benefit:     "Quick stress relief · Easy for beginners · Anytime use",
    duration:    "~3 min",
    difficulty:  "Beginner",
    color:       "#f59e0b",
    params:      { inhale: 5, hold: 0, exhale: 5 },
  },
  {
    id:          "energising",
    title:       "Energising Breath",
    emoji:       "⚡",
    description: "Short sharp inhales and longer exhales to boost alertness and energy levels.",
    benefit:     "Boosts energy · Reduces fatigue · Morning routine",
    duration:    "~3 min",
    difficulty:  "Beginner",
    color:       "#22c55e",
    params:      { inhale: 3, hold: 0, exhale: 6 },
  },
  {
    id:          "coherent",
    title:       "Coherent Breathing",
    emoji:       "💙",
    description: "5 breaths per minute breathing linked to improved heart rate variability and hormonal balance.",
    benefit:     "Balances hormones · Improves HRV · Reduces inflammation",
    duration:    "~5 min",
    difficulty:  "Intermediate",
    color:       "#ec4899",
    params:      { inhale: 6, hold: 0, exhale: 6 },
  },
];

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner:     "#22c55e",
  Intermediate: "#f59e0b",
  Advanced:     "#ef4444",
};

export default function MindfulnessScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const handleStart = (exercise: typeof EXERCISES[0]) => {
    // Pass all timing params + title through the URL query string
    router.push({
      pathname: "/(drawer)/mindfulness/breathing",
      params: {
        title:  exercise.title,
        inhale: exercise.params.inhale,
        hold:   exercise.params.hold,
        exhale: exercise.params.exhale,
      },
    });
  };

  return (
    <SafeAreaView style={s.safeArea}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Mindfulness</Text>
          <Text style={s.headerSub}>FR-16 · Guided breathing exercises</Text>
        </View>
        <TouchableOpacity
          style={s.historyBtn}
          onPress={() => router.push("/(drawer)/mindfulness/history")}
        >
          <Text style={s.historyBtnText}>History</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>

        {/* Intro banner */}
        <View style={s.banner}>
          <Text style={s.bannerEmoji}>🧘</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.bannerTitle}>Breathing & Mindfulness</Text>
            <Text style={s.bannerSub}>
              Stress raises cortisol which worsens PMOS symptoms.
              Regular breathing exercises help regulate your hormones.
            </Text>
          </View>
        </View>

        <Text style={s.sectionLabel}>CHOOSE AN EXERCISE</Text>

        {EXERCISES.map((ex) => {
          const isSelected = selected === ex.id;
          return (
            <TouchableOpacity
              key={ex.id}
              style={[s.card, isSelected && { borderColor: ex.color, borderWidth: 2 }]}
              onPress={() => setSelected(isSelected ? null : ex.id)}
              activeOpacity={0.85}
            >
              {/* Top row */}
              <View style={s.cardTop}>
                <View style={[s.emojiBox, { backgroundColor: ex.color + "18" }]}>
                  <Text style={s.emoji}>{ex.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cardTitle}>{ex.title}</Text>
                  <View style={s.tagRow}>
                    <View style={[s.tag, { backgroundColor: DIFFICULTY_COLOR[ex.difficulty] + "22" }]}>
                      <Text style={[s.tagText, { color: DIFFICULTY_COLOR[ex.difficulty] }]}>
                        {ex.difficulty}
                      </Text>
                    </View>
                    <View style={[s.tag, { backgroundColor: "#f3f4f6" }]}>
                      <Text style={[s.tagText, { color: "#6b7280" }]}>⏱ {ex.duration}</Text>
                    </View>
                  </View>
                </View>
                <Text style={[s.chevron, { color: ex.color }]}>
                  {isSelected ? "▲" : "▼"}
                </Text>
              </View>

              {/* Expanded details */}
              {isSelected && (
                <View style={s.cardExpanded}>
                  <Text style={s.cardDesc}>{ex.description}</Text>

                  <View style={s.benefitBox}>
                    <Text style={s.benefitLabel}>Benefits</Text>
                    <Text style={s.benefitText}>{ex.benefit}</Text>
                  </View>

                  {/* Timing display */}
                  <View style={s.timingRow}>
                    <View style={s.timingItem}>
                      <Text style={[s.timingNum, { color: ex.color }]}>{ex.params.inhale}s</Text>
                      <Text style={s.timingLabel}>Inhale</Text>
                    </View>
                    {ex.params.hold > 0 && (
                      <View style={s.timingItem}>
                        <Text style={[s.timingNum, { color: "#8b5cf6" }]}>{ex.params.hold}s</Text>
                        <Text style={s.timingLabel}>Hold</Text>
                      </View>
                    )}
                    <View style={s.timingItem}>
                      <Text style={[s.timingNum, { color: "#f59e0b" }]}>{ex.params.exhale}s</Text>
                      <Text style={s.timingLabel}>Exhale</Text>
                    </View>
                    <View style={s.timingItem}>
                      <Text style={[s.timingNum, { color: "#6b7280" }]}>5</Text>
                      <Text style={s.timingLabel}>Cycles</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[s.startBtn, { backgroundColor: ex.color }]}
                    onPress={() => handleStart(ex)}
                  >
                    <Text style={s.startBtnText}>▶  Start {ex.title}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* PMOS wellness tip */}
        <View style={s.tipBox}>
          <Text style={s.tipTitle}>💡 Why breathing helps PMOS</Text>
          <Text style={s.tipText}>
            Chronic stress elevates cortisol and insulin, which directly
            worsen PMOS symptoms. Just 5 minutes of slow breathing daily
            can lower cortisol by up to 25% and improve hormonal balance
            over time.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fa" },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: TEAL_DARK,
  },
  backBtn:     { width: 36, justifyContent: "center" },
  backIcon:    { fontSize: 22, color: "#fff", fontWeight: "700" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  headerSub:   { fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 1 },
  historyBtn:  {
    backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 12,
    paddingVertical: 7, borderRadius: 8, borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  historyBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  container:   { padding: 16 },

  banner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: TEAL_LIGHT, borderRadius: 16, padding: 16, marginBottom: 20,
  },
  bannerEmoji: { fontSize: 36 },
  bannerTitle: { fontSize: 15, fontWeight: "700", color: TEAL_DARK, marginBottom: 4 },
  bannerSub:   { fontSize: 12, color: "#374151", lineHeight: 18 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#9ca3af",
    letterSpacing: 0.8, marginBottom: 12,
  },

  card: {
    backgroundColor: "#fff", borderRadius: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
    overflow: "hidden",
  },
  cardTop: {
    flexDirection: "row", alignItems: "center",
    padding: 16, gap: 12,
  },
  emojiBox: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: "center", alignItems: "center",
  },
  emoji:     { fontSize: 24 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a", marginBottom: 6 },
  tagRow:    { flexDirection: "row", gap: 6 },
  tag:       { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  tagText:   { fontSize: 11, fontWeight: "700" },
  chevron:   { fontSize: 12, fontWeight: "700" },

  cardExpanded: {
    paddingHorizontal: 16, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: "#f3f4f6",
  },
  cardDesc: { fontSize: 13, color: "#4b5563", lineHeight: 20, marginTop: 12, marginBottom: 12 },

  benefitBox:   { backgroundColor: "#f0fdf4", borderRadius: 10, padding: 12, marginBottom: 14 },
  benefitLabel: { fontSize: 11, fontWeight: "700", color: "#22c55e", marginBottom: 4, letterSpacing: 0.5 },
  benefitText:  { fontSize: 12, color: "#374151" },

  timingRow: {
    flexDirection: "row", justifyContent: "space-around",
    backgroundColor: "#f9fafb", borderRadius: 12,
    paddingVertical: 14, marginBottom: 16,
  },
  timingItem:  { alignItems: "center" },
  timingNum:   { fontSize: 22, fontWeight: "900" },
  timingLabel: { fontSize: 11, color: "#9ca3af", marginTop: 2, fontWeight: "600" },

  startBtn:     { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  startBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  tipBox: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderLeftWidth: 4, borderLeftColor: TEAL, marginTop: 8,
  },
  tipTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  tipText:  { fontSize: 12, color: "#6b7280", lineHeight: 19 },
});