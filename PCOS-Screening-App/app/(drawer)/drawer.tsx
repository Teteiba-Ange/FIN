// app/(drawer)/drawer.tsx
// Re-engineered Premium PMOS Dashboard — Real Time-Series Charts & Balanced UI Scale

import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../context/authContext";

const { width: SCREEN_W } = Dimensions.get("window");
const TEAL        = "#1f7a7a";
const TEAL_LIGHT  = "#e6f4f4";
const TEAL_DARK   = "#114a4a";
const BLUSH_PINK  = "#f43f5e";
const PINK_LIGHT  = "#fff1f2";
const ORANGE      = "#f59e0b";
const GREEN       = "#10b981";
const RED         = "#ef4444";
const CARD_BG     = "#ffffff";
const PAGE_BG     = "#fdf8f7"; // Premium soft cozy background accent

// ── Animated Smooth Progress Bar ──────────────────────────────────────────────
const AnimBar = ({
  value,
  color = TEAL,
  height = 8,
}: {
  value: number;
  color?: string;
  height?: number;
}) => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: value,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [value]);

  return (
    <View style={{ height, backgroundColor: "#f1f5f9", borderRadius: height / 2, overflow: "hidden" }}>
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          width: anim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
        }}
      />
    </View>
  );
};

// ── Risk Gauge Component ──────────────────────────────────────────────────────
const RiskGauge = ({ score }: { score: number }) => {
  const color = score < 35 ? GREEN : score < 65 ? ORANGE : BLUSH_PINK;
  const label = score < 35 ? "Low Metabolic Risk" : score < 65 ? "Moderate Variance" : "High Screening Risk";
  const segments = 24;
  const filled = Math.round((score / 100) * segments);

  return (
    <View style={gaugeStyles.wrap}>
      <Text style={gaugeStyles.title}>PMOS RISK PROFILE STATUS</Text>
      <View style={gaugeStyles.segRow}>
        {Array.from({ length: segments }).map((_, i) => {
          const active = i < filled;
          const segColor = i < 8 ? GREEN : i < 16 ? ORANGE : BLUSH_PINK;
          return (
            <View
              key={i}
              style={[
                gaugeStyles.seg,
                { backgroundColor: active ? segColor : "#e2e8f0" },
              ]}
            />
          );
        })}
      </View>
      <Text style={[gaugeStyles.score, { color }]}>{score}%</Text>
      <View style={[gaugeStyles.badge, { backgroundColor: color + "15", borderColor: color }]}>
        <Text style={[gaugeStyles.badgeText, { color }]}>{label} ✨</Text>
      </View>
      <Text style={gaugeStyles.hint}>Calculated from your lifestyle & physical metrics profile</Text>
    </View>
  );
};

const gaugeStyles = StyleSheet.create({
  wrap:      { alignItems: "center", paddingVertical: 4 },
  title:     { fontSize: 11, fontWeight: "800", color: "#94a3b8", letterSpacing: 1, marginBottom: 12 },
  segRow:    { flexDirection: "row", gap: 3, flexWrap: "wrap", justifyContent: "center", marginBottom: 12, paddingHorizontal: 10 },
  seg:       { width: (SCREEN_W - 120) / 24, height: 10, borderRadius: 2 },
  score:     { fontSize: 40, fontWeight: "900", color: "#1e293b", marginBottom: 4, letterSpacing: -0.5 },
  badge:     { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4, borderWidth: 1, marginBottom: 8 },
  badgeText: { fontSize: 12, fontWeight: "700" },
  hint:      { fontSize: 11, color: "#64748b", textAlign: "center" },
});

// ── Scaled Balanced Mini Bar Chart ────────────────────────────────────────────
const CompactBarChart = ({
  data,
  barColor = TEAL,
}: {
  data: { label: string; value: number }[];
  barColor?: string;
}) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  const CHART_HEIGHT = 80; // Compact, balanced height parameters

  return (
    <View style={barChartStyles.container}>
      {/* Background Subtle Axis Indicators */}
      <View style={barChartStyles.gridContainer}>
        <View style={barChartStyles.gridLine} />
        <View style={barChartStyles.gridLine} />
        <View style={barChartStyles.gridLine} />
      </View>

      <View style={[barChartStyles.barsRow, { height: CHART_HEIGHT + 24 }]}>
        {data.map((d, i) => {
          const barHeight = (d.value / max) * CHART_HEIGHT;
          return (
            <View key={i} style={barChartStyles.barWrapper}>
              <Text style={barChartStyles.barValueText}>{d.value}d</Text>
              <View
                style={[
                  barChartStyles.barStick,
                  {
                    height: Math.max(barHeight, 6),
                    backgroundColor: barColor,
                  },
                ]}
              />
              <Text style={barChartStyles.barLabelText}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const barChartStyles = StyleSheet.create({
  container: { marginTop: 10, position: "relative" },
  gridContainer: { position: "absolute", top: 12, left: 0, right: 0, height: 60, justifyContent: "space-between" },
  gridLine: { height: 1, backgroundColor: "#f1f5f9", width: "100%" },
  barsRow: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  barWrapper: { flex: 1, alignItems: "center" },
  barValueText: { fontSize: 10, color: "#475569", fontWeight: "700", marginBottom: 4 },
  barStick: { width: 14, borderRadius: 10, opacity: 0.9 }, // Clean refined slim width parameters
  barLabelText: { fontSize: 10, color: "#94a3b8", fontWeight: "600", marginTop: 6 },
});

// ── Real Continuous Time-Series Graph Line Generator ─────────────────────────
const ContinuousTimeSeriesGraph = ({ values, labels, lineColor = BLUSH_PINK }: { values: number[]; labels: string[]; lineColor?: string }) => {
  const max = Math.max(...values, 100);
  const min = Math.min(...values, 0);
  const graphHeight = 75;
  
  return (
    <View style={timeSeriesStyles.container}>
      {/* Background Y-Axis Guide Markers */}
      <View style={timeSeriesStyles.yAxisContainer}>
        <Text style={timeSeriesStyles.axisMarkerText}>{max}%</Text>
        <Text style={timeSeriesStyles.axisMarkerText}>{(max+min)/2}%</Text>
        <Text style={timeSeriesStyles.axisMarkerText}>{min}%</Text>
      </View>

      <View style={timeSeriesStyles.graphRightBlock}>
        {/* Plotting Coordinates Area */}
        <View style={[timeSeriesStyles.plotZone, { height: graphHeight }]}>
          {/* Horizontal dotted alignment guides */}
          <View style={timeSeriesStyles.dottedHorizontalGuide} />
          <View style={timeSeriesStyles.dottedHorizontalGuide} />
          
          <View style={timeSeriesStyles.nodesConnectionRow}>
            {values.map((val, idx) => {
              // Calculate responsive mathematical distribution mapping offsets safely
              const positionPercentage = ((val - min) / (max - min || 1)) * 100;
              
              return (
                <View key={idx} style={timeSeriesStyles.nodeColumn}>
                  {/* Vertical coordinate link lines */}
                  <View style={[timeSeriesStyles.nodePlotPoint, { bottom: `${positionPercentage}%`, backgroundColor: lineColor }]}>
                    <View style={timeSeriesStyles.innerPulseCore} />
                  </View>
                  
                  {/* Trend connector connector background strip elements */}
                  {idx < values.length - 1 && (
                    <View style={[timeSeriesStyles.trendConnectorStrip, { bottom: `${positionPercentage}%`, backgroundColor: lineColor + "25" }]} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* X-Axis Timeline Labels */}
        <View style={timeSeriesStyles.xAxisRow}>
          {labels.map((lbl, idx) => (
            <Text key={idx} style={timeSeriesStyles.xAxisLabelText}>{lbl}</Text>
          ))}
        </View>
      </View>
    </View>
  );
};

const timeSeriesStyles = StyleSheet.create({
  container: { flexDirection: "row", marginTop: 14, gap: 8 },
  yAxisContainer: { justifyContent: "space-between", height: 75, paddingVertical: 2, alignItems: "flex-end", width: 28 },
  axisMarkerText: { fontSize: 9, color: "#94a3b8", fontWeight: "700" },
  graphRightBlock: { flex: 1 },
  plotZone: { position: "relative", justifyContent: "center", backgroundColor: "#fafafa", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: "#f1f5f9" },
  dottedHorizontalGuide: { height: 1, borderStyle: "dashed", borderWidth: 0.5, borderColor: "#e2e8f0", width: "100%", marginVertical: 12 },
  nodesConnectionRow: { flexDirection: "row", justifyContent: "space-between", position: "absolute", left: 14, right: 14, top: 0, bottom: 0 },
  nodeColumn: { flex: 1, alignItems: "center", position: "relative" },
  nodePlotPoint: { width: 10, height: 10, borderRadius: 5, position: "absolute", transform: [{ translateX: 0 }, { translateY: 5 }], zIndex: 3, justifyContent: "center", alignItems: "center" },
  innerPulseCore: { width: 4, height: 4, borderRadius: 2, backgroundColor: "#fff" },
  trendConnectorStrip: { position: "absolute", left: "50%", width: SCREEN_W / 7, height: 2, zIndex: 1 },
  xAxisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8, paddingHorizontal: 10 },
  xAxisLabelText: { fontSize: 10, color: "#94a3b8", fontWeight: "700" },
});

// ── Symptom Progression Row Component ─────────────────────────────────────────
const SymptomRow = ({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) => (
  <View style={{ marginBottom: 12 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4, alignItems: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <Text style={{ fontSize: 15 }}>{icon}</Text>
        <Text style={{ fontSize: 13, fontWeight: "700", color: "#334155" }}>{label}</Text>
      </View>
      <Text style={{ fontSize: 12, fontWeight: "800", color }}>{value}% Severity</Text>
    </View>
    <AnimBar value={value} color={color} height={6} />
  </View>
);

// ── Metrics Stat Highlight Card ───────────────────────────────────────────────
const StatCard = ({ icon, label, value, unit, delta, color = TEAL }: { icon: string; label: string; value: string; unit?: string; delta?: string; color?: string }) => (
  <View style={[styles.statCard, { borderColor: color + "40" }]}>
    <View style={styles.statHeaderRow}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statDeltaText, { color }]}>{delta}</Text>
    </View>
    <Text style={styles.statLabel}>{label}</Text>
    <View style={{ flexDirection: "row", alignItems: "baseline", gap: 2, marginTop: 2 }}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {unit && <Text style={styles.statUnit}>{unit}</Text>}
    </View>
  </View>
);

// ─── MAIN RE-ENGINEERED DASHBOARD SCREEN ─────────────────────────────────────
export default function DashboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const firstName = user?.fullName?.split(" ")[0] || "there";

  const riskScore = 72;
  const cycleHistory = [
    { label: "Jan", value: 28 },
    { label: "Feb", value: 31 },
    { label: "Mar", value: 29 },
    { label: "Apr", value: 35 },
    { label: "May", value: 28 },
    { label: "Jun", value: 30 },
  ];

  const seriesTimelineLabels = ["Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6", "Wk 7"];
  const androgenHormoneIndexData = [42, 55, 48, 65, 58, 70, 72];

  const symptomList = [
    { icon: "🦱", label: "Hirsutism / Hair Loss", value: 65, color: BLUSH_PINK },
    { icon: "🌙", label: "Cycle Irregularity",   value: 80, color: ORANGE },
    { icon: "⚡", label: "Chronic Fatigue",       value: 55, color: "#8b5cf6" },
    { icon: "🔴", label: "Androgenic Acne",       value: 70, color: RED },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* Dynamic Header Space */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Assessment Analysis</Text>
          <Text style={styles.headerSub}>Hormone & Metabolic Workspace for {firstName} ✨</Text>
        </View>
        <TouchableOpacity style={styles.assessBtn} onPress={() => router.push("/assess")}>
          <Text style={styles.assessBtnText}>Re-Assess</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        {/* Core Risk Profile Overview */}
        <View style={styles.card}>
          <RiskGauge score={riskScore} />
        </View>

        {/* Horizontal Quick Metrics Grid */}
        <Text style={styles.sectionTitle}>KEY METRIC STABILITY BASELINES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: "row", gap: 10, paddingRight: 16 }}>
            <StatCard icon="⚖️"  label="BMI State"      value="17.7" unit="m²"     delta="Underweight" color={ORANGE} />
            <StatCard icon="📏"  label="Waist-Hip Ratio" value="0.85" unit="ratio"  delta="Slightly High" color={RED} />
            <StatCard icon="🔄"  label="Latest Cycle"   value="28"   unit="days"   delta="Optimal"     color={GREEN} />
            <StatCard icon="📅"  label="Screenings"     value="3"    unit="logs"   delta="Completed"   color={TEAL} />
          </View>
        </ScrollView>

        {/* Real Continuous Time-Series Graph Trends Panel */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>📈 Continuous Hormone Index Trend</Text>
              <Text style={styles.cardDescriptionSub}>Tracks dynamic metabolic and lipid responses over time</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: PINK_LIGHT }]}>
              <Text style={[styles.badgeText, { color: BLUSH_PINK }]}>7 Weeks</Text>
            </View>
          </View>
          
          <ContinuousTimeSeriesGraph values={androgenHormoneIndexData} labels={seriesTimelineLabels} lineColor={BLUSH_PINK} />
          
          <View style={styles.trendNoticeBlock}>
            <Text style={styles.trendNoticeText}>
              ⚠️ High-end variation curve detected across trailing intervals. We advise bringing these tracking insights to your next endocrinology panel session.
            </Text>
          </View>
        </View>

        {/* Re-Scaled Compact Balanced Cycle History Bar Chart */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardTitle}>📊 Historical Cycle Variation</Text>
              <Text style={styles.cardDescriptionSub}>Monitors calendar boundaries for period spacing variations</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: TEAL_LIGHT }]}>
              <Text style={[styles.badgeText, { color: TEAL }]}>6 Months</Text>
            </View>
          </View>
          <CompactBarChart data={cycleHistory} barColor={TEAL} />
        </View>

        {/* Symptom Screening Progression List */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>🩺 Identified Symptom Loads</Text>
            <View style={[styles.badge, { backgroundColor: "#f1f5f9" }]}>
              <Text style={[styles.badgeText, { color: "#475569" }]}>Current Status</Text>
            </View>
          </View>
          {symptomList.map((symp) => (
            <SymptomRow key={symp.label} {...symp} />
          ))}
        </View>

        {/* Clinically Driven Personalized Care Recommendations */}
        <Text style={styles.sectionTitle}>TAILORED METABOLIC PROTOCOLS</Text>
        {[
          { icon: "🥗", title: "Adopt Low-Glycemic Load Diet Strategy", sub: "Reduces circulating insulin levels to stabilize ovarian pathways.", color: GREEN },
          { icon: "🏃‍♀️", title: "Targeted Resistance & Low-Intensity Movement", sub: "Optimizes muscle glucose receptors without triggering cortisol spikes.", color: TEAL },
          { icon: "💊", title: "Review Myo-Inositol & Micronutrient Supplementation", sub: "Aids intracellular messenger signaling processes for period regularity.", color: ORANGE },
        ].map((rec, index) => (
          <TouchableOpacity key={index} style={[styles.recCard, { borderLeftColor: rec.color }]}>
            <Text style={styles.recIcon}>{rec.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.recTitle}>{rec.title}</Text>
              <Text style={styles.recSub}>{rec.sub}</Text>
            </View>
            <Text style={{ color: "#cbd5e1", fontSize: 18, fontWeight: "700" }}>›</Text>
          </TouchableOpacity>
        ))}

        {/* Onboarding / Retake Call to Action Card Section */}
        <View style={styles.ctaBanner}>
          <Text style={styles.ctaTitle}>✨ Track Ongoing Progress Patterns</Text>
          <Text style={styles.ctaSub}>
            Your physiological markers optimize dynamically alongside dietary improvements. Keep updating your screening profiles to maintain real-time insight accuracy.
          </Text>
          <TouchableOpacity style={styles.ctaButton} onPress={() => router.push("/assess")}>
            <Text style={styles.ctaButtonText}>Retake Full Assessment</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: PAGE_BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: TEAL_DARK,
  },
  backBtn: { width: 32, height: 32, justifyContent: "center", alignItems: "center" },
  backIcon: { fontSize: 22, color: "#fff", fontWeight: "700" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  assessBtn: {
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  assessBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  container: { padding: 16 },
  sectionTitle: { fontSize: 11, fontWeight: "800", color: "#94a3b8", letterSpacing: 1, marginBottom: 10, marginTop: 8 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fce7f3", // Soft feminine outline boundaries
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: "#1e293b" },
  cardDescriptionSub: { fontSize: 11, color: "#64748b", marginTop: 2 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 10, fontWeight: "800" },

  // Individual Metric Cards Style Definitions
  statCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 12,
    width: 120,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  statHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  statIcon: { fontSize: 20 },
  statDeltaText: { fontSize: 10, fontWeight: "700", opacity: 0.85 },
  statLabel: { fontSize: 11, color: "#64748b", fontWeight: "600" },
  statValue: { fontSize: 19, fontWeight: "900", marginTop: 2 },
  statUnit: { fontSize: 10, color: "#94a3b8", fontWeight: "600", marginLeft: 1 },

  trendNoticeBlock: { backgroundColor: PINK_LIGHT, borderRadius: 10, padding: 10, marginTop: 14 },
  trendNoticeText: { fontSize: 11, color: BLUSH_PINK, fontWeight: "600", lineHeight: 16 },

  // Recommendation Panels Setup
  recCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  recIcon: { fontSize: 22 },
  recTitle: { fontSize: 13, fontWeight: "800", color: "#1e293b" },
  recSub: { fontSize: 12, color: "#64748b", marginTop: 3, lineHeight: 16 },

  // Interactive Bottom Banner Section Setup
  ctaBanner: { backgroundColor: TEAL_DARK, borderRadius: 20, padding: 18, marginTop: 12 },
  ctaTitle: { fontSize: 15, fontWeight: "800", color: "#fff", marginBottom: 6 },
  ctaSub: { fontSize: 12, color: "rgba(255,255,255,0.8)", lineHeight: 18, marginBottom: 14 },
  ctaButton: { backgroundColor: "#fff", borderRadius: 12, paddingVertical: 12, alignItems: "center", width: "100%" },
  ctaButtonText: { color: TEAL_DARK, fontSize: 13, fontWeight: "800" },
});