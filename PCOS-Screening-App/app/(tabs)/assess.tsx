// app/(tabs)/assess.tsx
/**
 * The assessment wizard — one route, five views.
 *
 * The current step now lives in the assessment context rather than local
 * state, so it survives the app being backgrounded and reclaimed. Where a
 * draft is restored, the user is asked before it is used: presenting answers
 * from last week as if they were typed just now is its own kind of dishonesty,
 * and the score would be computed from stale inputs without anyone noticing.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { Screen, Card, Button, Text, EmptyState } from "@/components/ui";
import { useAssessment } from "@/features/assessment";
import { spacing } from "@/theme";

import Step1 from "@/features/assessment/steps/step1";
import Step2 from "@/features/assessment/steps/step2";
import Step3 from "@/features/assessment/steps/step3";
import Step4 from "@/features/assessment/steps/step4";
import Results from "@/features/assessment/steps/result";

/** 1–4 are the wizard steps; 5 is the result. */
const RESULT_STEP = 5;

export default function AssessmentTab() {
  const { step, setStep, hasDraft, keepDraft, discardDraft, ready } = useAssessment();

  // Hold until the stored draft has been read, so the wizard doesn't render
  // step 1 with empty fields and then jump.
  if (!ready) {
    return (
      <Screen>
        <EmptyState icon="clipboard-outline" title="Loading your assessment…" />
      </Screen>
    );
  }

  if (hasDraft) {
    return (
      <Screen contentContainerStyle={styles.resume}>
        <Card variant="raised" style={styles.resumeCard}>
          <Text variant="label" color="textTertiary">
            Unfinished assessment
          </Text>
          <Text variant="heading" accessibilityRole="header">
            Pick up where you left off?
          </Text>
          <Text variant="body" color="textSecondary">
            You were on step {step} of 4. Your answers were saved — you can
            carry on with them, or start again from the beginning.
          </Text>

          <View style={styles.resumeActions}>
            <Button
              label={`Continue from step ${step}`}
              onPress={keepDraft}
              icon="arrow-forward"
              iconPosition="trailing"
            />
            <Button label="Start over" onPress={discardDraft} variant="secondary" />
          </View>
        </Card>
      </Screen>
    );
  }

  const goTo = (to: number) => () => setStep(to);

  switch (step) {
    case 1:
      return <Step1 onNext={goTo(2)} />;
    case 2:
      return <Step2 onNext={goTo(3)} onBack={goTo(1)} />;
    case 3:
      return <Step3 onNext={goTo(4)} onBack={goTo(2)} />;
    case 4:
      return <Step4 onNext={goTo(RESULT_STEP)} onBack={goTo(3)} />;
    default:
      return <Results onRestart={goTo(1)} />;
  }
}

const styles = StyleSheet.create({
  resume: { justifyContent: "center" },
  resumeCard: { gap: spacing.sm },
  resumeActions: { gap: spacing.sm, marginTop: spacing.lg },
});
