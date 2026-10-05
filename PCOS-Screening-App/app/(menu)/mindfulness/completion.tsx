// app/(menu)/mindfulness/completion.tsx
/**
 * Session complete.
 *
 * The old screen listed "Today's Achievement" as three bullets:
 *
 *     ✅ 5 Breathing Cycles
 *     🧘 Improved Relaxation
 *     💙 Mindfulness Practice Completed
 *
 * The first is a fact. The second is a claim about the user's physiological
 * state that the app has no way to know — it is asserted regardless of whether
 * the session helped at all. The third restates the heading.
 *
 * What remains is the count, which is true, and a prompt to notice how they
 * feel, which is the honest version of the second bullet: it asks rather than
 * tells. The six rotating affirmations with trailing emoji are gone.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen, Card, Button, Text, Stat } from "@/components/ui";
import { useTheme, spacing, radius } from "@/theme";

export default function CompletionScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { title, cycles } = useLocalSearchParams<{
    title?: string;
    cycles?: string;
  }>();

  const count = Number(cycles) || 5;

  return (
    <Screen scroll={false} edges={["top", "bottom"]}>
      <View style={styles.stage}>
        <View style={[styles.badge, { backgroundColor: colors.riskLowSubtle }]}>
          <Ionicons
            name="checkmark"
            size={34}
            color={colors.riskLow}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>

        <View style={styles.copy}>
          <Text variant="title" center accessibilityRole="header">
            Session complete
          </Text>
          <Text variant="body" color="textSecondary" center>
            {title ? `You finished ${title.toLowerCase()}.` : "Nicely done."}
          </Text>
        </View>

        <Card style={styles.stats}>
          <Stat label="Cycles completed" value={String(count)} />
        </Card>

        {/*
          Replaces "Improved Relaxation" — the app cannot know whether the
          session helped, so it asks instead of asserting. The answer is also
          the thing worth logging.
        */}
        <Card variant="sunken" style={styles.prompt}>
          <Text variant="callout" color="textSecondary" center>
            How do you feel now compared to before you started? Worth logging,
            if you track your mood.
          </Text>
        </Card>
      </View>

      <View style={styles.actions}>
        <Button
          label="Log how I feel"
          onPress={() => router.replace("/mental-wellbeing")}
          icon="heart-outline"
        />
        <Button
          label="Back to breathing"
          onPress={() => router.replace("/mindfulness")}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl },
  badge: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { gap: spacing.xs, maxWidth: 300 },
  stats: { alignItems: "center", minWidth: 180 },
  prompt: { maxWidth: 320 },
  actions: { gap: spacing.sm, paddingBottom: spacing.lg },
});
