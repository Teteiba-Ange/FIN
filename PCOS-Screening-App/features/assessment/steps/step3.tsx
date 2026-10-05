/**
 * Step 3 — symptoms.
 *
 * Multi-select, with "None of these" mutually exclusive against the rest.
 * Previously a grid of emoji tiles; the emoji carried no meaning a screen
 * reader could use, and the bearded-face glyph used for hirsutism was a poor
 * fit for the audience.
 */

import React, { useState } from "react";

import { useAssessment } from "@/features/assessment";

import { StepLayout } from "../components/StepLayout";
import { OptionGroup, type Option } from "../components/OptionGroup";

const NONE = "none";

const SYMPTOMS: Option[] = [
  {
    value: "hair_growth",
    label: "Excess hair growth",
    description: "Coarse hair on the face, chest or stomach",
  },
  {
    value: "hair_loss",
    label: "Hair thinning or loss",
    description: "Noticeably thinner hair on your scalp",
  },
  {
    value: "acne",
    label: "Persistent acne or oily skin",
    description: "Ongoing, especially along the jaw",
  },
  {
    value: "weight_gain",
    label: "Unexplained weight gain",
    description: "Particularly around the middle",
  },
  {
    value: "skin_darkening",
    label: "Darkened patches of skin",
    description: "Often on the neck, underarms or groin",
  },
  {
    value: "fatigue",
    label: "Ongoing tiredness",
    description: "Tired even after a full night's sleep",
  },
  {
    value: "mood",
    label: "Mood changes",
    description: "Low mood or anxiety that feels cyclical",
  },
  { value: NONE, label: "None of these" },
];

export default function Step3Symptoms({
  onNext,
  onBack,
}: {
  onNext?: () => void;
  onBack?: () => void;
}) {
  const { data, update } = useAssessment();
  const [attempted, setAttempted] = useState(false);

  const handleChange = (next: string[]) => {
    const justPickedNone = next.includes(NONE) && !data.symptoms.includes(NONE);
    // "None of these" clears everything else, and picking anything else clears it.
    update({ symptoms: justPickedNone ? [NONE] : next.filter((s) => s !== NONE) });
  };

  const handleNext = () => {
    setAttempted(true);
    if (data.symptoms.length > 0) onNext?.();
  };

  const chosen = data.symptoms.filter((s) => s !== NONE).length;
  const status = data.symptoms.includes(NONE)
    ? "No symptoms reported"
    : chosen > 0
      ? `${chosen} selected`
      : undefined;

  return (
    <StepLayout
      step={3}
      title="Symptoms"
      description="Select anything you've noticed over the past six months. There's no right number to pick."
      status={status}
      rationale="Symptoms linked to raised androgen levels are among the most informative signals for PCOS."
      onNext={handleNext}
      onBack={onBack}
    >
      <OptionGroup
        label="Select all that apply"
        required
        multiple
        options={SYMPTOMS}
        value={data.symptoms}
        onChange={handleChange}
        error={
          attempted && data.symptoms.length === 0
            ? "Select at least one, or choose “None of these”"
            : undefined
        }
      />
    </StepLayout>
  );
}
