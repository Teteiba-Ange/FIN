// ============================================================
// FILE 5: app/(tabs)/Assessment/Step3Symptoms.tsx
// ============================================================

import React from "react";
import {
  View, Text, TouchableOpacity,
  StyleSheet, ScrollView, SafeAreaView, Alert,
} from "react-native";
import { useAssessment } from "../../../context/assessmentContext";
import { useAuth } from "../../../context/authContext";

const TEAL = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

const SYMPTOMS = [
  { id: "hair_growth", label: "Excess Hair Growth", icon: "🧔", desc: "Face, chest, or abdomen" },
  { id: "hair_loss",   label: "Hair Loss / Thinning", icon: "💇", desc: "Scalp hair thinning" },
  { id: "acne",        label: "Acne / Oily Skin", icon: "🫧", desc: "Persistent or severe acne" },
  { id: "weight_gain", label: "Unexplained Weight Gain", icon: "⚖️", desc: "Especially around abdomen" },
  { id: "skin_darkening", label: "Skin Darkening", icon: "🎨", desc: "Neck, groin, or underarms" },
  { id: "fatigue",     label: "Chronic Fatigue", icon: "😴", desc: "Persistent tiredness" },
  { id: "mood",        label: "Mood Changes", icon: "🧠", desc: "Anxiety or depression" },
  { id: "none",        label: "None of the above", icon: "✅", desc: "" },
];

export default function Step3Symptoms({ onNext }: { onNext?: () => void }) {
  const { data, update } = useAssessment();
  const { user } = useAuth();
  const avatarInitial = user?.fullName?.charAt(0).toUpperCase() || "U";

  const toggleSymptom = (id: string) => {
    if (id === "none") {
      update({ symptoms: data.symptoms.includes("none") ? [] : ["none"] });
      return;
    }
    const withoutNone = data.symptoms.filter((s) => s !== "none");
    if (withoutNone.includes(id)) {
      update({ symptoms: withoutNone.filter((s) => s !== id) });
    } else {
      update({ symptoms: [...withoutNone, id] });
    }
  };

  const isSelected = (id: string) => data.symptoms.includes(id);

  const handleNext = () => {
    if (data.symptoms.length === 0) {
      Alert.alert("No Selection", "Please select at least one symptom, or 'None of the above'.");
      return;
    }
    onNext?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.navBar}>
        <View style={{ width: 20 }} />
        <Text style={styles.navTitle}>PCOS Wellness</Text>
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>{avatarInitial}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.progressRow}>
          <Text style={styles.stepText}>Step 3 of 4</Text>
          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>75% Complete</Text>
          </View>
        </View>
        <Text style={styles.stepTitle}>Androgen & Symptoms</Text>
        <Text style={styles.stepDesc}>
          Select all symptoms you have experienced in the past 6 months.
        </Text>
        <Text style={styles.selectedCount}>
          {data.symptoms.includes("none")
            ? "No symptoms selected"
            : data.symptoms.length > 0
            ? `${data.symptoms.length} symptom${data.symptoms.length > 1 ? "s" : ""} selected`
            : "Tap cards below to select"}
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "75%" }]} />
        </View>

        {/* Symptom Grid */}
        <View style={styles.grid}>
          {SYMPTOMS.map((symptom) => {
            const selected = isSelected(symptom.id);
            return (
              <TouchableOpacity
                key={symptom.id}
                activeOpacity={0.7}
                style={[styles.symptomCard, selected && styles.symptomCardActive]}
                onPress={() => toggleSymptom(symptom.id)}
              >
                {/* Checkbox top-right */}
                <View style={[styles.symptomCheckbox, selected && styles.symptomCheckboxActive]}>
                  {selected && <Text style={styles.checkTick}>✓</Text>}
                </View>
                <Text style={styles.symptomIcon}>{symptom.icon}</Text>
                <Text style={[styles.symptomLabel, selected && styles.symptomLabelActive]}>
                  {symptom.label}
                </Text>
                {symptom.desc !== "" && (
                  <Text style={styles.symptomDesc}>{symptom.desc}</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.whyCard}>
          <Text style={{ fontSize: 20 }}>🔬</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.whyTitle}>Why we ask</Text>
            <Text style={styles.whyDesc}>
              Androgen-related symptoms are among the most clinically significant indicators of PCOS.
            </Text>
          </View>
        </View>

        <View style={styles.navButtons}>
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>Next Step →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fa" },
  navBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee",
  },
  navIcon: { fontSize: 22, color: TEAL, fontWeight: "700", padding: 4 },
  navTitle: { fontSize: 16, fontWeight: "700", color: TEAL },
  avatarFallback: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: TEAL, justifyContent: "center", alignItems: "center",
  },
  avatarText: { color: "#fff", fontWeight: "700" },
  container: { padding: 16, paddingBottom: 50 },
  progressRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  stepText: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  progressBadge: { backgroundColor: TEAL, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  progressBadgeText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  stepTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 4 },
  stepDesc: { fontSize: 13, color: "#6b7280", marginBottom: 4, lineHeight: 19 },
  selectedCount: { fontSize: 12, color: TEAL, fontWeight: "600", marginBottom: 12 },
  progressBar: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginBottom: 20 },
  progressFill: { height: 6, backgroundColor: TEAL, borderRadius: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  symptomCard: {
    width: "47%", backgroundColor: "#fff", borderRadius: 14,
    padding: 14, borderWidth: 2, borderColor: "#e5e7eb",
  },
  symptomCardActive: { borderColor: TEAL, backgroundColor: TEAL_LIGHT },
  symptomCheckbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 2, borderColor: "#d1d5db",
    marginBottom: 10, justifyContent: "center", alignItems: "center",
    alignSelf: "flex-end",
  },
  symptomCheckboxActive: { backgroundColor: TEAL, borderColor: TEAL },
  checkTick: { color: "#fff", fontSize: 12, fontWeight: "900" },
  symptomIcon: { fontSize: 26, marginBottom: 8 },
  symptomLabel: { fontSize: 13, fontWeight: "700", color: "#374151", marginBottom: 4 },
  symptomLabelActive: { color: TEAL },
  symptomDesc: { fontSize: 11, color: "#9ca3af", lineHeight: 16 },
  whyCard: {
    flexDirection: "row", gap: 12, backgroundColor: TEAL_LIGHT,
    borderRadius: 14, padding: 14, marginTop: 20, alignItems: "center",
  },
  whyTitle: { fontSize: 13, fontWeight: "700", color: TEAL, marginBottom: 4 },
  whyDesc: { fontSize: 12, color: "#374151", lineHeight: 18 },
  navButtons: { flexDirection: "row", gap: 12, marginTop: 28 },
  backButton: {
    flex: 1, borderRadius: 12, paddingVertical: 15,
    alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", backgroundColor: "#fff",
  },
  backButtonText: { fontSize: 15, fontWeight: "600", color: "#6b7280" },
  nextButton: {
    flex: 2, backgroundColor: TEAL,
    borderRadius: 12, paddingVertical: 15, alignItems: "center",
  },
  nextButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});