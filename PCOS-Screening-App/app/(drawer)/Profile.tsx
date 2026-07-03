/**
 * Profile.tsx  (app/(drawer)/Profile.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX 1 — Physical metrics (age, weight, height, BMI) entered during Step 1
 * of the assessment are now pre-filled here automatically via profileSync
 * from AssessmentContext.
 *
 * How it works:
 *   1. User fills in age/weight/height in Step 1.
 *   2. assessmentContext.tsx stores those values in `profileSync`.
 *   3. This screen reads `profileSync` and uses it as initial state.
 *   4. If the user edits the profile manually those edits take precedence.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  SafeAreaView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAssessment } from "../../context/assessmentContext";
import { useAuth } from "../../context/authContext";

const TEAL       = "#1f7a7a";
const TEAL_LIGHT = "#e6f4f4";

// ── helpers ───────────────────────────────────────────────────────────────────

const getBMILabel = (bmi: number) => {
  if (bmi < 18.5) return { label: "Underweight", color: "#3b82f6" };
  if (bmi < 25)   return { label: "Healthy Range", color: "#22c55e" };
  if (bmi < 30)   return { label: "Overweight",    color: "#f59e0b" };
  return                  { label: "Obese",         color: "#ef4444" };
};

function SectionLabel({ title }: { title: string }) {
  return <Text style={styles.sectionLabel}>{title}</Text>;
}

function MetricCard({ icon, label, value, unit }: { icon: string; label: string; value: string | number; unit?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricIcon}>{icon}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value || "—"}</Text>
        {unit && <Text style={styles.metricUnit}>{unit}</Text>}
      </View>
    </View>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>✓ {label}</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();
  const { profileSync, latestResult } = useAssessment();
  const { user, logout } = useAuth();

  // ── FIX 1: initialise with assessment values if available ─────────────────
  const [age,    setAge]    = useState(profileSync?.age    ?? "");
  const [weight, setWeight] = useState(profileSync?.weight ?? "");
  const [height, setHeight] = useState(profileSync?.height ?? "");
  const [bmiStr, setBmiStr] = useState(profileSync?.bmi    ?? "");

  // Whenever the assessment updates profileSync, refresh the fields
  // (but only if the user hasn't manually edited them to something different)
  useEffect(() => {
    if (!profileSync) return;
    if (profileSync.age    && !age)    setAge(profileSync.age);
    if (profileSync.weight && !weight) setWeight(profileSync.weight);
    if (profileSync.height && !height) setHeight(profileSync.height);
    if (profileSync.bmi    && !bmiStr) setBmiStr(profileSync.bmi);
  }, [profileSync]);          // re-run whenever a new assessment updates sync

  const bmiNum = parseFloat(bmiStr);
  const bmiInfo = bmiNum > 0 ? getBMILabel(bmiNum) : null;

  // Use auth user name / email if available
  const fullName = user?.fullName ?? "Elena Richardson";
  const email    = user?.email    ?? "elena.r@wellness.app";
  const initials = fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  // Build medical tags from the latest assessment result
  const medicalTags: string[] = [];
  if (latestResult) {
    if (latestResult.riskLevel.includes("High"))     medicalTags.push("High PCOS Risk");
    if (latestResult.riskLevel.includes("Moderate")) medicalTags.push("Moderate PCOS Risk");
    latestResult.topFeatures.forEach((f) => {
      if (f.direction === "increases" && f.feature.includes("Androgen")) medicalTags.push("Androgenic Indicators");
      if (f.direction === "increases" && f.feature.includes("Metabolic")) medicalTags.push("Metabolic Factors");
      if (f.direction === "increases" && f.feature.includes("Menstrual")) medicalTags.push("Irregular Cycles");
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Nav */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push("/drawer")}>
          <Text style={styles.navIcon}>☰</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>PCOS Wellness</Text>
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarFallbackText}>{initials}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

        {/* Page header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>My Profile</Text>
            <Text style={styles.pageSubtitle}>Manage your health data</Text>
          </View>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => router.push("/(drawer)/edit-profile")}
          >
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Account settings */}
        <SectionLabel title="ACCOUNT SETTINGS" />
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Full Name</Text>
            <View style={styles.infoValueRow}>
              <Text style={styles.infoIcon}>👤</Text>
              <Text style={styles.infoValue}>{fullName}</Text>
            </View>
          </View>
          <View style={[styles.infoRow, { marginTop: 14 }]}>
            <Text style={styles.infoLabel}>Email Address</Text>
            <View style={styles.infoValueRow}>
              <Text style={styles.infoIcon}>✉️</Text>
              <Text style={styles.infoValue}>{email}</Text>
            </View>
          </View>
        </View>

        {/* Physical metrics — populated from assessment FIX 1 */}
        <SectionLabel title="PHYSICAL METRICS" />
        {(age || weight || height) ? (
          <>
            <View style={styles.metricsRow}>
              <MetricCard icon="🎂" label="Age"    value={age}    unit="yrs" />
              <MetricCard icon="⚖️" label="Weight" value={weight} unit="kg"  />
              <MetricCard icon="📏" label="Height" value={height} unit="cm"  />
            </View>

            {/* BMI card */}
            {bmiInfo && (
              <View style={[styles.bmiCard, { backgroundColor: TEAL }]}>
                <View>
                  <Text style={styles.bmiLabel}>CALCULATED BMI</Text>
                  <Text style={styles.bmiValue}>{bmiStr}</Text>
                  <Text style={styles.bmiRange}>{bmiInfo.label}</Text>
                </View>
                <View style={styles.bmiIconBox}>
                  <Text style={{ fontSize: 24 }}>🎯</Text>
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.emptyMetrics}>
            <Text style={styles.emptyMetricsText}>
              Complete Step 1 of the assessment to see your physical metrics here automatically.
            </Text>
            <TouchableOpacity
              style={styles.emptyMetricsCta}
              onPress={() => router.push("/(tabs)/assess")}
            >
              <Text style={styles.emptyMetricsCtaText}>Take Assessment →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Latest risk score */}
        {latestResult && (
          <>
            <SectionLabel title="LATEST ASSESSMENT" />
            <View style={[styles.card, { backgroundColor: TEAL_LIGHT }]}>
              <View style={styles.riskRow}>
                <View>
                  <Text style={styles.riskScore}>{latestResult.score}%</Text>
                  <Text style={[styles.riskLevel, { color: latestResult.riskColor }]}>
                    {latestResult.riskLevel}
                  </Text>
                  <Text style={styles.riskDate}>
                    {new Date(latestResult.completedAt).toLocaleDateString("en-GB", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.viewTrendsBtn}
                  onPress={() => router.push("/(tabs)/health-trends")}
                >
                  <Text style={styles.viewTrendsBtnText}>View Trends →</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* Medical background from assessment */}
        {medicalTags.length > 0 && (
          <>
            <SectionLabel title="ASSESSMENT INDICATORS" />
            <View style={styles.card}>
              <Text style={styles.medicalNote}>
                Based on your latest assessment the following clinical indicators were flagged.
                These are for reference only and do not constitute a diagnosis.
              </Text>
              <View style={styles.tagsRow}>
                {medicalTags.map((tag) => <Tag key={tag} label={tag} />)}
              </View>
            </View>
          </>
        )}

        {/* Upload CTA */}
        <View style={styles.ctaBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Need to update your clinical data?</Text>
            <Text style={styles.ctaSubtitle}>
              Upload your latest lab results for a more accurate risk assessment and personalised wellness plan.
            </Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => router.push("/upload-reports")}
            >
              <Text style={styles.uploadButtonText}>Upload Reports</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.ctaDecor}>➕</Text>
        </View>

        <TouchableOpacity
          style={styles.logoutStandaloneButton}
          onPress={async () => {
            await logout();
            router.replace("/login");
          }}
        >
          <Text style={styles.logoutStandaloneButtonText}>Logout</Text>
        </TouchableOpacity>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f5f7fa" },
  navBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#eee" },
  navIcon: { fontSize: 20, color: TEAL },
  navTitle: { fontSize: 16, fontWeight: "700", color: TEAL },
  avatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: TEAL, justifyContent: "center", alignItems: "center" },
  avatarFallbackText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  container: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20 },

  pageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 22 },
  pageTitle: { fontSize: 24, fontWeight: "800", color: "#1a1a1a" },
  pageSubtitle: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  editButton: { backgroundColor: TEAL, paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  editButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  sectionLabel: { fontSize: 11, fontWeight: "700", color: "#9ca3af", letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },

  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 18, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  infoRow: {},
  infoLabel: { fontSize: 12, color: "#9ca3af", marginBottom: 4 },
  infoValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoIcon: { fontSize: 15 },
  infoValue: { fontSize: 15, fontWeight: "600", color: "#1a1a1a" },

  metricsRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  metricCard: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  metricIcon: { fontSize: 20, marginBottom: 6 },
  metricLabel: { fontSize: 11, color: "#9ca3af", marginBottom: 4 },
  metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  metricValue: { fontSize: 18, fontWeight: "800", color: "#1a1a1a" },
  metricUnit: { fontSize: 11, color: "#9ca3af", fontWeight: "500" },

  bmiCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderRadius: 14, padding: 18, marginBottom: 18 },
  bmiLabel: { fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  bmiValue: { fontSize: 28, fontWeight: "900", color: "#fff" },
  bmiRange: { fontSize: 13, fontWeight: "600", color: "#a7f3d0", marginTop: 2 },
  bmiIconBox: { width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center" },

  emptyMetrics: { backgroundColor: "#fff", borderRadius: 14, padding: 20, marginBottom: 18, alignItems: "center", borderWidth: 1.5, borderColor: "#e5e7eb", borderStyle: "dashed" },
  emptyMetricsText: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 19, marginBottom: 14 },
  emptyMetricsCta: { backgroundColor: TEAL, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  emptyMetricsCtaText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  riskRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  riskScore: { fontSize: 32, fontWeight: "900", color: "#1a1a1a" },
  riskLevel: { fontSize: 14, fontWeight: "700", marginTop: 2 },
  riskDate:  { fontSize: 11, color: "#6b7280", marginTop: 4 },
  viewTrendsBtn: { backgroundColor: TEAL, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  viewTrendsBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  medicalNote: { fontSize: 12, color: "#6b7280", lineHeight: 18, marginBottom: 12 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tag: { backgroundColor: TEAL_LIGHT, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  tagText: { fontSize: 12, color: TEAL, fontWeight: "600" },

  ctaBanner: { backgroundColor: TEAL, borderRadius: 16, padding: 20, flexDirection: "row", alignItems: "center", gap: 12, overflow: "hidden" },
  ctaTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 6 },
  ctaSubtitle: { fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 18, marginBottom: 14 },
  uploadButton: { backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9, alignSelf: "flex-start" },
  uploadButtonText: { color: TEAL, fontWeight: "700", fontSize: 13 },
  logoutStandaloneButton: { backgroundColor: "#dc2626", borderRadius: 12, paddingHorizontal: 18, paddingVertical: 14, marginTop: 18, alignItems: "center" },
  logoutStandaloneButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  ctaDecor: { fontSize: 60, opacity: 0.15, position: "absolute", right: 10, bottom: -4 }
});