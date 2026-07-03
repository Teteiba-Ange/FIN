/**
 * result.tsx  (app/(tabs)/assessment/result.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX 2 — After computing / receiving the risk score we call
 *   setLatestResult(...)  on the context.
 *
 * This means health-trends.tsx and index.tsx will immediately reflect the
 * real score, real risk level, real SHAP features — not a hardcoded 72 %.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useAssessment, AssessmentResult, ShapFeature } from "../../../context/assessmentContext";
import apiService from "../../../context/apiService";
import { useAuth } from "../../../context/authContext";

const TEAL = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

// ── Risk helpers ──────────────────────────────────────────────────────────────

function getRiskLevel(score: number): { label: string; color: string; bg: string; description: string } {
  if (score < 30) return {
    label: "Low Risk",
    color: "#22c55e",
    bg: "#f0fdf4",
    description:
      "Your results suggest a lower risk profile. Continue maintaining healthy lifestyle habits — regular exercise, a balanced diet, and regular cycle tracking are your best tools.",
  };
  if (score < 60) return {
    label: "Moderate Risk",
    color: "#f59e0b",
    bg: "#fffbeb",
    description:
      "Your results indicate a moderate likelihood of PCOS. We recommend speaking with a healthcare provider for further assessment and continuing to monitor your symptoms.",
  };
  return {
    label: "High Risk",
    color: "#ef4444",
    bg: "#fef2f2",
    description:
      "This score indicates a higher than average likelihood of PCOS. We strongly recommend consulting a qualified healthcare professional for a definitive clinical evaluation.",
  };
}

// ── Local score computation (used when ML service is offline) ─────────────────

function computeLocalScore(data: ReturnType<typeof useAssessment>["data"]): number {
  let score = 30;
  if (data.cycleRegularity === "Irregular") score += 24;
  if (data.cycleRegularity === "No Cycle")  score += 30;
  if (data.symptoms.includes("hair_growth")) score += 10;
  if (data.symptoms.includes("acne"))        score += 8;
  if (data.symptoms.includes("weight_gain")) score += 8;
  if (data.symptoms.includes("skin_darkening")) score += 6;
  if (data.symptoms.includes("fatigue"))     score += 4;
  if (data.familyHistory.includes("pcos"))   score += 12;
  if (data.familyHistory.includes("diabetes")) score += 6;
  if (data.exerciseHabit === "Sedentary")    score += 5;
  if (["3–4x / week", "Daily"].includes(data.fastFoodFrequency)) score += 5;
  const w = parseFloat(data.weight);
  const hCm = parseFloat(data.height);
  const hM = hCm / 100;
  if (w > 0 && hM > 0) {
    const bmi = w / (hM * hM);
    if (bmi >= 25 && bmi < 30) score -= 3;
    if (bmi >= 30)              score += 8;
  }
  return Math.min(Math.max(Math.round(score), 5), 97);
}

function buildLocalShap(data: ReturnType<typeof useAssessment>["data"]): ShapFeature[] {
  const features: ShapFeature[] = [
    {
      feature: "Menstrual Irregularity",
      shap_value: data.cycleRegularity === "Irregular" ? 0.24
                : data.cycleRegularity === "No Cycle"  ? 0.30 : 0,
      direction: data.cycleRegularity !== "Regular" ? "increases" : "decreases",
      explanation: "Cycle variations are a primary clinical indicator for PCOS diagnosis.",
    },
    {
      feature: "Androgen Symptoms",
      shap_value:
        (data.symptoms.includes("hair_growth")    ? 0.10 : 0) +
        (data.symptoms.includes("acne")           ? 0.08 : 0) +
        (data.symptoms.includes("skin_darkening") ? 0.06 : 0),
      direction: data.symptoms.length > 0 ? "increases" : "decreases",
      explanation: "Androgen-related symptoms are among the most significant PCOS indicators.",
    },
    {
      feature: "Metabolic / Lifestyle",
      shap_value: (() => {
        const w = parseFloat(data.weight);
        const hCm = parseFloat(data.height);
        const hM = hCm / 100;
        let v = 0;
        if (w > 0 && hM > 0) {
          const bmi = w / (hM * hM);
          if (bmi >= 30)             v += 0.08;
          else if (bmi >= 25)        v -= 0.03;
          else                       v -= 0.08;
        }
        if (["3–4x / week", "Daily"].includes(data.fastFoodFrequency)) v += 0.05;
        if (data.exerciseHabit === "Active") v -= 0.04;
        return v;
      })(),
      direction: data.exerciseHabit === "Active" ? "decreases" : "increases",
      explanation: "BMI, diet and exercise habits affect insulin resistance linked to PCOS.",
    },
  ];
  return features.filter((f) => Math.abs(f.shap_value) > 0);
}

// ── Sub-components ────────────────────────────────────────────────────────────

const RiskGauge = ({ score, color }: { score: number; color: string }) => (
  <View style={styles.gaugeContainer}>
    <View style={[styles.gaugeRing, { borderColor: "#e5e7eb" }]}>
      <View style={[styles.gaugeInner, { borderColor: color }]} />
      <View style={styles.gaugeCenter}>
        <Text style={[styles.gaugeScore, { color }]}>{score}%</Text>
        <Text style={styles.gaugeLabel}>RISK SCORE</Text>
      </View>
    </View>
  </View>
);

const RiskDriverBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <View style={styles.driverRow}>
    <Text style={styles.driverLabel}>{label}</Text>
    <View style={styles.driverBarBg}>
      <View style={[styles.driverBarFill, { width: `${Math.min(Math.abs(value) * 300, 100)}%`, backgroundColor: color }]} />
    </View>
    <Text style={[styles.driverValue, { color }]}>
      {value > 0 ? `+${Math.round(value * 100)}%` : `${Math.round(value * 100)}%`}
    </Text>
  </View>
);

const getTips = (score: number, data: ReturnType<typeof useAssessment>["data"]) => {
  const tips: { icon: string; title: string; body: string }[] = [];

  if (data.exerciseHabit === "Sedentary")
    tips.push({ icon: "🏃", title: "Add gentle movement", body: "Even a 20-minute daily walk significantly improves insulin sensitivity and helps manage PCOS symptoms." });

  if (["3–4x / week", "Daily"].includes(data.fastFoodFrequency))
    tips.push({ icon: "🥗", title: "Lower glycaemic load", body: "Replacing processed foods with whole grains, legumes, and leafy greens reduces the dietary insulin load driving PCOS." });

  if (data.symptoms.includes("skin_darkening"))
    tips.push({ icon: "💊", title: "Ask about Inositol", body: "Myo-inositol supplementation has been clinically shown to reduce insulin resistance and improve ovarian function. Discuss with your doctor." });

  if (data.cycleRegularity !== "Regular")
    tips.push({ icon: "📅", title: "Track your cycle", body: "Daily logging in the symptom tracker helps you identify patterns and gives your healthcare provider more accurate information." });

  if (data.familyHistory.includes("diabetes"))
    tips.push({ icon: "🩺", title: "Metabolic screening", body: "With a family history of diabetes and PCOS symptoms, annual fasting glucose and HbA1c tests are strongly recommended." });

  if (tips.length === 0)
    tips.push({ icon: "✅", title: "Keep up the good work", body: "Continue your healthy habits. Log daily symptoms to track changes and complete follow-up assessments every 3 months." });

  return tips.slice(0, 3);
};

// ── Main screen ───────────────────────────────────────────────────────────────

type Props = {
  /** Called when user taps "Retake Assessment" */
  onRestart: () => void;
};

export default function ResultsScreen({ onRestart }: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { data, reset, setLatestResult } = useAssessment();
  const [serverResult, setServerResult] = useState<AssessmentResult | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const localScore = useMemo(() => computeLocalScore(data), [data]);
  const localRisk = useMemo(() => getRiskLevel(localScore), [localScore]);
  const localShap = useMemo(() => buildLocalShap(data), [data]);
  const localTips = useMemo(() => getTips(localScore, data), [localScore, data]);

  const result = serverResult ?? {
    score: localScore,
    riskLevel: localRisk.label,
    riskColor: localRisk.color,
    riskDescription: localRisk.description,
    topFeatures: localShap,
    completedAt: new Date().toISOString(),
  };

  const risk = {
    label: result.riskLevel,
    color: result.riskColor || localRisk.color,
    bg: getRiskLevel(result.score).bg,
    description: result.riskDescription || getRiskLevel(result.score).description,
  };
  const score = result.score;
  const shap = result.topFeatures;
  const tips = getTips(result.score, data);

  useEffect(() => {
    const persistResult = async () => {
      try {
        if (!user) {
          setFeedbackMessage("Offline result loaded. Sign in to save assessments.");
          setLatestResult(result);
          return;
        }

        const recordPayload = {
          cycleRegularity: data.cycleRegularity,
          avgCycleLength: data.cycleLength ? parseInt(data.cycleLength, 10) : null,
          lastPeriod: "",
          symptoms: data.symptoms,
          exerciseHabit: data.exerciseHabit,
          fastFoodFrequency: data.fastFoodFrequency,
          maritalStatus: data.maritalStatus,
          familyHistory: data.familyHistory,
          medicalBackground: "",
          medicalTags: [],
        };

        await apiService.recordSymptoms(recordPayload);

        const apiResult = await apiService.predictPCOSRisk({
          age: data.age,
          weight: data.weight,
          height: data.height,
          cycleRegularity: data.cycleRegularity,
          cycleLength: data.cycleLength,
          avgPeriodDuration: data.avgPeriodDuration,
          symptoms: data.symptoms,
          fastFoodFrequency: data.fastFoodFrequency,
          exerciseHabit: data.exerciseHabit,
          maritalStatus: data.maritalStatus,
          familyHistory: data.familyHistory,
        });

        const apiAssessmentResult: AssessmentResult = {
          score: apiResult.score,
          riskLevel: apiResult.riskLevel,
          riskColor: apiResult.riskColor || localRisk.color,
          riskDescription: apiResult.riskDescription || localRisk.description,
          topFeatures: apiResult.topFeatures ?? localShap,
          completedAt: new Date().toISOString(),
        };

        setServerResult(apiAssessmentResult);
        setLatestResult(apiAssessmentResult);
        setFeedbackMessage("Your assessment and symptom log were saved securely.");
      } catch (error: any) {
        console.warn("Prediction or symptom save failed, using offline result:", error);
        setFeedbackMessage("Server unavailable. Showing local risk profile instead.");
        setLatestResult(result);
      } finally {
        setLoadingPrediction(false);
      }
    };

    persistResult();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetake = () => {
    reset();
    onRestart();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Assessment Results</Text>
        <Text style={styles.pageDesc}>
          Based on your clinical inputs and symptomatic profile, we have calculated your preliminary risk score.
        </Text>

        {loadingPrediction && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator size="small" color={TEAL} />
            <Text style={styles.loadingText}>Saving your assessment and syncing with the health service...</Text>
          </View>
        )}

        {feedbackMessage && (
          <View style={styles.feedbackBanner}>
            <Text style={styles.feedbackText}>{feedbackMessage}</Text>
          </View>
        )}

        <View style={styles.gaugeCard}>
          <RiskGauge score={score} color={risk.color} />
          <View style={[styles.riskBadge, { backgroundColor: risk.bg }]}> 
            <Text style={styles.riskBadgeIcon}>⚠️</Text>
            <Text style={[styles.riskBadgeText, { color: risk.color }]}>{risk.label}</Text>
          </View>
          <Text style={styles.gaugeExplain}>{risk.description}</Text>
        </View>

        {/* Key Risk Drivers */}
        {shap.length > 0 && (
          <View style={styles.driversCard}>
            <View style={styles.driversHeader}>
              <Text style={styles.driversTitle}>Key Risk Drivers</Text>
              <Text style={styles.driversInfo}>ℹ️</Text>
            </View>
            {shap.map((d) => (
              <RiskDriverBar
                key={d.feature}
                label={d.feature}
                value={d.shap_value}
                color={d.direction === "increases" ? "#ef4444" : "#22c55e"}
              />
            ))}
          </View>
        )}

        {/* Personalised Tips */}
        <Text style={styles.tipsHeading}>Recommended Next Steps</Text>
        {tips.map((tip) => (
          <View key={tip.title} style={styles.tipCard}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.body}</Text>
            </View>
          </View>
        ))}

        {/* Action buttons */}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => Alert.alert("Talk to a Specialist", "Specialist booking coming soon!")}
        >
          <Text style={styles.primaryButtonIcon}>📅</Text>
          <Text style={styles.primaryButtonText}>Talk to a Specialist</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          // Navigate to the Health Trends tab which now reads the real result
          onPress={() => router.push("/(tabs)/health-trends")}
        >
          <Text style={styles.secondaryButtonIcon}>📊</Text>
          <Text style={styles.secondaryButtonText}>View Dashboard</Text>
        </TouchableOpacity>

        {/* Journey Note */}
        <View style={styles.journeyCard}>
          <Text style={{ fontSize: 22 }}>🌱</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.journeyTitle}>Your journey starts here.</Text>
            <Text style={styles.journeyDesc}>
              Many women manage PCOS successfully through lifestyle adjustments and guided medical care. You are not alone in this process.
            </Text>
          </View>
        </View>

        <View style={styles.disclaimerBox}>
          <Text style={styles.disclaimerText}>
            ⚕️ This risk score is NOT a clinical diagnosis. It is a statistical prediction based on self-reported features. Please consult a qualified healthcare professional for formal assessment and diagnosis.
          </Text>
        </View>

        <TouchableOpacity style={styles.retakeButton} onPress={handleRetake}>
          <Text style={styles.retakeText}>Retake Assessment</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fa" },
  container: { padding: 16, paddingBottom: 40 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#1a1a1a", textAlign: "center", marginBottom: 8 },
  pageDesc: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 19, marginBottom: 24 },

  gaugeCard: { backgroundColor: "#fff", borderRadius: 16, padding: 24, alignItems: "center", marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  gaugeContainer: { marginBottom: 16 },
  gaugeRing: { width: 160, height: 160, borderRadius: 80, borderWidth: 12, justifyContent: "center", alignItems: "center" },
  gaugeInner: { position: "absolute", width: 136, height: 136, borderRadius: 68, borderWidth: 12, borderTopColor: "transparent", borderRightColor: "transparent", transform: [{ rotate: "-45deg" }] },
  gaugeCenter: { alignItems: "center" },
  gaugeScore: { fontSize: 36, fontWeight: "900" },
  gaugeLabel: { fontSize: 11, color: "#9ca3af", fontWeight: "700", letterSpacing: 0.5 },
  riskBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 14 },
  riskBadgeIcon: { fontSize: 14 },
  riskBadgeText: { fontSize: 13, fontWeight: "700" },
  gaugeExplain: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 20 },

  driversCard: { backgroundColor: "#fff", borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  driversHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },
  driversTitle: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  driversInfo: { fontSize: 16 },
  driverRow: { marginBottom: 14 },
  driverLabel: { fontSize: 12, color: "#374151", fontWeight: "500", marginBottom: 6 },
  driverBarBg: { height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, marginBottom: 4 },
  driverBarFill: { height: 6, borderRadius: 3 },
  driverValue: { fontSize: 12, fontWeight: "700", alignSelf: "flex-end" },

  tipsHeading: { fontSize: 16, fontWeight: "800", color: "#1a1a1a", marginBottom: 12 },
  tipCard: { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  tipIcon: { fontSize: 26 },
  tipTitle: { fontSize: 13, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  tipBody: { fontSize: 12, color: "#6b7280", lineHeight: 18 },

  primaryButton: { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10, marginTop: 8 },
  primaryButtonIcon: { fontSize: 16 },
  primaryButtonText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  secondaryButton: { borderRadius: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16, borderWidth: 1, borderColor: "#e5e7eb", backgroundColor: "#fff" },
  secondaryButtonIcon: { fontSize: 16 },
  secondaryButtonText: { color: "#374151", fontSize: 15, fontWeight: "600" },

  journeyCard: { flexDirection: "row", gap: 12, backgroundColor: TEAL_LIGHT, borderRadius: 14, padding: 16, alignItems: "flex-start", marginBottom: 12 },
  journeyTitle: { fontSize: 13, fontWeight: "700", color: TEAL, marginBottom: 4 },
  journeyDesc: { fontSize: 12, color: "#374151", lineHeight: 18 },

  disclaimerBox: { backgroundColor: "#f9fafb", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 16 },
  disclaimerText: { fontSize: 11, color: "#6b7280", lineHeight: 17 },

  retakeButton: { alignItems: "center", paddingVertical: 12 },
  retakeText: { fontSize: 14, color: "#9ca3af", fontWeight: "600" },
  loadingBanner: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#e6fffa", borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#b2f5ea" },
  loadingText: { color: "#0f766e", fontSize: 12, flex: 1 },
  feedbackBanner: { backgroundColor: "#f8fafc", borderRadius: 14, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#e2e8f0" },
  feedbackText: { color: "#334155", fontSize: 12, lineHeight: 18 },
});