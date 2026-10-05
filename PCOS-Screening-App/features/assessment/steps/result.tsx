/**
 * Assessment result.
 *
 * The most consequential screen in the app, so two things are non-negotiable:
 *
 * 1. We never present an estimate as a model output. If the ML service can't
 *    be reached we fall back to a simple local score — but we say so plainly,
 *    and we do NOT show feature attributions for it. The previous version
 *    manufactured SHAP-shaped objects with invented values, which looked
 *    identical to real model explanations.
 *
 * 2. The disclaimer is placed where it's read, not buried under the fold.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Button,
  Text,
  RiskMeter,
  levelFromScore,
} from "@/components/ui";
import { apiService } from "@/lib/api";
import { useAuth } from "@/features/auth";
import { useTheme, spacing, radius } from "@/theme";

import { useAssessment, type AssessmentResult, type ShapFeature } from "../assessmentContext";

/** Where the number on screen came from. Drives what we're allowed to claim. */
type Source = "model" | "estimate" | "pending";

// ── Local fallback ───────────────────────────────────────────────────────────
// A transparent points tally, used only when the model is unreachable. It is
// deliberately simple: it exists so the user isn't left with a blank screen,
// not to approximate the model.

function computeLocalScore(data: ReturnType<typeof useAssessment>["data"]): number {
  let score = 30;
  if (data.cycleRegularity === "Irregular") score += 24;
  if (data.cycleRegularity === "No Cycle") score += 30;
  if (data.symptoms.includes("hair_growth")) score += 10;
  if (data.symptoms.includes("acne")) score += 8;
  if (data.symptoms.includes("weight_gain")) score += 8;
  if (data.symptoms.includes("skin_darkening")) score += 6;
  if (data.symptoms.includes("fatigue")) score += 4;
  if (data.familyHistory.includes("pcos")) score += 12;
  if (data.familyHistory.includes("diabetes")) score += 6;
  if (data.exerciseHabit === "Sedentary") score += 5;
  if (["3–4x / week", "Daily"].includes(data.fastFoodFrequency)) score += 5;

  const w = parseFloat(data.weight);
  const h = parseFloat(data.height) / 100;
  if (w > 0 && h > 0) {
    const bmi = w / (h * h);
    if (bmi >= 30) score += 8;
    else if (bmi >= 25) score -= 3;
  }
  return Math.min(Math.max(Math.round(score), 5), 97);
}

// ── Suggestions ──────────────────────────────────────────────────────────────
// General, non-prescriptive guidance tied to what the user actually reported.
// Nothing here names a supplement or cites a statistic.

type Suggestion = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

function getSuggestions(data: ReturnType<typeof useAssessment>["data"]): Suggestion[] {
  const out: Suggestion[] = [];

  if (data.cycleRegularity !== "Regular")
    out.push({
      icon: "calendar-outline",
      title: "Keep tracking your cycle",
      body: "A few months of logged dates gives a clinician far more to work with than a single description.",
    });

  if (data.exerciseHabit === "Sedentary")
    out.push({
      icon: "walk-outline",
      title: "Build in regular movement",
      body: "Activity you can sustain matters more than intensity. A daily walk counts.",
    });

  if (["3–4x / week", "Daily"].includes(data.fastFoodFrequency))
    out.push({
      icon: "nutrition-outline",
      title: "Look at everyday meals",
      body: "Swapping some processed food for whole grains, beans and vegetables is a common first step.",
    });

  if (data.familyHistory.includes("diabetes"))
    out.push({
      icon: "medkit-outline",
      title: "Mention your family history",
      body: "Tell your doctor about diabetes in the family — it may change what they screen for.",
    });

  if (out.length === 0)
    out.push({
      icon: "checkmark-circle-outline",
      title: "Keep doing what you're doing",
      body: "Nothing here flagged strongly. Reassess in a few months, or sooner if something changes.",
    });

  return out.slice(0, 3);
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function ResultsScreen({ onRestart }: { onRestart: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { data, reset, setLatestResult } = useAssessment();

  const [source, setSource] = useState<Source>("pending");
  const [modelResult, setModelResult] = useState<AssessmentResult | null>(null);
  const [note, setNote] = useState<string | null>(null);

  /** Groq-generated guidance, when it arrives. Null means use the built-ins. */
  const [aiSuggestions, setAiSuggestions] = useState<Suggestion[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const localScore = useMemo(() => computeLocalScore(data), [data]);
  const localSuggestions = useMemo(() => getSuggestions(data), [data]);

  const pending = source === "pending";

  /**
   * No score exists until the source is known.
   *
   * This used to be `modelResult?.score ?? localScore`, which meant the local
   * fallback figure was rendered — as a number, an arc, a colour and a risk
   * band — the moment the screen mounted, then silently changed when the model
   * replied. Someone reading "68, high risk" and then seeing it become "34,
   * moderate" has been told two different things about their health, and the
   * first one is the one that sticks.
   *
   * The meter now shows nothing until there is something true to show.
   */
  const score = source === "model" ? (modelResult?.score ?? 0) : localScore;
  const level = levelFromScore(score);

  // Attributions are shown only when they came from the model.
  const drivers: ShapFeature[] =
    source === "model" ? (modelResult?.topFeatures ?? []) : [];

  /**
   * Asks the server for guidance tailored to the answers.
   *
   * Fire-and-forget, and always *after* a result is on screen — the score must
   * never wait on a language model. If it fails, or generation is unavailable,
   * the built-in suggestions are already rendered and nothing looks broken.
   */
  const fetchGuidance = useCallback(
    (riskLevel: string) => {
      setAiLoading(true);
      apiService
        .getRecommendations({
          cycleRegularity: data.cycleRegularity,
          symptoms: data.symptoms,
          exerciseHabit: data.exerciseHabit,
          fastFoodFrequency: data.fastFoodFrequency,
          familyHistory: data.familyHistory,
          riskLevel,
        })
        .then((response) => {
          if (response?.suggestions?.length) {
            setAiSuggestions(
              response.suggestions.map((s) => ({
                icon: s.icon as Suggestion["icon"],
                title: s.title,
                body: s.body,
              }))
            );
          }
        })
        .catch(() => {
          // The built-in suggestions are already rendered. Nothing to say.
        })
        .finally(() => setAiLoading(false));
    },
    [data]
  );

  const runAssessment = useCallback(async () => {
    setSource("pending");
    setNote(null);

    if (!user) {
      setSource("estimate");
      setNote("Sign in to run the full assessment and save your history.");
      return;
    }

    try {
      await apiService.recordSymptoms({
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
      });

      const api = await apiService.predictPCOSRisk({
        age: data.age,
        weight: data.weight,
        height: data.height,
        // Sent so the backend stops substituting a hardcoded 0.85 for every
        // user. Absent when the user skipped the optional fields, which the
        // mapper handles explicitly. (D-02 in PLAN.md.)
        waist: data.waist,
        hip: data.hip,
        cycleRegularity: data.cycleRegularity,
        cycleLength: data.cycleLength,
        avgPeriodDuration: data.avgPeriodDuration,
        symptoms: data.symptoms,
        fastFoodFrequency: data.fastFoodFrequency,
        exerciseHabit: data.exerciseHabit,
        maritalStatus: data.maritalStatus,
        familyHistory: data.familyHistory,
      });

      const result: AssessmentResult = {
        score: api.score,
        riskLevel: api.riskLevel,
        riskColor: api.riskColor ?? "",
        riskDescription: api.riskDescription ?? "",
        topFeatures: api.topFeatures ?? [],
        completedAt: new Date().toISOString(),
      };

      setModelResult(result);
      setLatestResult(result);
      setSource("model");

      fetchGuidance(api.riskLevel);
    } catch (error) {
      console.warn("[ASSESSMENT] Model unavailable, using local estimate:", error);
      setSource("estimate");
      setNote("We couldn't reach the assessment service, so this is a rough estimate.");
      setLatestResult({
        score: localScore,
        riskLevel: level,
        riskColor: "",
        riskDescription: "",
        topFeatures: [],
        completedAt: new Date().toISOString(),
      });

      // Guidance is derived from the user's *answers*, not the score, so it is
      // just as valid here — and this is precisely when the app is degraded
      // and tailored advice is worth more, not less. It previously lived
      // inside the try block, so an unreachable ML service silently cost the
      // user their personalised suggestions as well as their real score.
      fetchGuidance(level);
    }
    // `level` and `localScore` derive from `data`; listing them would re-run
    // the network call on every keystroke upstream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, data, setLatestResult]);

  useEffect(() => {
    runAssessment();
    // Run once on mount — re-running would re-submit the symptom record.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRetake = () => {
    reset();
    onRestart();
  };

  return (
    <Screen>
      <ScreenHeader title="Your result" showBack={false} />

      <RiskMeter
        score={score}
        level={level}
        pending={pending}
        caption={pending ? "Working out your result…" : undefined}
        style={styles.meter}
      />

      {/* Provenance — the user should always know what produced this number. */}
      <Card
        variant="sunken"
        style={[
          styles.provenance,
          source === "estimate" && { backgroundColor: colors.riskModerateSubtle },
        ]}
      >
        <Ionicons
          name={
            source === "model"
              ? "shield-checkmark-outline"
              : source === "pending"
                ? "time-outline"
                : "information-circle-outline"
          }
          size={18}
          color={source === "estimate" ? colors.riskModerate : colors.textSecondary}
        />
        <Text variant="callout" color="textSecondary" style={styles.provenanceText}>
          {source === "model"
            ? "Calculated by the screening model from your answers."
            : source === "pending"
              ? "Checking with the screening service…"
              : (note ?? "This is a rough estimate, not the screening model.")}
        </Text>
      </Card>

      {source === "estimate" && (
        <Button
          label="Try again"
          onPress={runAssessment}
          variant="secondary"
          size="sm"
          icon="refresh-outline"
          style={styles.retry}
        />
      )}

      {/*
        Only rendered for model results. An estimate has no attributions, and
        inventing some to fill the space is how the previous version misled.
      */}
      {drivers.length > 0 && (
        <Section title="What influenced this" style={styles.section}>
          <Card padded={false} style={styles.driverCard}>
            {drivers.map((d, i) => (
              <View
                key={d.feature}
                style={[
                  styles.driverRow,
                  i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                ]}
              >
                <Ionicons
                  name={d.direction === "increases" ? "trending-up" : "trending-down"}
                  size={17}
                  color={d.direction === "increases" ? colors.riskHigh : colors.riskLow}
                />
                <View style={styles.driverText}>
                  <Text variant="bodyStrong">{d.feature}</Text>
                  <Text variant="caption" color="textSecondary">
                    {d.direction === "increases" ? "Raises" : "Lowers"} your score
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      )}

      {/*
        Guidance. The built-in suggestions render immediately; if Groq returns
        something that passes the server's content checks, it replaces them.
        Generated content is labelled as generated — the user is entitled to
        know which of the two they are reading.
      */}
      {!pending && (
        <Section title="What you can do" style={styles.section}>
          {aiLoading && !aiSuggestions && (
            <View style={styles.aiLoading}>
              <ActivityIndicator size="small" color={colors.textTertiary} />
              <Text variant="caption" color="textTertiary">
                Tailoring these to your answers…
              </Text>
            </View>
          )}

          <View style={styles.suggestions}>
            {(aiSuggestions ?? localSuggestions).map((s) => (
              <Card key={s.title}>
                <View style={styles.suggestionRow}>
                  <View style={[styles.suggestionIcon, { backgroundColor: colors.primarySubtle }]}>
                    <Ionicons name={s.icon} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.suggestionText}>
                    <Text variant="bodyStrong">{s.title}</Text>
                    <Text variant="callout" color="textSecondary">
                      {s.body}
                    </Text>
                  </View>
                </View>
              </Card>
            ))}
          </View>

          {aiSuggestions && (
            <View style={styles.aiNote}>
              <Ionicons name="sparkles-outline" size={13} color={colors.textTertiary} />
              <Text variant="caption" color="textTertiary" style={styles.aiNoteText}>
                Written for you by AI from the answers you gave. General
                suggestions only — it doesn&apos;t know your medical history.
              </Text>
            </View>
          )}
        </Section>
      )}

      {/* Placed above the actions so it is read before anything is tapped. */}
      <Card variant="sunken" style={styles.disclaimer}>
        <Text variant="label" color="textTertiary">
          Important
        </Text>
        <Text variant="callout" color="textSecondary">
          This is a screening estimate, not a diagnosis. Only a qualified
          healthcare professional can diagnose PCOS, using examination and
          tests this app cannot perform. Take this result to them — it is a
          useful starting point for the conversation.
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          label="Save and view trends"
          onPress={() => router.push("/health-trends")}
          icon="trending-up-outline"
        />
        <Button
          label="Retake assessment"
          onPress={handleRetake}
          variant="secondary"
          icon="refresh-outline"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  meter: { marginTop: spacing.lg, marginBottom: spacing.xl },
  provenance: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  provenanceText: { flex: 1 },
  retry: { marginTop: spacing.md, alignSelf: "flex-start" },
  section: { marginTop: spacing.xxl },
  driverCard: { paddingHorizontal: spacing.lg },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  driverText: { flex: 1, gap: 1 },
  suggestions: { gap: spacing.md },
  aiLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  aiNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  aiNoteText: { flex: 1 },
  suggestionRow: { flexDirection: "row", gap: spacing.md },
  suggestionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionText: { flex: 1, gap: 2 },
  disclaimer: { marginTop: spacing.xxl, gap: spacing.xs },
  actions: { marginTop: spacing.xl, gap: spacing.md },
});
