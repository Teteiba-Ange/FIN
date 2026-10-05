// app/(menu)/wellness-library.tsx
/**
 * Wellness library — the index.
 *
 * Previously four cards linking to example.com, with no header and no back
 * affordance. The home screen's "Reading" card points here, so the app's only
 * educational path ended in dead URLs.
 *
 * Articles are now in-app (`lib/content/articles.ts`): they work offline, and
 * they can be reviewed as part of the project rather than changing under it.
 */

import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { Screen, ScreenHeader, Card, Text } from "@/components/ui";
import { ARTICLES, type Article } from "@/lib/content/articles";
import { useTheme, spacing, radius } from "@/theme";

export default function WellnessLibraryScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  // Grouped by category so the list has a shape, rather than four peers.
  const categories = Array.from(new Set(ARTICLES.map((a) => a.category)));

  const renderCard = (article: Article) => (
    <Card
      key={article.id}
      onPress={() =>
        router.push({ pathname: "/article", params: { id: article.id } })
      }
      accessibilityLabel={`${article.title}. ${article.summary}. ${article.readingMinutes} minute read.`}
      style={styles.card}
    >
      <View style={styles.cardRow}>
        <View
          style={[styles.icon, { backgroundColor: colors.primarySubtle }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Ionicons name={article.icon} size={19} color={colors.primary} />
        </View>

        <View style={styles.cardText}>
          <Text variant="bodyStrong">{article.title}</Text>
          <Text variant="callout" color="textSecondary">
            {article.summary}
          </Text>
          <Text variant="caption" color="textTertiary" style={styles.meta}>
            {article.readingMinutes} min read
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      </View>
    </Card>
  );

  return (
    <Screen>
      <ScreenHeader
        title="Reading"
        subtitle="Short, plain explanations of what PCOS is and what to do about it."
      />

      <Card padded={false} style={styles.heroCard}>
        <Image
          source={require("../../assets/images/wellness-hero-teal.png")}
          style={styles.heroImage}
          resizeMode="cover"
          accessibilityLabel="A woman relaxing while tracking her wellbeing"
        />
        <View style={styles.heroCopy}>
          <Text variant="label" color="primary">Learn at your pace</Text>
          <Text variant="bodyStrong">Clear answers for everyday PCOS questions</Text>
        </View>
      </Card>

      <View style={styles.groups}>
        {categories.map((category) => (
          <View key={category} style={styles.group}>
            <Text variant="label" color="textTertiary">
              {category}
            </Text>
            <View style={styles.cards}>
              {ARTICLES.filter((a) => a.category === category).map(renderCard)}
            </View>
          </View>
        ))}
      </View>

      <Card variant="sunken" style={styles.disclaimer}>
        <Text variant="callout" color="textSecondary">
          These are general explanations, not medical advice. Nothing here
          replaces a conversation with a doctor who knows your history.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: { marginBottom: spacing.xl, overflow: "hidden" },
  heroImage: { width: "100%", height: 170 },
  heroCopy: { gap: spacing.xs, padding: spacing.lg },
  groups: { gap: spacing.xl },
  group: { gap: spacing.md },
  cards: { gap: spacing.md },
  card: { paddingVertical: spacing.md },
  cardRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cardText: { flex: 1, gap: 2 },
  meta: { marginTop: spacing.xs },
  disclaimer: { marginTop: spacing.xxl },
});
