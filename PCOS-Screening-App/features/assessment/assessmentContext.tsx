/**
 * assessmentContext.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared state for the assessment flow, the latest result, and the physical
 * metrics the profile screen reads.
 *
 * A-03 — Persistence.
 *   All of this was plain `useState`. Taking a call during step 3 was enough
 *   for Android to reclaim the process, and all four steps were gone with no
 *   way back to them. `latestResult` had the same problem, which is why the
 *   Trends screen's "What influenced your last result" was permanently empty
 *   after any restart.
 *
 *   Draft answers, the current step, and the last result now survive a
 *   restart. Restoring is not silent: `hasDraft` lets the wizard offer to
 *   continue rather than presenting week-old answers as if they were fresh.
 *
 * Writes are debounced. Every keystroke in step 1 calls `update()`, and
 * hitting AsyncStorage on each one would be both wasteful and a source of
 * out-of-order writes.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssessmentData = {
  // Step 1 — Physical Metrics
  age: string;
  weight: string;
  height: string;
  /**
   * Waist and hip in cm. Added because the backend was sending a hardcoded
   * `waist_hip_ratio: 0.85` for every user — a core diagnostic signal for PCOS
   * passed to the model as a literal. See D-02 in PLAN.md.
   */
  waist: string;
  hip: string;

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

export type ShapFeature = {
  feature: string;
  shap_value: number;
  direction: "increases" | "decreases";
  explanation: string;
};

export type AssessmentResult = {
  score: number;
  riskLevel: string;
  riskColor: string;
  riskDescription: string;
  topFeatures: ShapFeature[];
  completedAt: string;
};

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

  /** The step the user was last on, so the wizard can resume. */
  step: number;
  setStep: (step: number) => void;

  /** True when restored answers exist from a previous session. */
  hasDraft: boolean;
  /** Accept the restored draft — clears the prompt without clearing answers. */
  keepDraft: () => void;
  /** Discard the restored draft and start fresh. */
  discardDraft: () => void;

  latestResult: AssessmentResult | null;
  setLatestResult: (result: AssessmentResult) => void;

  profileSync: ProfileSync | null;
  /** False until persisted state has been read, to avoid a flash of empty fields. */
  ready: boolean;
};

// ── Defaults ──────────────────────────────────────────────────────────────────

const defaultData: AssessmentData = {
  age: "",
  weight: "",
  height: "",
  waist: "",
  hip: "",
  cycleRegularity: null,
  cycleLength: "",
  avgPeriodDuration: "",
  symptoms: [],
  fastFoodFrequency: "",
  exerciseHabit: null,
  maritalStatus: null,
  familyHistory: [],
};

const KEYS = {
  DRAFT: "pcos_assessment_draft",
  RESULT: "pcos_assessment_result",
};

/** Drafts older than this are not offered for resume — the answers are stale. */
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type StoredDraft = {
  data: AssessmentData;
  step: number;
  savedAt: string;
};

const AssessmentContext = createContext<AssessmentContextType>({
  data: defaultData,
  update: () => {},
  reset: () => {},
  step: 1,
  setStep: () => {},
  hasDraft: false,
  keepDraft: () => {},
  discardDraft: () => {},
  latestResult: null,
  setLatestResult: () => {},
  profileSync: null,
  ready: false,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function AssessmentProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AssessmentData>(defaultData);
  const [step, setStepState] = useState(1);
  const [hasDraft, setHasDraft] = useState(false);
  const [latestResult, setLatestResultState] = useState<AssessmentResult | null>(null);
  const [ready, setReady] = useState(false);

  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restored = useRef(false);

  // ── Restore ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [draftRaw, resultRaw] = await AsyncStorage.multiGet([
          KEYS.DRAFT,
          KEYS.RESULT,
        ]);

        if (cancelled) return;

        const draftJson = draftRaw[1];
        if (draftJson) {
          const draft = JSON.parse(draftJson) as StoredDraft;
          const age = Date.now() - new Date(draft.savedAt).getTime();

          if (age < DRAFT_TTL_MS) {
            // Merge over the defaults so a draft saved before a field was
            // added doesn't leave that field `undefined`.
            setData({ ...defaultData, ...draft.data });
            setStepState(draft.step || 1);
            // Only prompt if they got past the first step — a couple of
            // characters in an age field is not worth a resume dialog.
            setHasDraft((draft.step ?? 1) > 1);
          } else {
            await AsyncStorage.removeItem(KEYS.DRAFT);
          }
        }

        const resultJson = resultRaw[1];
        if (resultJson) setLatestResultState(JSON.parse(resultJson));
      } catch (error) {
        console.warn("[ASSESSMENT] Could not restore saved state:", error);
      } finally {
        if (!cancelled) {
          restored.current = true;
          setReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Persist (debounced) ────────────────────────────────────────────────────
  const scheduleWrite = useCallback((next: AssessmentData, nextStep: number) => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      const payload: StoredDraft = {
        data: next,
        step: nextStep,
        savedAt: new Date().toISOString(),
      };
      AsyncStorage.setItem(KEYS.DRAFT, JSON.stringify(payload)).catch((error) =>
        console.warn("[ASSESSMENT] Could not save draft:", error)
      );
    }, 400);
  }, []);

  useEffect(
    () => () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    },
    []
  );

  const update = useCallback(
    (fields: Partial<AssessmentData>) => {
      setData((prev) => {
        const next = { ...prev, ...fields };
        // Don't write until the restore has finished, or an early keystroke
        // could persist over the draft we are about to load.
        if (restored.current) scheduleWrite(next, step);
        return next;
      });
    },
    [scheduleWrite, step]
  );

  const setStep = useCallback(
    (nextStep: number) => {
      setStepState(nextStep);
      if (restored.current) scheduleWrite(data, nextStep);
      setHasDraft(false);
    },
    [data, scheduleWrite]
  );

  const reset = useCallback(() => {
    setData(defaultData);
    setStepState(1);
    setHasDraft(false);
    AsyncStorage.removeItem(KEYS.DRAFT).catch(() => {});
    // `latestResult` is deliberately kept — the dashboard should continue to
    // show the last completed assessment while a new one is in progress.
  }, []);

  const keepDraft = useCallback(() => setHasDraft(false), []);

  const discardDraft = useCallback(() => {
    setData(defaultData);
    setStepState(1);
    setHasDraft(false);
    AsyncStorage.removeItem(KEYS.DRAFT).catch(() => {});
  }, []);

  const setLatestResult = useCallback((result: AssessmentResult) => {
    setLatestResultState(result);
    AsyncStorage.setItem(KEYS.RESULT, JSON.stringify(result)).catch((error) =>
      console.warn("[ASSESSMENT] Could not save result:", error)
    );
  }, []);

  // Derived rather than stored in its own state, which is what previously
  // caused profileSync to be written from inside a setState updater.
  const profileSync = useMemo<ProfileSync | null>(() => {
    if (!data.age && !data.weight && !data.height) return null;

    const w = parseFloat(data.weight);
    const m = parseFloat(data.height) / 100;
    const bmi = w > 0 && m > 0 ? (w / (m * m)).toFixed(1) : "";

    return { age: data.age, weight: data.weight, height: data.height, bmi };
  }, [data.age, data.weight, data.height]);

  const value = useMemo<AssessmentContextType>(
    () => ({
      data,
      update,
      reset,
      step,
      setStep,
      hasDraft,
      keepDraft,
      discardDraft,
      latestResult,
      setLatestResult,
      profileSync,
      ready,
    }),
    [
      data,
      update,
      reset,
      step,
      setStep,
      hasDraft,
      keepDraft,
      discardDraft,
      latestResult,
      setLatestResult,
      profileSync,
      ready,
    ]
  );

  return (
    <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>
  );
}

export function useAssessment() {
  return useContext(AssessmentContext);
}
