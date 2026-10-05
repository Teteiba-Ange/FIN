// app/(menu)/edit-profile.tsx
/**
 * Edit profile.
 *
 * The critical fix is structural. The old file defined its `Field` component
 * *inside* `EditProfile`:
 *
 *     const EditProfile = () => {
 *       ...
 *       const Field = ({ ... }) => ( <TextInput ... /> );   // ← new type each render
 *
 * React compares component types by identity. A function defined in the render
 * body is a different type on every render, so React unmounted each TextInput
 * and mounted a fresh one on every keystroke — which drops focus and dismisses
 * the keyboard. The screen was unusable, not merely awkward. (B-02 in PLAN.md.)
 *
 * Using the kit's `Field` fixes it and removes ~90 lines of bespoke input
 * styling at the same time.
 *
 * Also corrected: the form previously seeded `avgCycleLength` to "34",
 * `lastPeriod` to "Not tracked" and `medicalBackground` to "No medical
 * background provided" — placeholder strings pre-filled as if they were the
 * user's own answers, in fields that were never sent anywhere on save.
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Field,
  Button,
  Text,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/features/auth";
import { spacing, useTheme } from "@/theme";

type Form = {
  fullName: string;
  age: string;
  weight: string;
  height: string;
};

type Errors = Partial<Record<keyof Form, string>> & { form?: string };

/** Ranges wide enough not to reject anyone real, tight enough to catch typos. */
const BOUNDS = {
  age: { min: 10, max: 100, unit: "years" },
  weight: { min: 25, max: 300, unit: "kg" },
  height: { min: 100, max: 250, unit: "cm" },
} as const;

export default function EditProfileScreen() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { user, updateProfile } = useAuth();

  const [form, setForm] = useState<Form>({
    fullName: user?.fullName ?? "",
    age: user?.age != null ? String(user.age) : "",
    weight: user?.weight != null ? String(user.weight) : "",
    height: user?.height != null ? String(user.height) : "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  // Re-seed when the profile arrives from the server after first paint.
  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName ?? "",
      age: user.age != null ? String(user.age) : "",
      weight: user.weight != null ? String(user.weight) : "",
      height: user.height != null ? String(user.height) : "",
    });
  }, [user]);

  const set = (key: keyof Form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, form: undefined }));
  };

  const checkNumber = (
    key: "age" | "weight" | "height",
    label: string
  ): string | undefined => {
    const raw = form[key].trim();
    // These are optional — an empty field is a user who hasn't measured yet,
    // not an error to shout about.
    if (!raw) return undefined;
    const n = Number(raw);
    if (Number.isNaN(n)) return `${label} should be a number`;
    const { min, max, unit } = BOUNDS[key];
    if (n < min || n > max) return `That looks off — expected ${min}–${max} ${unit}`;
    return undefined;
  };

  const validate = (): boolean => {
    const next: Errors = {};
    if (!form.fullName.trim()) next.fullName = "Enter your name";
    next.age = checkNumber("age", "Age");
    next.weight = checkNumber("weight", "Weight");
    next.height = checkNumber("height", "Height");

    const cleaned = Object.fromEntries(
      Object.entries(next).filter(([, v]) => v != null)
    ) as Errors;

    setErrors(cleaned);
    return Object.keys(cleaned).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      await updateProfile({
        fullName: form.fullName.trim(),
        age: form.age.trim(),
        weight: form.weight.trim(),
        height: form.height.trim(),
      });
      toast.show("Profile saved");
      router.back();
    } catch (error: any) {
      setErrors({
        form: error?.message ?? "We couldn't save your profile. Check your connection and try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Edit profile" />

      <Section title="Account">
        <Card>
          <View style={styles.group}>
            <Field
              label="Full name"
              placeholder="Jane Doe"
              value={form.fullName}
              onChangeText={(v) => set("fullName", v)}
              error={errors.fullName}
              required
              autoCapitalize="words"
              textContentType="name"
            />

            {/*
              Email is the account identifier and there is no change-email
              flow behind it, so it is shown as text rather than as a
              permanently disabled input pretending to be editable.
            */}
            <View style={styles.readOnly}>
              <Text variant="caption" color="textSecondary">
                Email address
              </Text>
              <Text variant="body">{user?.email ?? "—"}</Text>
              <Text variant="caption" color="textTertiary">
                Your email can&apos;t be changed here.
              </Text>
            </View>
          </View>
        </Card>
      </Section>

      <Section
        title="Measurements"
        subtitle="Used by your assessment. Leave anything blank you'd rather not share."
        style={styles.section}
      >
        <Card>
          <View style={styles.group}>
            <View style={styles.row}>
              <Field
                label="Age"
                placeholder="28"
                value={form.age}
                onChangeText={(v) => set("age", v)}
                error={errors.age}
                keyboardType="number-pad"
                containerStyle={styles.rowItem}
              />
              <Field
                label="Weight (kg)"
                placeholder="64"
                value={form.weight}
                onChangeText={(v) => set("weight", v)}
                error={errors.weight}
                keyboardType="decimal-pad"
                containerStyle={styles.rowItem}
              />
            </View>

            <Field
              label="Height (cm)"
              placeholder="168"
              value={form.height}
              onChangeText={(v) => set("height", v)}
              error={errors.height}
              keyboardType="number-pad"
            />
          </View>
        </Card>
      </Section>

      {errors.form && (
        <Text
          variant="callout"
          style={[styles.formError, { color: colors.danger }]}
          accessibilityLiveRegion="polite"
        >
          {errors.form}
        </Text>
      )}

      <View style={styles.actions}>
        <Button label="Save changes" onPress={handleSave} loading={saving} size="lg" />
        <Button
          label="Cancel"
          onPress={() => router.back()}
          variant="ghost"
          size="sm"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  group: { gap: spacing.lg },
  row: { flexDirection: "row", gap: spacing.md },
  rowItem: { flex: 1 },
  readOnly: { gap: spacing.xs },
  formError: { marginTop: spacing.lg },
  actions: { marginTop: spacing.xxl, gap: spacing.sm },
});
