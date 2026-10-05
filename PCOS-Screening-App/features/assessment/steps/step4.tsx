/**
 * Step 4 — lifestyle and family history.
 *
 * The bespoke dropdown and emoji tiles are gone. "Not sure" is mutually
 * exclusive with the specific family-history answers, the same way "None of
 * these" behaves in step 3 — you cannot both know and not know.
 */

import React, { useState } from "react";

import { useAssessment } from "@/features/assessment";

import { StepLayout } from "../components/StepLayout";
import { OptionGroup, type Option } from "../components/OptionGroup";

const UNSURE = "unsure";

const FAST_FOOD: Option[] = [
  { value: "Never", label: "Rarely or never" },
  { value: "1–2x / week", label: "1–2× a week" },
  { value: "3–4x / week", label: "3–4× a week" },
  { value: "Daily", label: "Most days" },
];

const EXERCISE: Option[] = [
  {
    value: "Sedentary",
    label: "Mostly sitting",
    description: "Little planned activity in a typical week",
  },
  {
    value: "Active",
    label: "Regularly active",
    description: "Moving deliberately several times a week",
  },
];

const MARITAL: Option[] = [
  { value: "Single", label: "Single" },
  { value: "Married", label: "Married" },
  { value: "Other", label: "Prefer not to say" },
];

const FAMILY_HISTORY: Option[] = [
  { value: "pcos", label: "PCOS", description: "A parent, sibling or grandparent" },
  { value: "diabetes", label: "Type 2 diabetes" },
  { value: UNSURE, label: "I'm not sure" },
];

export default function Step4LifestyleMedical({
  onNext,
  onBack,
}: {
  onNext?: () => void;
  onBack?: () => void;
}) {
  const { data, update } = useAssessment();
  const [attempted, setAttempted] = useState(false);

  const handleFamilyHistory = (next: string[]) => {
    const justPickedUnsure = next.includes(UNSURE) && !data.familyHistory.includes(UNSURE);
    update({
      familyHistory: justPickedUnsure ? [UNSURE] : next.filter((f) => f !== UNSURE),
    });
  };

  const missing = {
    fastFood: !data.fastFoodFrequency,
    exercise: !data.exerciseHabit,
    marital: !data.maritalStatus,
    family: data.familyHistory.length === 0,
  };

  const handleNext = () => {
    setAttempted(true);
    if (!Object.values(missing).some(Boolean)) onNext?.();
  };

  const errorIf = (isMissing: boolean, message = "Choose one to continue") =>
    attempted && isMissing ? message : undefined;

  return (
    <StepLayout
      step={4}
      title="Lifestyle and family"
      description="Last few questions. These add context that symptoms alone don't capture."
      rationale="Diet, activity and family history all influence insulin resistance, which shapes how PCOS develops."
      onNext={handleNext}
      onBack={onBack}
      nextLabel="See my result"
    >
      <OptionGroup
        label="How often do you eat fast food?"
        required
        layout="chips"
        options={FAST_FOOD}
        value={data.fastFoodFrequency || null}
        onChange={(v) => update({ fastFoodFrequency: v })}
        error={errorIf(missing.fastFood)}
      />

      <OptionGroup
        label="How active are you day to day?"
        required
        options={EXERCISE}
        value={data.exerciseHabit}
        onChange={(v) => update({ exerciseHabit: v as typeof data.exerciseHabit })}
        error={errorIf(missing.exercise)}
      />

      <OptionGroup
        label="Marital status"
        required
        layout="chips"
        options={MARITAL}
        value={data.maritalStatus}
        onChange={(v) => update({ maritalStatus: v as typeof data.maritalStatus })}
        hint="Used only because the underlying model was trained with it."
        error={errorIf(missing.marital)}
      />

      <OptionGroup
        label="Does anyone in your family have?"
        required
        multiple
        options={FAMILY_HISTORY}
        value={data.familyHistory}
        onChange={handleFamilyHistory}
        error={errorIf(missing.family, "Select an option, or “I'm not sure”")}
      />
    </StepLayout>
  );
}
