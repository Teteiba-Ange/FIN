// app/(menu)/profile.tsx
/**
 * Profile.
 *
 * Rebuilt on the design system. The substantive fixes:
 *
 *   - The fallback identity is gone. This screen previously rendered
 *     `user?.fullName ?? "Elena Richardson"` and a matching fake email, so a
 *     signed-out user — which, until token persistence is fixed, is every
 *     user on every cold start — saw a fictional person's name on their own
 *     profile. (C-03 in PLAN.md.)
 *   - Six emoji stood in for icons (🎂 ⚖️ 📏 🎯 👤 ✉️). Ionicons now, on
 *     token colours.
 *   - The BMI card was a solid teal block with `#a7f3d0` mint text on it —
 *     the one place in the app using that colour, and unreadable in the dark
 *     palette. It reads as a normal card with the category as a chip.
 *   - Height/weight/age were local state seeded from the assessment, so
 *     editing the profile and then retaking the assessment silently diverged.
 *     They read from the signed-in user, falling back to assessment values
 *     only where the profile has none.
 */

import React, { useState } from "react";
import { ActionSheetIOS, Alert, Linking, Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Button,
  Text,
  Stat,
  EmptyState,
  Avatar,
  levelFromScore,
} from "@/components/ui";
import { useAssessment } from "@/features/assessment";
import { useAuth } from "@/features/auth";
import { resolveAssetUrl } from "@/lib/api";
import { pickImage, type PickSource } from "@/lib/media/pickImage";
import { useTheme, spacing, radius } from "@/theme";

/**
 * BMI bands, with the caveat stated rather than implied. BMI is a population
 * measure and a poor individual one — saying so is more useful than a
 * confident single word, particularly on a screen a user may read as a verdict.
 */
function bmiBand(bmi: number): { label: string; note: string } {
  if (bmi < 18.5) return { label: "Below 18.5", note: "Underweight range" };
  if (bmi < 25) return { label: "18.5 – 24.9", note: "Healthy range" };
  if (bmi < 30) return { label: "25 – 29.9", note: "Overweight range" };
  return { label: "30 or above", note: "Obese range" };
}

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, logout, uploadAvatar, avatarVersion } = useAuth();
  const { profileSync, latestResult } = useAssessment();

  const [uploading, setUploading] = useState(false);

  // The account is the source of truth. Assessment values fill gaps only.
  const age = user?.age != null ? String(user.age) : (profileSync?.age ?? "");
  const weight = user?.weight != null ? String(user.weight) : (profileSync?.weight ?? "");
  const height = user?.height != null ? String(user.height) : (profileSync?.height ?? "");

  const bmi = (() => {
    const w = parseFloat(weight);
    const m = parseFloat(height) / 100;
    if (!(w > 0) || !(m > 0)) return null;
    return w / (m * m);
  })();

  const band = bmi ? bmiBand(bmi) : null;
  const hasMetrics = Boolean(age || weight || height);

  /**
   * The local URI while an upload is in flight, otherwise the server's copy.
   *
   * `avatarVersion` is in the cache-buster because the server names every
   * upload `avatar-<userId>.<ext>` — the URL is identical after a change, so
   * without it the old picture keeps being served from cache and the upload
   * looks like it silently failed.
   */
  const avatarUrl =
    user?.avatarUri ?? resolveAssetUrl(user?.profilePicture, avatarVersion);

  const runPick = async (source: PickSource) => {
    const result = await pickImage(source);

    if (result.status === "cancelled") return;

    if (result.status === "blocked") {
      Alert.alert(
        source === "camera" ? "Camera access is off" : "Photo access is off",
        "You've turned this off for the app, so it has to be re-enabled in Settings.",
        [
          { text: "Not now", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    if (result.status === "denied") {
      Alert.alert(
        "Permission needed",
        source === "camera"
          ? "We need camera access to take your photo."
          : "We need access to your photos to set a picture."
      );
      return;
    }

    setUploading(true);
    try {
      await uploadAvatar(result.uri);
    } catch (error: any) {
      Alert.alert(
        "Couldn't save your photo",
        error?.message?.startsWith("Network")
          ? "We couldn't reach the server. Check your connection and try again."
          : (error?.message ?? "Something went wrong. Try again.")
      );
    } finally {
      setUploading(false);
    }
  };

  /**
   * iOS gets a native action sheet, Android an alert with the same choices.
   * `Alert` with three buttons is the platform-appropriate equivalent there,
   * and avoids pulling in a third-party sheet for two options.
   */
  const handleChangePhoto = () => {
    if (!user || uploading) return;

    const hasPhoto = Boolean(user.profilePicture);

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: hasPhoto ? "Change your photo" : "Add a photo",
          options: ["Take a photo", "Choose from library", "Cancel"],
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) runPick("camera");
          if (index === 1) runPick("library");
        }
      );
      return;
    }

    Alert.alert(hasPhoto ? "Change your photo" : "Add a photo", undefined, [
      { text: "Take a photo", onPress: () => runPick("camera") },
      { text: "Choose from library", onPress: () => runPick("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <Screen>
      <ScreenHeader
        title="Profile"
        action={{
          icon: "create-outline",
          label: "Edit profile",
          onPress: () => router.push("/edit-profile"),
        }}
      />

      <Card variant="raised">
        <View style={styles.identity}>
          <Avatar
            uri={avatarUrl}
            name={user?.fullName}
            size={64}
            editable={Boolean(user)}
            loading={uploading}
            onPress={handleChangePhoto}
          />

          <View style={styles.identityText}>
            {/*
              No invented fallback. If there is no session the screen says so
              and offers the way out, rather than showing a stranger's name.
            */}
            <Text variant="subhead" numberOfLines={1}>
              {user?.fullName ?? "Not signed in"}
            </Text>
            <Text variant="callout" color="textSecondary" numberOfLines={1}>
              {user?.email ?? "Sign in to see and sync your details"}
            </Text>
            {user && (
              <Text
                variant="caption"
                color="primary"
                style={styles.photoHint}
                onPress={handleChangePhoto}
                suppressHighlighting
              >
                {avatarUrl ? "Change photo" : "Add a photo"}
              </Text>
            )}
          </View>
        </View>
      </Card>

      {!user && (
        <Button
          label="Sign in"
          onPress={() => router.replace("/login")}
          icon="log-in-outline"
          style={styles.signIn}
        />
      )}

      <Section title="Your measurements" style={styles.section}>
        {hasMetrics ? (
          <View style={styles.metricsStack}>
            <Card>
              <View style={styles.metrics}>
                <Stat label="Age" value={age || "—"} unit={age ? "yrs" : undefined} />
                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                <Stat label="Weight" value={weight || "—"} unit={weight ? "kg" : undefined} />
                <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />
                <Stat label="Height" value={height || "—"} unit={height ? "cm" : undefined} />
              </View>
            </Card>

            {bmi && band && (
              <Card>
                <View style={styles.bmiRow}>
                  <Stat label="Body mass index" value={bmi.toFixed(1)} />
                  <View style={[styles.bandChip, { backgroundColor: colors.sunken }]}>
                    <Text variant="caption" color="textSecondary">
                      {band.note}
                    </Text>
                  </View>
                </View>
                <Text variant="caption" color="textTertiary" style={styles.bmiNote}>
                  BMI is a rough population measure and says little about any one
                  person. Your doctor will read it alongside everything else.
                </Text>
              </Card>
            )}
          </View>
        ) : (
          <Card padded={false}>
            <EmptyState
              icon="body-outline"
              title="No measurements yet"
              description="Add your age, height and weight so your assessment has something to work with."
              actionLabel="Add measurements"
              onActionPress={() => router.push("/edit-profile")}
            />
          </Card>
        )}
      </Section>

      {latestResult && (
        <Section title="Latest assessment" style={styles.section}>
          <Card
            onPress={() => router.push("/health-trends")}
            accessibilityLabel={`Latest assessment score ${Math.round(
              latestResult.score
            )} out of 100. Opens trends.`}
          >
            <View style={styles.resultRow}>
              <Stat
                label="Risk score"
                value={String(Math.round(latestResult.score))}
                unit="/ 100"
              />
              <View style={styles.resultMeta}>
                <Text
                  variant="bodyStrong"
                  style={{
                    color: {
                      low: colors.riskLow,
                      moderate: colors.riskModerate,
                      high: colors.riskHigh,
                    }[levelFromScore(latestResult.score)],
                  }}
                >
                  {
                    { low: "Low", moderate: "Moderate", high: "High" }[
                      levelFromScore(latestResult.score)
                    ]
                  }{" "}
                  risk
                </Text>
                <Text variant="caption" color="textTertiary">
                  {new Date(latestResult.completedAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </View>
          </Card>
        </Section>
      )}

      {user && (
        <Card padded={false} style={[styles.section, styles.logoutCard]}>
          <Button
            label="Log out"
            onPress={handleLogout}
            variant="ghost"
            icon="log-out-outline"
          />
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  identityText: { flex: 1, gap: 2 },
  photoHint: { marginTop: spacing.xs, fontWeight: "600" },
  signIn: { marginTop: spacing.lg },

  section: { marginTop: spacing.xxl },
  metricsStack: { gap: spacing.md },
  metrics: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  metricDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginHorizontal: spacing.md },

  bmiRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  bandChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  bmiNote: { marginTop: spacing.md },

  resultRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  resultMeta: { flex: 1, gap: 1 },

  logoutCard: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
});
