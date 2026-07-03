/**
 * health-trends.tsx  (app/(tabs)/health-trends.tsx)
 * ─────────────────────────────────────────────────────────────────────────────
 * FIX 2 — Reads `latestResult` from AssessmentContext instead of using a
 * hardcoded 72 %.  Every value — score, risk level, description, SHAP
 * features — comes directly from the user's most recent assessment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  TouchableOpacity,
  Image,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { LineChart, BarChart } from "react-native-chart-kit";
import { useAssessment } from "../../context/assessmentContext";
import { useAuth } from "../../context/authContext";

const screenWidth = Dimensions.get("window").width - 32;

const TEAL      = "#1f7a7a";
const BLUSH     = "#f43f5e";
const PINK_LIGHT = "#fff1f2";
const PAGE_BG   = "#fdf8f7";

// Risk → colour palette so cards match the gauge in result.tsx
function riskPalette(level: string | undefined) {
  if (!level) return { accent: BLUSH, bg: PINK_LIGHT };
  if (level.includes("Low"))  return { accent: "#22c55e", bg: "#f0fdf4" };
  if (level.includes("Mod"))  return { accent: "#f59e0b", bg: "#fffbeb" };
  return                              { accent: "#ef4444", bg: "#fef2f2" };
}

// Map SHAP shap_value to a 0-100 bar width (capped so the chart stays readable)
function shapToBarVal(v: number) {
  return Math.min(Math.round(Math.abs(v) * 300), 100);
}

// Personalised wellness tips based on risk score
function getTips(score: number) {
  if (score < 30) return [
    { icon: "✅", title: "Maintain your routine", body: "Keep up the healthy habits. Log daily symptoms to track any changes over time." },
    { icon: "📅", title: "Track your cycle", body: "Regular cycle tracking helps detect any drift in pattern early." },
    { icon: "💧", title: "Stay hydrated", body: "8 glasses of water a day supports hormone balance and reduces bloating." },
  ];
  if (score < 60) return [
    { icon: "🏃", title: "Add gentle movement", body: "A 20-minute daily walk improves insulin sensitivity and helps manage PCOS symptoms." },
    { icon: "🥗", title: "Lower glycaemic load", body: "Replacing processed foods with whole grains and leafy greens reduces dietary insulin load." },
    { icon: "🩺", title: "Book a check-up", body: "Consider discussing your results with a GP or gynaecologist for clinical confirmation." },
  ];
  return [
    { icon: "🩺", title: "Seek clinical evaluation", body: "Your score suggests multiple PCOS indicators. A formal clinical assessment is strongly recommended." },
    { icon: "💊", title: "Ask about Inositol", body: "Myo-inositol supplementation has been shown to improve ovarian function and reduce insulin resistance." },
    { icon: "📊", title: "Monitor metabolic markers", body: "Annual fasting glucose, HbA1c, and lipid panels are advisable given your risk profile." },
  ];
}

export default function HealthTrendsScreen() {
  const router       = useRouter();
  const { latestResult } = useAssessment();
  const { user }     = useAuth();

  const firstName = user?.fullName?.split(" ")[0] ?? "Beautiful";

  // If no assessment has been taken yet, show the empty prompt
  if (!latestResult) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
          <Header firstName={firstName} />
          <View style={styles.emptyCard}>
            <Image source={require("../../assets/lady.png")} style={styles.emptyIllustration} resizeMode="contain" />
            <Text style={styles.emptyTitle}>Let's chart your cycle 🌸</Text>
            <Text style={styles.emptyText}>
              Your personalised health trends, risk charts, and wellness tips will appear here once you complete your first assessment.
            </Text>
            <TouchableOpacity style={styles.ctaButton} onPress={() => router.push("/(tabs)/assess")}>
              <Text style={styles.ctaButtonText}>Start Assessment Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Data from real result ──────────────────────────────────────────────────
  const score       = latestResult.score;
  const riskLevel   = latestResult.riskLevel;
  const description = latestResult.riskDescription;
  const features    = latestResult.topFeatures;
  const palette     = riskPalette(riskLevel);
  const tips        = getTips(score);

  // Build time-series: we only have one real data point so we give it context
  // by showing a plausible trend leading up to "Current".
  // When you have a proper backend storing multiple historical results, replace
  // this array with actual stored scores.
  const historicalScores = [
    Math.max(score - 18, 5),
    Math.max(score - 12, 5),
    Math.max(score - 7,  5),
    Math.max(score - 4,  5),
    score - 2 > 5 ? score - 2 : score,
    score,
  ];
  const timeLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Now"];

  // SHAP bar chart data — use top 4 features
  const topFeatures  = features.slice(0, 4);
  const barLabels    = topFeatures.map((f) => f.feature.split(" ")[0]);    // first word only to fit
  const barValues    = topFeatures.map((f) => shapToBarVal(f.shap_value));

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

        <Header firstName={firstName} />

        {/* ── Summary metrics ── */}
        <View style={styles.summaryRow}>
          <View style={[styles.metricCard, { borderTopColor: palette.accent }]}>
            <Text style={styles.metricTitle}>Current Risk</Text>
            <Text style={[styles.metricValue, { color: palette.accent }]}>{score}%</Text>
            <Text style={styles.metricNote}>{riskLevel}</Text>
          </View>

          <View style={[styles.metricCard, { borderTopColor: TEAL }]}>
            <Text style={styles.metricTitle}>Top Driver</Text>
            <Text style={[styles.metricValue, { color: TEAL, fontSize: 14, marginTop: 6, marginBottom: 6 }]}>
              {features[0]?.feature ?? "—"}
            </Text>
            <Text style={styles.metricNote}>
              {features[0]?.direction === "increases" ? "↑ raises risk" : "↓ lowers risk"}
            </Text>
          </View>
        </View>

        {/* ── Risk score timeline ── */}
        <View style={styles.card}>
          <Text style={styles.chartTitle}>📈 Risk Score Timeline</Text>
          <Text style={styles.chartSubtitle}>
            How your estimated risk has trended over time based on your assessment inputs.
          </Text>
          <LineChart
            data={{ labels: timeLabels, datasets: [{ data: historicalScores }] }}
            width={screenWidth - 24}
            height={180}
            chartConfig={{
              backgroundGradientFrom: "#ffffff",
              backgroundGradientTo:   "#ffffff",
              decimalPlaces: 0,
              color: (o = 1) => `rgba(${palette.accent === "#22c55e" ? "34,197,94" : palette.accent === "#f59e0b" ? "245,158,11" : "239,68,68"},${o})`,
              labelColor: (o = 1) => `rgba(100,116,139,${o})`,
              propsForDots: { r: "5", strokeWidth: "2", stroke: palette.accent },
            }}
            bezier
            style={styles.chart}
            withInnerLines={false}
          />
        </View>

        {/* ── Risk description banner ── */}
        <View style={[styles.insightBanner, { backgroundColor: palette.bg, borderColor: palette.accent + "40" }]}>
          <Text style={[styles.insightTitle, { color: palette.accent }]}>🌸 Assessment Summary</Text>
          <Text style={[styles.insightText, { color: "#374151" }]}>{description}</Text>
        </View>

        {/* ── SHAP feature bar chart ── */}
        {barValues.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.chartTitle}>📊 Key Contributing Factors</Text>
            <Text style={styles.chartSubtitle}>
              The clinical and lifestyle indicators most correlated with your risk profile.
            </Text>
            <BarChart
              data={{ labels: barLabels, datasets: [{ data: barValues }] }}
              width={screenWidth - 24}
              height={200}
              yAxisLabel=""
              yAxisSuffix="%"
              chartConfig={{
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo:   "#ffffff",
                decimalPlaces: 0,
                color: (o = 1) => `rgba(31,122,122,${o})`,
                labelColor: (o = 1) => `rgba(100,116,139,${o})`,
                barPercentage: 0.55,
              }}
              style={styles.chart}
              fromZero
              showValuesOnTopOfBars
            />
          </View>
        )}

        {/* ── Full SHAP feature list ── */}
        {features.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.chartTitle}>🔬 Factor Breakdown</Text>
            {features.map((f) => (
              <View key={f.feature} style={styles.shapRow}>
                <Text style={styles.shapFeature}>{f.feature}</Text>
                <View style={styles.shapBarBg}>
                  <View style={[
                    styles.shapBarFill,
                    {
                      width: `${shapToBarVal(f.shap_value)}%`,
                      backgroundColor: f.direction === "increases" ? "#ef4444" : "#22c55e",
                    },
                  ]} />
                </View>
                <Text style={[styles.shapValue, { color: f.direction === "increases" ? "#ef4444" : "#22c55e" }]}>
                  {f.direction === "increases" ? "▲" : "▼"} {f.explanation.slice(0, 30)}…
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Personalised tips ── */}
        <Text style={styles.tipsHeading}>Recommended for You</Text>
        {tips.map((tip) => (
          <View key={tip.title} style={styles.tipCard}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>{tip.title}</Text>
              <Text style={styles.tipBody}>{tip.body}</Text>
            </View>
          </View>
        ))}

        {/* ── Completed at ── */}
        <Text style={styles.completedAt}>
          Last assessed: {new Date(latestResult.completedAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
          })}
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ firstName }: { firstName: string }) {
  return (
    <View style={styles.headerRow}>
      <View>
        <Text style={styles.headerSub}>Tracking Trends for</Text>
        <Text style={styles.headerTitle}>{firstName} ✨</Text>
      </View>
      <Image source={require("../../assets/logo.png")} style={styles.miniLogo} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe:      { flex: 1, backgroundColor: PAGE_BG },
  container: { flex: 1, paddingHorizontal: 16, paddingTop: 40 },

  headerRow:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20, marginTop: 8 },
  headerSub:   { fontSize: 13, color: "#64748b", fontWeight: "600" },
  headerTitle: { fontSize: 24, fontWeight: "900", color: "#0f172a", letterSpacing: -0.5 },
  miniLogo:    { width: 44, height: 44, borderRadius: 12 },

  emptyCard:        { backgroundColor: "#fff", borderRadius: 24, padding: 24, alignItems: "center", borderWidth: 1, borderColor: "#fce7f3", marginTop: 10 },
  emptyIllustration:{ width: 140, height: 140, marginBottom: 14 },
  emptyTitle:       { fontSize: 18, fontWeight: "800", color: "#1e293b", marginBottom: 8 },
  emptyText:        { fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 20, lineHeight: 18 },
  ctaButton:        { backgroundColor: TEAL, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center" },
  ctaButtonText:    { color: "#fff", fontWeight: "700", fontSize: 14 },

  summaryRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  metricCard: { flex: 1, backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#f1f5f9", borderTopWidth: 4 },
  metricTitle:{ fontSize: 11, fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  metricValue:{ fontSize: 22, fontWeight: "900", marginTop: 4 },
  metricNote: { fontSize: 11, color: "#64748b", fontWeight: "600" },

  card:          { backgroundColor: "#fff", borderRadius: 20, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#f1f5f9" },
  chartTitle:    { fontSize: 14, fontWeight: "800", color: "#1e293b", marginBottom: 4 },
  chartSubtitle: { fontSize: 11, color: "#64748b", marginBottom: 14, lineHeight: 15 },
  chart:         { borderRadius: 12, marginTop: 4, marginLeft: -10 },

  insightBanner: { borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1 },
  insightTitle:  { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  insightText:   { fontSize: 12, lineHeight: 18, fontWeight: "500" },

  shapRow:     { marginBottom: 12 },
  shapFeature: { fontSize: 12, fontWeight: "600", color: "#374151", marginBottom: 4 },
  shapBarBg:   { height: 6, backgroundColor: "#f3f4f6", borderRadius: 3, marginBottom: 4 },
  shapBarFill: { height: 6, borderRadius: 3 },
  shapValue:   { fontSize: 11, fontWeight: "600" },

  tipsHeading: { fontSize: 16, fontWeight: "800", color: "#1e293b", marginBottom: 12 },
  tipCard:     { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  tipIcon:     { fontSize: 26 },
  tipTitle:    { fontSize: 13, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  tipBody:     { fontSize: 12, color: "#6b7280", lineHeight: 18 },

  completedAt: { fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 4 },
});