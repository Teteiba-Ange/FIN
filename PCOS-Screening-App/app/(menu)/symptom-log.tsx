// app/(menu)/symptom-log.tsx
/**
 * Log a symptom.
 *
 * Rebuilt on the design system. Substantive changes beyond the styling:
 *
 *   - The native `Picker` is gone. It renders OS chrome that ignores every
 *     token in the theme, looks different on each platform, and has no dark
 *     mode at all. Eight symptoms fit as chips, which is also one tap instead
 *     of three.
 *   - Severity was five bare numbers. A "4" means nothing on its own, so two
 *     users pick it for different things and the data is not comparable. Each
 *     step now carries a word, and the scale announces itself as a radio group.
 *   - "Saved" was an `Alert` — a blocking modal to confirm a thing that
 *     worked. It's a toast now, and the new entry appears at the top of the
 *     list below, which is the real confirmation.
 *   - The list had no empty state; a first-time user saw the heading
 *     "Recent Logs" above nothing.
 *
 * Still device-local (A-02 in PLAN.md). Server sync lands in phase 01.
 */

import React, { useCallback, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Chip,
  Button,
  Field,
  Text,
  Scale,
  EmptyState,
  useToast,
  type ScaleStep,
} from "@/components/ui";
import { getSymptomLogs, addSymptomLog, type SymptomLog } from "@/lib/logs";
import { useTheme, spacing, radius } from "@/theme";

const SYMPTOMS = [
  "Pain (pelvic/back)",
  "Fatigue",
  "Headache",
  "Nausea",
  "Acne",
  "Hair loss",
  "Irregular bleeding",
  "Mood swings",
] as const;

/**
 * Anchoring each number to a word is what makes the scale comparable between
 * one week and the next. Wording is deliberately about interference with the
 * day rather than intensity, which people rate far more consistently.
 */
const SEVERITY: readonly ScaleStep[] = [
  { value: 1, label: "Barely noticed it" },
  { value: 2, label: "Mild — easy to ignore" },
  { value: 3, label: "Noticeable but manageable" },
  { value: 4, label: "Hard to ignore" },
  { value: 5, label: "Got in the way of my day" },
];

export default function SymptomLogScreen() {
  const { colors } = useTheme();
  const toast = useToast();

  const [logs, setLogs] = useState<SymptomLog[]>([]);
  const [symptom, setSymptom] = useState<string>(SYMPTOMS[0]);
  const [severity, setSeverity] = useState(3);
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSymptomLogs().then((stored) => {
        if (active) setLogs(stored);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const handleSave = async () => {
    setSaving(true);

    // Writes locally and queues the server copy. The local write is what the
    // list below reflects, so this works with no connection; the queue is what
    // makes the entry survive a reinstall. (A-02.)
    const updated = await addSymptomLog({
      symptom,
      severity,
      notes: notes.trim(),
      date: date.toISOString(),
    });
    setLogs(updated);

    // Reset only what should reset. The date stays where the user put it —
    // someone catching up on a few days shouldn't have to re-pick it each time.
    setNotes("");
    setSeverity(3);
    setSaving(false);
    toast.show("Symptom logged");
  };

  const isToday = date.toDateString() === new Date().toDateString();
  const dateLabel = isToday
    ? "Today"
    : date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });

  return (
    <Screen>
      <ScreenHeader title="Log a symptom" />

      <View style={styles.form}>
        <View style={styles.group}>
          <Text variant="caption" color="textSecondary">
            What are you feeling?
          </Text>
          <View style={styles.chips}>
            {SYMPTOMS.map((s) => (
              <Chip
                key={s}
                label={s}
                selected={symptom === s}
                onPress={() => setSymptom(s)}
              />
            ))}
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="caption" color="textSecondary">
            How bad was it?
          </Text>
          <Scale
            steps={SEVERITY}
            value={severity}
            onChange={setSeverity}
            accessibilityLabel="Severity"
          />
        </View>

        <View style={styles.group}>
          <Text variant="caption" color="textSecondary">
            When?
          </Text>
          <Button
            label={dateLabel}
            onPress={() => setShowPicker(true)}
            variant="secondary"
            icon="calendar-outline"
            accessibilityLabel={`Date: ${dateLabel}. Change it.`}
          />
          {showPicker && (
            <DateTimePicker
              value={date}
              mode="date"
              display={Platform.OS === "ios" ? "inline" : "default"}
              // A symptom can't be logged for a day that hasn't happened.
              maximumDate={new Date()}
              onChange={(_, selected) => {
                setShowPicker(Platform.OS === "ios");
                if (selected) setDate(selected);
              }}
            />
          )}
        </View>

        <Field
          label="Notes"
          placeholder="Anything else worth remembering?"
          helper="Optional. What you were doing, what helped."
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={3}
          containerStyle={styles.notes}
        />

        <Button
          label="Save entry"
          onPress={handleSave}
          loading={saving}
          size="lg"
          icon="checkmark"
        />
      </View>

      <Section title="Recent entries" style={styles.history}>
        {logs.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="create-outline"
              title="Nothing logged yet"
              description="Entries you save appear here, newest first. A few weeks of them is what makes patterns visible."
            />
          </Card>
        ) : (
          <Card padded={false} style={styles.list}>
            {logs.slice(0, 8).map((log, i) => {
              const word = SEVERITY.find((s) => s.value === log.severity)?.label;
              return (
                <View
                  key={log.id}
                  style={[
                    styles.entry,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}
                  accessible
                  accessibilityLabel={`${log.symptom}, severity ${log.severity} of 5, ${word}, ${new Date(
                    log.date
                  ).toLocaleDateString()}${log.notes ? `. Note: ${log.notes}` : ""}`}
                >
                  <View
                    style={[styles.severityDot, { backgroundColor: colors.primarySubtle }]}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <Text variant="callout" numeric style={{ color: colors.primary, fontWeight: "700" }}>
                      {log.severity}
                    </Text>
                  </View>

                  <View style={styles.entryText}>
                    <Text variant="bodyStrong">{log.symptom}</Text>
                    <Text variant="caption" color="textTertiary">
                      {new Date(log.date).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                      {" · "}
                      {word}
                    </Text>
                    {log.notes ? (
                      <Text variant="callout" color="textSecondary" style={styles.entryNote}>
                        {log.notes}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        )}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xl },
  group: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },

  notes: { marginTop: -spacing.xs },

  history: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg },
  entry: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  severityDot: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  entryText: { flex: 1, gap: 1 },
  entryNote: { marginTop: spacing.xs },
});
