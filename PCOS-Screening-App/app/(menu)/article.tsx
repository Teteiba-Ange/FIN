// app/(menu)/article.tsx
/**
 * Article reader.
 *
 * Renders a single piece from `lib/content/articles.ts` as typed blocks rather
 * than a wall of text, so headings are real headings — a screen reader can jump
 * between them, and the reader can scan.
 *
 * Body copy is deliberately narrower than the screen. Full-bleed paragraphs on
 * a phone run long enough that the eye loses its place returning to the left
 * edge; the `Screen` padding plus the type scale's 22pt line height keeps lines
 * near the comfortable range.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams } from "expo-router";

import { Screen, ScreenHeader, Card, Text, EmptyState } from "@/components/ui";
import { getArticle } from "@/lib/content/articles";
import { useTheme, spacing, radius } from "@/theme";

export default function ArticleScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const article = getArticle(id);

  if (!article) {
    return (
      <Screen>
        <ScreenHeader title="Reading" />
        <EmptyState
          icon="document-text-outline"
          title="We couldn't find that article"
          description="It may have been renamed. Head back to the library and pick another."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={article.title} />

      <Text variant="label" color="primary" style={styles.eyebrow}>
        {article.category} · {article.readingMinutes} min read
      </Text>

      <Text variant="body" color="textSecondary" style={styles.summary}>
        {article.summary}
      </Text>

      <View style={[styles.rule, { backgroundColor: colors.border }]} />

      <View style={styles.body}>
        {article.body.map((block, i) => {
          if (block.type === "heading") {
            return (
              <Text
                key={i}
                variant="subhead"
                accessibilityRole="header"
                style={styles.heading}
              >
                {block.text}
              </Text>
            );
          }

          if (block.type === "list") {
            return (
              <View key={i} style={styles.list}>
                {block.items.map((item, j) => (
                  <View key={j} style={styles.listItem}>
                    <View
                      style={[styles.bullet, { backgroundColor: colors.primary }]}
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                    />
                    <Text variant="body" color="textSecondary" style={styles.listText}>
                      {item}
                    </Text>
                  </View>
                ))}
              </View>
            );
          }

          return (
            <Text key={i} variant="body" color="textSecondary">
              {block.text}
            </Text>
          );
        })}
      </View>

      <Card variant="sunken" style={styles.disclaimer}>
        <Text variant="label" color="textTertiary">
          Remember
        </Text>
        <Text variant="callout" color="textSecondary">
          This is general information, not medical advice. Only a qualified
          healthcare professional can diagnose PCOS or tell you what to do about
          your own symptoms.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginBottom: spacing.sm },
  summary: { marginBottom: spacing.lg },
  rule: { height: StyleSheet.hairlineWidth, marginBottom: spacing.xl },
  body: { gap: spacing.lg },
  heading: { marginTop: spacing.md },
  list: { gap: spacing.md },
  listItem: { flexDirection: "row", gap: spacing.md },
  bullet: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
    // Optically aligned with the middle of the first line of text.
    marginTop: 9,
  },
  listText: { flex: 1 },
  disclaimer: { marginTop: spacing.xxl, gap: spacing.xs },
});
