/**
 * StepLayout — the shared chrome for every assessment step.
 *
 * Each step previously re-implemented its own nav bar, progress row, progress
 * bar (with the percentage hardcoded per file), footer button and ~70 lines of
 * identical styles. All of that lives here once; a step now only describes its
 * own fields.
 *
 * Progress is derived from `step`, so it cannot drift from reality the way
 * four separately hardcoded widths did.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { StretchInX } from "react-native-reanimated";

import { Screen, Text, Button, Card } from "@/components/ui";
import { useTheme, spacing, radius } from "@/theme";

export const TOTAL_STEPS = 4;

type StepLayoutProps = {
  /** 1-based. */
  step: number;
  title: string;
  description?: string;
  /** Short line under the description, e.g. a live selection count. */
  status?: string;
  children: React.ReactNode;
  /** Explains why this data is collected. Shown above the footer. */
  rationale?: string;
  onNext: () => void;
  onBack?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextLoading?: boolean;
};

export function StepLayout({
  step,
  title,
  description,
  status,
  children,
  rationale,
  onNext,
  onBack,
  nextLabel = "Continue",
  nextDisabled = false,
  nextLoading = false,
}: StepLayoutProps) {
  const { colors } = useTheme();
  const pct = Math.round((step / TOTAL_STEPS) * 100);

  return (
    <Screen>
      <View style={styles.head}>
        <View style={styles.progressRow}>
          <Text variant="label" color="textTertiary">
            Step {step} of {TOTAL_STEPS}
          </Text>
          <Text variant="caption" color="textSecondary" numeric>
            {pct}%
          </Text>
        </View>

        {/*
          The bar is decorative here — the "Step N of 4" text above already
          conveys progress to a screen reader, so announcing it twice adds noise.
        */}
        <View
          style={[styles.track, { backgroundColor: colors.sunken }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View
            entering={StretchInX.duration(550)}
            style={[
              styles.fill,
              { width: `${pct}%`, backgroundColor: colors.primary },
            ]}
          />
        </View>

        <Text variant="title" accessibilityRole="header" style={styles.title}>
          {title}
        </Text>

        {description && (
          <Text variant="body" color="textSecondary">
            {description}
          </Text>
        )}

        {status && (
          <Text variant="callout" color="primary" style={styles.status}>
            {status}
          </Text>
        )}
      </View>

      <View style={styles.body}>{children}</View>

      {rationale && (
        <Card variant="sunken" style={styles.rationale}>
          <Text variant="label" color="textTertiary">
            Why we ask
          </Text>
          <Text variant="callout" color="textSecondary">
            {rationale}
          </Text>
        </Card>
      )}

      <View style={styles.footer}>
        <Button
          label={nextLabel}
          onPress={onNext}
          disabled={nextDisabled}
          loading={nextLoading}
          icon="arrow-forward"
          iconPosition="trailing"
          size="lg"
        />
        {onBack && (
          <Button label="Back" onPress={onBack} variant="ghost" size="sm" />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: spacing.sm, paddingTop: spacing.md },
  progressRow: { flexDirection: "row", justifyContent: "space-between" },
  track: { height: 4, borderRadius: radius.sm, overflow: "hidden" },
  fill: { height: "100%", borderRadius: radius.sm },
  title: { marginTop: spacing.sm },
  status: { fontWeight: "600" },
  body: { marginTop: spacing.xl, gap: spacing.lg },
  rationale: { marginTop: spacing.xl, gap: spacing.xs },
  footer: { marginTop: spacing.xxl, gap: spacing.sm },
});
