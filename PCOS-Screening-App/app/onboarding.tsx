// app/onboarding.tsx
/**
 * First-run onboarding (E-05).
 *
 * The app previously opened straight onto a login form. Nothing stated what it
 * does, what a screening score is or isn't, or where menstrual and family
 * medical history goes once you type it in. For a health tool asking a
 * stranger for that, it is a consent problem before it is a UX one.
 *
 * Three screens, and the third is a real consent gate — the continue button is
 * disabled until the box is ticked, and the choice is recorded with a version
 * so it can be re-sought if the terms change.
 *
 * The second screen exists to set expectations about the score *before* anyone
 * sees one. The result screen already says it isn't a diagnosis; saying so
 * only afterwards means the user has already formed an impression by the time
 * they read it.
 */

import React, { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { Screen, Card, Button, Text } from "@/components/ui";
import { setConsent, CONSENT_VERSION } from "@/lib/consent";
import { useTheme, spacing, radius } from "@/theme";

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  points?: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
};

const SLIDES: Slide[] = [
  {
    icon: "clipboard-outline",
    title: "Track what's hard to remember",
    body: "PCOS shows up differently in everyone, and the pattern is what matters. Logging symptoms and cycles turns \"I think they're irregular\" into dates you can show a doctor.",
    points: [
      { icon: "calendar-outline", text: "Cycles, with your average and what's coming" },
      { icon: "create-outline", text: "Symptoms, day to day" },
      { icon: "trending-up-outline", text: "How it all changes over months" },
    ],
  },
  {
    icon: "information-circle-outline",
    title: "A screening score, not a diagnosis",
    body: "The assessment gives you a number out of 100 based on your answers. It's a starting point for a conversation — not an answer.",
    points: [
      { icon: "checkmark-circle-outline", text: "It can tell you whether it's worth getting checked" },
      { icon: "close-circle-outline", text: "It cannot diagnose PCOS — that needs blood tests and a scan" },
      { icon: "medkit-outline", text: "Only a clinician can tell you what it means for you" },
    ],
  },
  {
    icon: "lock-closed-outline",
    title: "Your data, and what happens to it",
    body: "You'll be sharing symptoms, cycle dates and family medical history. Here's exactly where that goes.",
    points: [
      { icon: "person-outline", text: "Stored against your account, visible only to you" },
      { icon: "key-outline", text: "Notes are encrypted before they're saved" },
      { icon: "phone-portrait-outline", text: "Kept on your phone too, so it works offline" },
      { icon: "download-outline", text: "You can export or delete all of it, any time" },
    ],
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [agreed, setAgreed] = useState(false);

  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  const finish = async () => {
    await setConsent({
      version: CONSENT_VERSION,
      agreedAt: new Date().toISOString(),
    });
    router.replace("/signup");
  };

  return (
    <Screen edges={["top", "bottom"]} contentContainerStyle={styles.content}>
      {/* Progress. Three dots is enough; a bar would overstate the journey. */}
      <View
        style={styles.dots}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${index + 1} of ${SLIDES.length}`}
      >
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor: i === index ? colors.primary : colors.border,
                width: i === index ? 22 : 7,
              },
            ]}
          />
        ))}
      </View>

      <View style={styles.body}>
        <View style={[styles.heroFrame, { backgroundColor: colors.primarySubtle }]}>
          <Animated.Image
            key={index}
            entering={FadeIn.duration(550)}
            source={require("../assets/images/wellness-hero-teal.png")}
            style={styles.hero}
            resizeMode="cover"
            accessibilityLabel="A woman relaxing with her cycle calendar and water"
          />
          <View style={[styles.heroBadge, { backgroundColor: colors.surface }]}>
            <Ionicons name={slide.icon} size={18} color={colors.primary} />
          </View>
        </View>

        <View style={[styles.icon, { backgroundColor: colors.primarySubtle }]}>
          <Ionicons
            name={slide.icon}
            size={30}
            color={colors.primary}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </View>

        <Animated.View
          key={`copy-${index}`}
          entering={FadeInUp.duration(420)}
          style={styles.copy}
        >
          <Text variant="title" accessibilityRole="header" style={styles.title}>
            {slide.title}
          </Text>
          <Text variant="body" color="textSecondary" style={{ maxWidth: width - 48 }}>
            {slide.body}
          </Text>
        </Animated.View>

        {slide.points && (
          <View style={styles.points}>
            {slide.points.map((p) => (
              <View key={p.text} style={styles.point}>
                <Ionicons
                  name={p.icon}
                  size={17}
                  color={colors.textTertiary}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                />
                <Text variant="callout" color="textSecondary" style={styles.pointText}>
                  {p.text}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/*
          The consent gate. Deliberately an explicit tick rather than an
          implied "by continuing you agree" — the latter is not consent, it is
          a notice dressed as one.
        */}
        {isLast && (
          <Card
            variant="sunken"
            onPress={() => setAgreed((v) => !v)}
            accessibilityLabel="I understand and agree"
            style={styles.consent}
          >
            <View style={styles.consentRow}>
              <View
                style={[
                  styles.checkbox,
                  {
                    backgroundColor: agreed ? colors.primary : "transparent",
                    borderColor: agreed ? colors.primary : colors.borderStrong,
                  },
                ]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreed }}
              >
                {agreed && (
                  <Ionicons name="checkmark" size={16} color={colors.onPrimary} />
                )}
              </View>
              <Text variant="callout" style={styles.consentText}>
                I understand this app gives a screening estimate, not a
                diagnosis, and I agree to my health data being stored as
                described.
              </Text>
            </View>
          </Card>
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label={isLast ? "Create my account" : "Continue"}
          onPress={() => (isLast ? finish() : setIndex(index + 1))}
          disabled={isLast && !agreed}
          size="lg"
          icon="arrow-forward"
          iconPosition="trailing"
        />

        {index > 0 ? (
          <Button
            label="Back"
            onPress={() => setIndex(index - 1)}
            variant="ghost"
            size="sm"
          />
        ) : (
          // Someone reinstalling already knows what this is.
          <Button
            label="I already have an account"
            onPress={() => router.replace("/login")}
            variant="ghost"
            size="sm"
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingTop: spacing.lg },
  dots: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xxl },
  dot: { height: 7, borderRadius: radius.pill },

  body: { flex: 1, gap: spacing.md },
  heroFrame: {
    height: 218,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  hero: { width: "100%", height: "100%" },
  copy: { gap: spacing.md },
  heroBadge: {
    position: "absolute",
    right: spacing.md,
    bottom: spacing.md,
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
    display: "none",
  },
  title: { marginBottom: spacing.xs },

  points: { gap: spacing.md, marginTop: spacing.lg },
  point: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  pointText: { flex: 1 },

  consent: { marginTop: spacing.xl },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  consentText: { flex: 1 },

  actions: { gap: spacing.sm, paddingTop: spacing.xl },
});
