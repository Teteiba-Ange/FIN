// ============================================================
// FILE 6: app/(tabs)/Assessment/Step4LifestyleMedical.tsx
// ============================================================

import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, SafeAreaView, Alert,
} from "react-native";
import { useAssessment } from "../../../context/assessmentContext";
import { useAuth } from "../../../context/authContext";

const TEAL = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

const FAST_FOOD_OPTIONS = ["Never", "1–2x / week", "3–4x / week", "Daily"];
const MARITAL_OPTIONS   = ["Single", "Married", "Other"] as const;
const FAMILY_HISTORY_OPTIONS = [
  { id: "pcos",     label: "History of PCOS",          icon: "🧬" },
  { id: "diabetes", label: "History of Diabetes",      icon: "💉" },
  { id: "unsure",   label: "Not sure / Don't know",    icon: "❓" },
];

export default function Step4LifestyleMedical({ onNext }: { onNext?: () => void }) {
  const { data, update } = useAssessment();
  const { user } = useAuth();
  const avatarInitial = user?.fullName?.charAt(0).toUpperCase() || "U";
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const toggleFamilyHistory = (id: string) => {
    if (data.familyHistory.includes(id)) {
      update({ familyHistory: data.familyHistory.filter((f) => f !== id) });
    } else {
      update({ familyHistory: [...data.familyHistory, id] });
    }
  };

  const handleFinish = () => {
    if (!data.fastFoodFrequency) {
      Alert.alert("Missing Selection", "Please select your fast food frequency.");
      return;
    }
    if (!data.exerciseHabit) {
      Alert.alert("Missing Selection", "Please select your exercise habit.");
      return;
    }
    if (!data.maritalStatus) {
      Alert.alert("Missing Selection", "Please select your marital status.");
      return;
    }
    if (data.familyHistory.length === 0) {
      Alert.alert("Missing Selection", "Please select at least one family history option.");
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
          <Text style={styles.stepText}>Step 4 of 4</Text>
          <View style={styles.progressBadgeFull}>
            <Text style={styles.progressBadgeText}>Almost done!</Text>
          </View>
        </View>
        <Text style={styles.stepTitle}>Lifestyle & Medical History</Text>
        <Text style={styles.stepDesc}>
          This final section helps us understand your unique environment and genetic predispositions.
        </Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "100%" }]} />
        </View>

        {/* ── Fast Food Frequency ── */}
        <Text style={styles.label}>
          Fast Food Frequency <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.optionGrid}>
          {FAST_FOOD_OPTIONS.map((opt) => {
            const selected = data.fastFoodFrequency === opt;
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.7}
                style={[styles.optionPill, selected && styles.optionPillActive]}
                onPress={() => update({ fastFoodFrequency: opt })}
              >
                <Text style={[styles.optionPillText, selected && styles.optionPillTextActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Exercise Habits ── */}
        <Text style={styles.label}>
          Exercise Habits <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.exerciseRow}>
          {(["Sedentary", "Active"] as const).map((opt) => {
            const selected = data.exerciseHabit === opt;
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.7}
                style={[styles.exerciseOption, selected && styles.exerciseOptionActive]}
                onPress={() => update({ exerciseHabit: opt })}
              >
                <Text style={styles.exerciseIcon}>{opt === "Sedentary" ? "🛋️" : "🏃"}</Text>
                <Text style={[styles.exerciseLabel, selected && styles.exerciseLabelActive]}>
                  {opt}
                </Text>
                <Text style={styles.exerciseSub}>
                  {opt === "Sedentary" ? "Little or no exercise" : "3+ sessions / week"}
                </Text>
                {selected && (
                  <View style={styles.exerciseCheck}>
                    <Text style={styles.exerciseCheckText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Marital Status ── */}
        <Text style={styles.label}>
          Marital Status <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.radioRow}>
          {MARITAL_OPTIONS.map((opt) => {
            const selected = data.maritalStatus === opt;
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.7}
                style={[styles.radioCard, selected && styles.radioCardActive]}
                onPress={() => update({ maritalStatus: opt })}
              >
                <View style={[styles.radioOuter, selected && styles.radioOuterActive]}>
                  {selected && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.radioLabel, selected && styles.radioLabelActive]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Family Medical History ── */}
        <Text style={styles.label}>
          Family Medical History <Text style={styles.required}>*</Text>
        </Text>
        <Text style={styles.subLabel}>Select all that apply</Text>
        <View style={styles.card}>
          {FAMILY_HISTORY_OPTIONS.map((opt, idx) => {
            const selected = data.familyHistory.includes(opt.id);
            return (
              <TouchableOpacity
                key={opt.id}
                activeOpacity={0.7}
                style={[
                  styles.checkRow,
                  selected && styles.checkRowActive,
                  idx === FAMILY_HISTORY_OPTIONS.length - 1 && { borderBottomWidth: 0 },
                ]}
                onPress={() => toggleFamilyHistory(opt.id)}
              >
                <View style={styles.checkIconBox}>
                  <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
                </View>
                <Text style={[styles.checkLabel, selected && styles.checkLabelActive]}>
                  {opt.label}
                </Text>
                <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                  {selected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* HIPAA Note */}
        <View style={styles.hipaaRow}>
          <Text style={styles.hipaaIcon}>🔒</Text>
          <Text style={styles.hipaaText}>
            Your health data is encrypted and protected. It is only used for your clinical assessment and is never shared with third parties.
          </Text>
        </View>

        {/* Finish */}
        <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
          <Text style={styles.finishButtonText}>Finish & Analyse →</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
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
  progressBadgeFull: { backgroundColor: "#22c55e", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 },
  progressBadgeText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  stepTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 6 },
  stepDesc: { fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 19 },
  progressBar: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginBottom: 24 },
  progressFill: { height: 6, backgroundColor: TEAL, borderRadius: 3 },
  label: { fontSize: 13, color: "#374151", fontWeight: "600", marginBottom: 8, marginTop: 20 },
  subLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 10, marginTop: -6 },
  required: { color: "#ef4444" },

  // Fast food pills
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optionPill: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 25,
    borderWidth: 1.5, borderColor: "#e5e7eb", backgroundColor: "#fff",
  },
  optionPillActive: { backgroundColor: TEAL_LIGHT, borderColor: TEAL },
  optionPillText: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  optionPillTextActive: { color: TEAL },

  // Exercise
  exerciseRow: { flexDirection: "row", gap: 12 },
  exerciseOption: {
    flex: 1, backgroundColor: "#fff", borderRadius: 14, borderWidth: 2,
    borderColor: "#e5e7eb", paddingVertical: 18, alignItems: "center", gap: 6,
  },
  exerciseOptionActive: { backgroundColor: TEAL_LIGHT, borderColor: TEAL },
  exerciseIcon: { fontSize: 30 },
  exerciseLabel: { fontSize: 14, fontWeight: "700", color: "#374151" },
  exerciseLabelActive: { color: TEAL },
  exerciseSub: { fontSize: 10, color: "#9ca3af", textAlign: "center", paddingHorizontal: 8 },
  exerciseCheck: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: TEAL, justifyContent: "center", alignItems: "center",
    marginTop: 4,
  },
  exerciseCheckText: { color: "#fff", fontWeight: "900", fontSize: 13 },

  // Marital status
  radioRow: { flexDirection: "row", gap: 8 },
  radioCard: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#fff", borderRadius: 10, borderWidth: 1.5,
    borderColor: "#e5e7eb", paddingVertical: 12, paddingHorizontal: 10,
  },
  radioCardActive: { backgroundColor: TEAL_LIGHT, borderColor: TEAL },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: "#d1d5db",
    justifyContent: "center", alignItems: "center",
  },
  radioOuterActive: { borderColor: TEAL },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: TEAL },
  radioLabel: { fontSize: 13, fontWeight: "600", color: "#6b7280" },
  radioLabelActive: { color: TEAL },

  // Family history checklist
  card: {
    backgroundColor: "#fff", borderRadius: 14, overflow: "hidden",
    borderWidth: 1.5, borderColor: "#e5e7eb",
  },
  checkRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderBottomWidth: 1, borderBottomColor: "#f3f4f6",
  },
  checkRowActive: { backgroundColor: TEAL_LIGHT },
  checkIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#f3f4f6", justifyContent: "center", alignItems: "center",
  },
  checkLabel: { flex: 1, fontSize: 14, fontWeight: "500", color: "#374151" },
  checkLabelActive: { color: TEAL, fontWeight: "600" },
  checkbox: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: "#d1d5db",
    justifyContent: "center", alignItems: "center",
  },
  checkboxActive: { backgroundColor: TEAL, borderColor: TEAL },
  checkmark: { color: "#fff", fontSize: 14, fontWeight: "900" },

  // HIPAA
  hipaaRow: {
    flexDirection: "row", gap: 10, backgroundColor: "#f0fdf4",
    borderRadius: 12, padding: 14, marginTop: 24, alignItems: "flex-start",
  },
  hipaaIcon: { fontSize: 16 },
  hipaaText: { flex: 1, fontSize: 11, color: "#6b7280", lineHeight: 17 },

  // Finish
  finishButton: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 17, alignItems: "center", marginTop: 24,
  },
  finishButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});