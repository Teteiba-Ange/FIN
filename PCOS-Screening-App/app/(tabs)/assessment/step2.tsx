// ============================================================
// FILE 4: app/(tabs)/Assessment/Step2MenstrualHealth.tsx
// ============================================================

import React from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, SafeAreaView, Alert,
} from "react-native";
import { useAssessment } from "../../../context/assessmentContext";
import { useAuth } from "../../../context/authContext";

const TEAL = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

const REGULARITY_OPTIONS = ["Regular", "Irregular", "No Cycle"] as const;

export default function Step2MenstrualHealth({ onNext }: { onNext?: () => void }) {
  const { data, update } = useAssessment();
  const { user } = useAuth();
  const avatarInitial = user?.fullName?.charAt(0).toUpperCase() || "U";

  const handleNext = () => {
    if (!data.cycleRegularity) {
      Alert.alert("Missing Selection", "Please select your cycle regularity before continuing.");
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

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressRow}>
          <Text style={styles.stepText}>Step 2 of 4</Text>
          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>50% Complete</Text>
          </View>
        </View>
        <Text style={styles.stepTitle}>Menstrual Health</Text>
        <Text style={styles.stepDesc}>This information helps us understand your hormonal rhythm.</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "50%" }]} />
        </View>

        {/* Cycle Regularity — tap to select */}
        <Text style={styles.label}>
          Cycle Regularity <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.toggleRow}>
          {REGULARITY_OPTIONS.map((opt) => {
            const selected = data.cycleRegularity === opt;
            return (
              <TouchableOpacity
                key={opt}
                activeOpacity={0.7}
                style={[styles.toggleOption, selected && styles.toggleOptionActive]}
                onPress={() => update({ cycleRegularity: opt })}
              >
                <Text style={styles.toggleEmoji}>
                  {opt === "Regular" ? "✅" : opt === "Irregular" ? "⚠️" : "❌"}
                </Text>
                <Text style={[styles.toggleText, selected && styles.toggleTextActive]}>
                  {opt}
                </Text>
                {selected && <View style={styles.toggleDot} />}
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.hintText}>ℹ️  Regular is defined as a cycle between 21–35 days.</Text>

        {/* Cycle Length */}
        <Text style={styles.label}>Cycle Length (days)</Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="e.g. 28"
            value={data.cycleLength}
            onChangeText={(v) => update({ cycleLength: v.replace(/[^0-9]/g, "") })}
            keyboardType="number-pad"
            style={styles.input}
            placeholderTextColor="#bbb"
            maxLength={3}
          />
          <Text style={styles.inputUnit}>days</Text>
        </View>

        {/* Avg Period Duration */}
        <Text style={styles.label}>Average Period Duration</Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="e.g. 5"
            value={data.avgPeriodDuration}
            onChangeText={(v) => update({ avgPeriodDuration: v.replace(/[^0-9]/g, "") })}
            keyboardType="number-pad"
            style={styles.input}
            placeholderTextColor="#bbb"
            maxLength={2}
          />
          <Text style={styles.inputUnit}>days</Text>
        </View>

        {/* Why we ask */}
        <View style={styles.whyCard}>
          <View style={styles.whyIconBox}>
            <Text style={{ fontSize: 20 }}>📅</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.whyTitle}>Why we ask</Text>
            <Text style={styles.whyDesc}>
              Cycle variations are a primary clinical indicator for PCOS diagnosis.
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
  stepTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 6 },
  stepDesc: { fontSize: 13, color: "#6b7280", marginBottom: 12, lineHeight: 19 },
  progressBar: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginBottom: 24 },
  progressFill: { height: 6, backgroundColor: TEAL, borderRadius: 3 },
  label: { fontSize: 13, color: "#374151", fontWeight: "600", marginBottom: 10, marginTop: 16 },
  required: { color: "#ef4444" },
  toggleRow: { flexDirection: "row", gap: 8 },
  toggleOption: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 2, borderColor: "#e5e7eb",
    alignItems: "center", backgroundColor: "#fff", gap: 6,
  },
  toggleOptionActive: { backgroundColor: TEAL_LIGHT, borderColor: TEAL },
  toggleEmoji: { fontSize: 18 },
  toggleText: { fontSize: 12, fontWeight: "600", color: "#6b7280", textAlign: "center" },
  toggleTextActive: { color: TEAL },
  toggleDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: TEAL,
  },
  hintText: { fontSize: 12, color: "#9ca3af", marginTop: 8, lineHeight: 18 },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1.5, borderColor: "#e5e7eb",
    paddingHorizontal: 14, paddingVertical: 2,
  },
  input: { flex: 1, fontSize: 16, color: "#1a1a1a", paddingVertical: 14 },
  inputUnit: { fontSize: 13, color: "#9ca3af", fontWeight: "600" },
  whyCard: {
    flexDirection: "row", gap: 12, backgroundColor: TEAL_LIGHT,
    borderRadius: 14, padding: 14, marginTop: 24, alignItems: "center",
  },
  whyIconBox: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#fff", justifyContent: "center", alignItems: "center",
  },
  whyTitle: { fontSize: 13, fontWeight: "700", color: TEAL, marginBottom: 4 },
  whyDesc: { fontSize: 12, color: "#374151", lineHeight: 18 },
  navButtons: { flexDirection: "row", gap: 12, marginTop: 32 },
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