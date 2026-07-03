import React, { useMemo, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, SafeAreaView, Alert,
} from "react-native";
import { useAssessment } from "../../../context/assessmentContext";
import { useAuth } from "../../../context/authContext";

const TEAL = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

const getBMIInfo = (bmi: number) => {
  if (bmi < 18.5) return { label: "Underweight", color: "#3b82f6" };
  if (bmi < 25)   return { label: "Healthy Range", color: "#22c55e" };
  if (bmi < 30)   return { label: "Overweight", color: "#f59e0b" };
  return           { label: "Obese", color: "#ef4444" };
};

export default function Step1PhysicalMetrics({ onNext }: { onNext?: () => void }) {
  const { data, update } = useAssessment();
  const { user } = useAuth();
  const avatarInitial = user?.fullName?.charAt(0).toUpperCase() || "U";

  const bmi = useMemo(() => {
    const w = parseFloat(data.weight);
    const hCm = parseFloat(data.height);
    if (!w || !hCm) return null;
    const hM = hCm / 100;
    if (hM <= 0) return null;
    return parseFloat((w / (hM * hM)).toFixed(1));
  }, [data.weight, data.height]);

  const bmiInfo = bmi ? getBMIInfo(bmi) : null;

  const handleNext = () => {
    if (!data.age.trim() || !data.weight.trim() || !data.height.trim()) {
      Alert.alert("Missing Fields", "Please fill in your age, weight, and height before continuing.");
      return;
    }
    onNext?.();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Nav */}
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
        {/* Progress */}
        <View style={styles.progressRow}>
          <Text style={styles.stepText}>Step 1 of 4</Text>
          <View style={styles.progressBadge}>
            <Text style={styles.progressBadgeText}>25% Complete</Text>
          </View>
        </View>
        <Text style={styles.stepTitle}>Physical Metrics</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: "25%" }]} />
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconBox}>
            <Text style={styles.infoIconText}>❤️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Basics first</Text>
            <Text style={styles.infoDesc}>
              Your physical metrics help us understand your metabolic profile, a key factor in PCOS risk assessment.
            </Text>
          </View>
        </View>

        {/* Age */}
        <Text style={styles.label}>Age (Years) <Text style={styles.required}>*</Text></Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="e.g. 28"
            value={data.age}
            onChangeText={(v) => update({ age: v.replace(/[^0-9]/g, "") })}
            keyboardType="number-pad"
            style={styles.input}
            placeholderTextColor="#bbb"
            maxLength={3}
            returnKeyType="next"
          />
          <Text style={styles.inputUnit}>yrs</Text>
        </View>

        {/* Weight */}
        <Text style={styles.label}>Weight <Text style={styles.required}>*</Text></Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="e.g. 65.0"
            value={data.weight}
            onChangeText={(v) => update({ weight: v.replace(/[^0-9.]/g, "") })}
            keyboardType="decimal-pad"
            style={styles.input}
            placeholderTextColor="#bbb"
            maxLength={6}
            returnKeyType="next"
          />
          <Text style={styles.inputUnit}>kg</Text>
        </View>

        {/* Height */}
        <Text style={styles.label}>Height <Text style={styles.required}>*</Text></Text>
        <View style={styles.inputRow}>
          <TextInput
            placeholder="e.g. 165"
            value={data.height}
            onChangeText={(v) => update({ height: v.replace(/[^0-9]/g, "") })}
            keyboardType="number-pad"
            style={styles.input}
            placeholderTextColor="#bbb"
            maxLength={3}
            returnKeyType="done"
          />
          <Text style={styles.inputUnit}>cm</Text>
        </View>

        {/* Live BMI Card */}
        {bmi && bmiInfo ? (
          <View style={[styles.bmiCard, { backgroundColor: TEAL }]}>
            <View>
              <Text style={styles.bmiLabel}>CALCULATED BMI</Text>
              <Text style={styles.bmiValue}>{bmi}</Text>
              <Text style={[styles.bmiRange, { color: bmiInfo.color === "#22c55e" ? "#a7f3d0" : "#fff" }]}>
                {bmiInfo.label}
              </Text>
            </View>
            <View style={styles.bmiIconBox}>
              <Text style={{ fontSize: 26 }}>🎯</Text>
            </View>
          </View>
        ) : (
          <View style={styles.bmiPlaceholder}>
            <Text style={styles.bmiPlaceholderText}>
              Enter weight and height above to see your calculated BMI
            </Text>
          </View>
        )}

        {/* Tip */}
        <View style={styles.tipBox}>
          <Text style={styles.tipText}>
            "Small changes in body composition can significantly impact PCOS symptoms. We use these metrics to provide personalised insights."
          </Text>
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>Next Step →</Text>
        </TouchableOpacity>
        <Text style={styles.privacyText}>🔒 Your data is encrypted and private</Text>
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
  stepTitle: { fontSize: 20, fontWeight: "800", color: "#1a1a1a", marginBottom: 10 },
  progressBar: { height: 6, backgroundColor: "#e5e7eb", borderRadius: 3, marginBottom: 24 },
  progressFill: { height: 6, backgroundColor: TEAL, borderRadius: 3 },
  infoCard: {
    flexDirection: "row", gap: 12, backgroundColor: "#fff",
    borderRadius: 14, padding: 14, marginBottom: 20,
    shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  infoIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#fee2e2", justifyContent: "center", alignItems: "center",
  },
  infoIconText: { fontSize: 18 },
  infoTitle: { fontSize: 14, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  infoDesc: { fontSize: 12, color: "#6b7280", lineHeight: 18 },
  label: { fontSize: 13, color: "#374151", fontWeight: "600", marginBottom: 8, marginTop: 16 },
  required: { color: "#ef4444" },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.5,
    borderColor: "#e5e7eb", paddingHorizontal: 14, paddingVertical: 2,
  },
  input: { flex: 1, fontSize: 16, color: "#1a1a1a", paddingVertical: 14 },
  inputUnit: { fontSize: 13, color: "#9ca3af", fontWeight: "600", marginLeft: 8 },
  bmiCard: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    borderRadius: 14, padding: 20, marginTop: 20,
  },
  bmiLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  bmiValue: { fontSize: 30, fontWeight: "900", color: "#fff" },
  bmiRange: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  bmiIconBox: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center",
  },
  bmiPlaceholder: {
    backgroundColor: "#f9fafb", borderRadius: 14, padding: 18,
    marginTop: 20, borderWidth: 1.5, borderColor: "#e5e7eb", borderStyle: "dashed",
  },
  bmiPlaceholderText: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 20 },
  tipBox: {
    borderLeftWidth: 3, borderLeftColor: TEAL,
    backgroundColor: "#f0fdf4", borderRadius: 10,
    padding: 14, marginTop: 20,
  },
  tipText: { fontSize: 12, color: "#374151", lineHeight: 19, fontStyle: "italic" },
  nextButton: {
    backgroundColor: TEAL, borderRadius: 12,
    paddingVertical: 16, alignItems: "center", marginTop: 28,
  },
  nextButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  privacyText: { textAlign: "center", fontSize: 12, color: "#9ca3af", marginTop: 12 },
});