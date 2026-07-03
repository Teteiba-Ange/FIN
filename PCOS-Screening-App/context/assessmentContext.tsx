/**
 * assessmentContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Central shared state for the entire assessment flow AND the latest result.
 *
 * FIX 1 — Profile sync
 *   After the user completes Step 1 (age, weight, height) those values are
 *   stored here.  ProfileScreen reads them via `useAssessment().profileSync`
 *   and pre-fills its fields automatically.
 *
 * FIX 2 — Live result on Health Trends / Dashboard
 *   When the ML service (or the local fallback scorer) returns a result we
 *   store it in `latestResult`.  health-trends.tsx and index.tsx read this
 *   context — they no longer hard-code 72 %.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssessmentData = {
  // Step 1 — Physical Metrics
  age: string;
  weight: string;
  height: string;

  // Step 2 — Menstrual Health
  cycleRegularity: "Regular" | "Irregular" | "No Cycle" | null;
  cycleLength: string;
  avgPeriodDuration: string;

  // Step 3 — Symptoms
  symptoms: string[];

  // Step 4 — Lifestyle & Medical History
  fastFoodFrequency: string;
  exerciseHabit: "Sedentary" | "Active" | null;
  maritalStatus: "Single" | "Married" | "Other" | null;
  familyHistory: string[];
};

/** One SHAP feature explanation returned by the ML service or local scorer */
export type ShapFeature = {
  feature: string;
  shap_value: number;
  direction: "increases" | "decreases";
  explanation: string;
};

/** The full result stored after each completed assessment */
export type AssessmentResult = {
  score: number;                 // 0-100
  riskLevel: string;             // "Low Risk" | "Moderate Risk" | "High Risk"
  riskColor: string;
  riskDescription: string;
  topFeatures: ShapFeature[];
  completedAt: string;           // ISO timestamp
};

/**
 * Fields copied from Step 1 so the Profile screen can pre-fill them without
 * the user having to re-enter the same data.
 */
export type ProfileSync = {
  age: string;
  weight: string;
  height: string;
  bmi: string;
};

type AssessmentContextType = {
  data: AssessmentData;
  update: (fields: Partial<AssessmentData>) => void;
  reset: () => void;

  /** The most recent completed assessment result */
  latestResult: AssessmentResult | null;
  setLatestResult: (result: AssessmentResult) => void;

  /** Physical metrics from Step 1 — consumed by ProfileScreen */
  profileSync: ProfileSync | null;
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultData: AssessmentData = {
  age: "",
  weight: "",
  height: "",
  cycleRegularity: null,
  cycleLength: "",
  avgPeriodDuration: "",
  symptoms: [],
  fastFoodFrequency: "",
  exerciseHabit: null,
  maritalStatus: null,
  familyHistory: [],
};

const AssessmentContext = createContext<AssessmentContextType>({
  data: defaultData,
  update: () => {},
  reset: () => {},
  latestResult: null,
  setLatestResult: () => {},
  profileSync: null,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AssessmentData>(defaultData);
  const [latestResult, setLatestResultState] = useState<AssessmentResult | null>(null);
  const [profileSync, setProfileSync] = useState<ProfileSync | null>(null);

  const update = (fields: Partial<AssessmentData>) => {
    setData((prev) => {
      const next = { ...prev, ...fields };

      // Any time age / weight / height change, recompute the profile sync block
      // so ProfileScreen always shows the freshest values
      const w = parseFloat(next.weight);
      const hCm = parseFloat(next.height);
      const hMeters = hCm / 100;
      const bmi = w > 0 && hMeters > 0 ? (w / (hMeters * hMeters)).toFixed(1) : "";

      setProfileSync({
        age: next.age,
        weight: next.weight,
        height: next.height,
        bmi,
      });

      return next;
    });
  };

  const reset = () => {
    setData(defaultData);
    // NOTE: we intentionally do NOT clear latestResult or profileSync on reset
    // so the dashboard continues to show the last completed assessment result
    // and the profile keeps the last-entered physical metrics.
  };

  const setLatestResult = (result: AssessmentResult) => {
    setLatestResultState(result);
  };

  return (
    <AssessmentContext.Provider
      value={{ data, update, reset, latestResult, setLatestResult, profileSync }}
    >
      {children}
    </AssessmentContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAssessment() {
  return useContext(AssessmentContext);
}