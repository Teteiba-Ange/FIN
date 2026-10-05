// app/(menu)/privacy.tsx
/**
 * Privacy, data export and account deletion (G-06).
 *
 * None of this existed. Both app stores require a privacy policy and an
 * in-app account deletion path for any app with accounts, and this one
 * collects menstrual history, symptoms, medications and family medical
 * history — so it is also the section the dissertation's ethics chapter needs.
 *
 * Written to describe what the code actually does. Every claim below is
 * checkable against the source: notes really are AES-256-GCM encrypted before
 * they are stored (`utils/fieldCrypto.js`), deletion really does drop the rows
 * rather than set a flag (`accountController.js`), and nothing is shared with
 * anyone because there is nowhere for it to go.
 */

import React, { useState } from "react";
import { Alert, Share, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Button,
  Field,
  Text,
  useToast,
} from "@/components/ui";
import { apiService } from "@/lib/api";
import { useAuth } from "@/features/auth";
import { clearConsent } from "@/lib/consent";
import { useTheme, spacing, radius } from "@/theme";

type Point = { icon: keyof typeof Ionicons.glyphMap; title: string; body: string };

const WHAT_WE_HOLD: Point[] = [
  {
    icon: "person-outline",
    title: "Your account",
    body: "Name and email. Your password is stored only as a bcrypt hash — it cannot be read back, including by us.",
  },
  {
    icon: "create-outline",
    title: "What you log",
    body: "Symptoms, cycle dates, moods and medications, with any notes you add.",
  },
  {
    icon: "clipboard-outline",
    title: "Assessment answers",
    body: "The answers you give in the screening flow, and the scores it produced.",
  },
];

const HOW_ITS_HANDLED: Point[] = [
  {
    icon: "key-outline",
    title: "Notes are encrypted",
    body: "Free-text notes are encrypted (AES-256-GCM) before being written to the database, so they are not readable in a raw dump of it.",
  },
  {
    icon: "eye-off-outline",
    title: "Nobody else can see it",
    body: "Every request is scoped to your own account. The only thing other people ever see is a community post, and only if you write one.",
  },
  {
    icon: "phone-portrait-outline",
    title: "A copy stays on your phone",
    body: "So the app works offline. Signing out removes it from the device.",
  },
  {
    icon: "share-social-outline",
    title: "It isn't sold or shared",
    body: "There is no analytics service, no advertising and no third party receiving your health data.",
  },
];

export default function PrivacyScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const toast = useToast();
  const { user, logout } = useAuth();

  const [exporting, setExporting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await apiService.exportMyData();
      const json = JSON.stringify(data, null, 2);

      // Share rather than a file download: the artifact sandbox aside, a share
      // sheet lets the user choose where it goes — email it to themselves,
      // save to Drive, hand it to a clinician — without the app needing
      // storage permissions.
      await Share.share({
        title: "My PCOS Screening data",
        message: json,
      });
    } catch (error: any) {
      toast.show(error?.message ?? "Couldn't build your export", { tone: "error" });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!password) {
      setDeleteError("Enter your password to confirm");
      return;
    }

    Alert.alert(
      "Delete everything?",
      "Your account, every symptom and cycle you've logged, and all your assessment results will be permanently removed. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            setDeleteError(null);
            try {
              await apiService.deleteMyAccount(password);
              // Consent belongs to the account that just ceased to exist.
              await clearConsent();
              await logout();
              router.replace("/onboarding");
            } catch (error: any) {
              setDeleteError(error?.message ?? "Couldn't delete your account");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const renderPoints = (points: Point[]) => (
    <Card padded={false} style={styles.group}>
      {points.map((p, i) => (
        <View
          key={p.title}
          style={[
            styles.point,
            i > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
            },
          ]}
        >
          <View
            style={[styles.icon, { backgroundColor: colors.sunken }]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Ionicons name={p.icon} size={17} color={colors.primary} />
          </View>
          <View style={styles.pointText}>
            <Text variant="bodyStrong">{p.title}</Text>
            <Text variant="callout" color="textSecondary">
              {p.body}
            </Text>
          </View>
        </View>
      ))}
    </Card>
  );

  return (
    <Screen>
      <ScreenHeader
        title="Your data"
        subtitle="What this app holds, how it's handled, and how to take it back."
      />

      <Section title="What we hold">{renderPoints(WHAT_WE_HOLD)}</Section>

      <Section title="How it's handled" style={styles.section}>
        {renderPoints(HOW_ITS_HANDLED)}
      </Section>

      <Section
        title="Take it with you"
        subtitle="A full copy of everything, as JSON."
        style={styles.section}
      >
        <Button
          label="Export my data"
          onPress={handleExport}
          loading={exporting}
          variant="secondary"
          icon="download-outline"
        />
      </Section>

      {user && (
        <Section title="Delete my account" style={styles.section}>
          {!confirmingDelete ? (
            <Card variant="sunken">
              <Text variant="callout" color="textSecondary" style={styles.deleteIntro}>
                This removes your account and everything you&apos;ve logged from
                the server permanently. It cannot be undone, so export first if
                you want a copy.
              </Text>
              <Button
                label="Delete my account"
                onPress={() => setConfirmingDelete(true)}
                variant="danger"
                icon="trash-outline"
              />
            </Card>
          ) : (
            <Card style={[styles.confirm, { borderColor: colors.danger }]}>
              <Text variant="bodyStrong" style={{ color: colors.danger }}>
                Confirm with your password
              </Text>
              <Text variant="callout" color="textSecondary">
                We ask for this so a borrowed phone can&apos;t wipe your health
                history.
              </Text>

              <Field
                label="Password"
                placeholder="Your password"
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setDeleteError(null);
                }}
                error={deleteError ?? undefined}
                secure
                autoCapitalize="none"
                textContentType="password"
              />

              <Button
                label="Delete everything permanently"
                onPress={handleDelete}
                loading={deleting}
                variant="danger"
              />
              <Button
                label="Cancel"
                onPress={() => {
                  setConfirmingDelete(false);
                  setPassword("");
                  setDeleteError(null);
                }}
                variant="ghost"
                size="sm"
              />
            </Card>
          )}
        </Section>
      )}

      <Card variant="sunken" style={styles.footer}>
        <Text variant="caption" color="textTertiary">
          This app was built as a University of Ghana final-year project. It is
          a screening and tracking tool, not a medical device, and it does not
          replace care from a qualified clinician.
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xxl },
  group: { paddingHorizontal: spacing.lg },
  point: {
    flexDirection: "row",
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  pointText: { flex: 1, gap: 2 },
  deleteIntro: { marginBottom: spacing.lg },
  confirm: { gap: spacing.md, borderWidth: 1.5 },
  footer: { marginTop: spacing.xxl },
});
