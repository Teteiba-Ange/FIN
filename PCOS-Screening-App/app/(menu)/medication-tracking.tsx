// app/(menu)/medication-tracking.tsx
/**
 * Medications and supplements.
 *
 * The heaviest file in the app — 60 hardcoded hex values, seven bespoke colour
 * constants, a dark-teal header bar, a coloured banner, a tab strip and cards
 * nested three deep. It is now flat rows on the page background like every
 * other screen.
 *
 * Two substantive fixes beyond the styling:
 *
 * C-05 — The "Quick Add" presets shipped named drugs at specific doses:
 *   Metformin 500mg, Inositol 2000mg, Birth Control Pill 1 pill, Vitamin D3
 *   2000IU. Pre-filling a prescription-only drug at a dosage is a clinical
 *   suggestion however the surrounding text is worded. The presets now offer
 *   names only, as spelling help, and the dose field is always the user's to
 *   fill from what they were actually prescribed.
 *
 * C-06 — Adherence divided by 7 unconditionally. A medication added today read
 *   14%; one taken perfectly every week could never exceed 14%; "as needed"
 *   was scored against a daily denominator that means nothing. All of them
 *   rendered red, so correct use was displayed as failure. Adherence is now
 *   computed against doses actually expected since the medication was added,
 *   and is withheld entirely until there are enough of them to be meaningful.
 */

import React, { useCallback, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  Screen,
  ScreenHeader,
  Section,
  Card,
  Chip,
  Button,
  Field,
  Text,
  Stat,
  EmptyState,
  useToast,
} from "@/components/ui";
import { useTheme, spacing, radius, minTouchTarget } from "@/theme";

// ─── Model ───────────────────────────────────────────────────────────────────

const FREQUENCIES = ["Daily", "Twice daily", "Weekly", "As needed"] as const;
type Frequency = (typeof FREQUENCIES)[number];

const CATEGORIES = ["Medication", "Supplement", "Vitamin"] as const;
type Category = (typeof CATEGORIES)[number];

type Medication = {
  id: string;
  name: string;
  dose: string;
  frequency: Frequency;
  category: Category;
  startDate: string;
  notes: string;
  active: boolean;
};

type AdherenceLog = {
  id: string;
  medicationId: string;
  date: string;
  taken: boolean;
};

const CATEGORY_ICON: Record<Category, keyof typeof Ionicons.glyphMap> = {
  Medication: "medkit-outline",
  Supplement: "leaf-outline",
  Vitamin: "nutrition-outline",
};

/**
 * Names only — no doses. These exist so the user doesn't have to spell
 * "Metformin", not to suggest anyone take it.
 */
const COMMON_NAMES = [
  "Metformin",
  "Inositol",
  "Vitamin D",
  "Omega-3",
  "Folic acid",
  "Spironolactone",
];

const STORAGE = {
  MEDICATIONS: "pmos_medications",
  ADHERENCE: "pmos_adherence_logs",
};

const DAY_MS = 86_400_000;
const todayKey = () => new Date().toISOString().slice(0, 10);

const loadMeds = async (): Promise<Medication[]> =>
  JSON.parse((await AsyncStorage.getItem(STORAGE.MEDICATIONS)) ?? "[]");
const saveMeds = (data: Medication[]) =>
  AsyncStorage.setItem(STORAGE.MEDICATIONS, JSON.stringify(data));
const loadLogs = async (): Promise<AdherenceLog[]> =>
  JSON.parse((await AsyncStorage.getItem(STORAGE.ADHERENCE)) ?? "[]");
const saveLogs = (data: AdherenceLog[]) =>
  AsyncStorage.setItem(STORAGE.ADHERENCE, JSON.stringify(data));

// ─── Adherence ───────────────────────────────────────────────────────────────

/** How many doses this medication should have had since it was added. */
function expectedDoses(med: Medication, windowDays = 7): number | null {
  // "As needed" has no schedule, so there is no denominator and no adherence
  // figure to give. Showing one would be inventing a target the user never set.
  if (med.frequency === "As needed") return null;

  const added = new Date(med.startDate).getTime();
  const daysSinceAdded = Math.floor((Date.now() - added) / DAY_MS) + 1;
  const days = Math.min(Math.max(daysSinceAdded, 0), windowDays);

  switch (med.frequency) {
    case "Daily":
      return days;
    case "Twice daily":
      // The tracker records one tick per day, so a twice-daily medication is
      // still measured per-day here. Per-dose ticking is a larger change.
      return days;
    case "Weekly":
      return Math.max(1, Math.round(days / 7));
  }
}

function adherence(
  med: Medication,
  logs: AdherenceLog[]
): { pct: number; taken: number; expected: number } | null {
  const expected = expectedDoses(med);
  // Below three expected doses the percentage swings wildly on a single tick
  // and reads as failure on day one. Withhold it until it means something.
  if (expected == null || expected < 3) return null;

  const cutoff = Date.now() - 7 * DAY_MS;
  const taken = logs.filter(
    (l) =>
      l.medicationId === med.id &&
      l.taken &&
      new Date(l.date).getTime() >= cutoff
  ).length;

  return {
    pct: Math.min(100, Math.round((taken / expected) * 100)),
    taken,
    expected,
  };
}

// ─── Add sheet ───────────────────────────────────────────────────────────────

function AddMedicationSheet({
  visible,
  onClose,
  onSave,
}: {
  visible: boolean;
  onClose: () => void;
  onSave: (med: Omit<Medication, "id" | "active">) => void;
}) {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("Daily");
  const [category, setCategory] = useState<Category>("Supplement");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDose("");
    setFrequency("Daily");
    setCategory("Supplement");
    setNotes("");
    setError(null);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError("Give it a name so you can recognise it later.");
      return;
    }
    onSave({
      name: name.trim(),
      dose: dose.trim(),
      frequency,
      category,
      startDate: new Date().toISOString(),
      notes: notes.trim(),
    });
    reset();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.sheet, { backgroundColor: colors.bg }]}>
        <View style={[styles.sheetBar, { borderBottomColor: colors.border }]}>
          <Button
            label="Cancel"
            onPress={() => {
              reset();
              onClose();
            }}
            variant="ghost"
            size="sm"
            fullWidth={false}
          />
          <Text variant="subhead">Add medication</Text>
          <Button label="Save" onPress={handleSave} size="sm" fullWidth={false} />
        </View>

        {/*
          `edges={[]}` because the Modal's own SafeAreaView already inset the
          top — nesting a second one would double the gap under the sheet bar.
        */}
        <Screen edges={[]} contentContainerStyle={styles.sheetBody}>
          <Field
            label="Name"
            placeholder="What is it called?"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(null);
            }}
            error={error ?? undefined}
            required
            autoCapitalize="words"
          />

          {/*
            Spelling help only. The old version filled in a dose alongside the
            name, which is the part that made it a recommendation.
          */}
          <View style={styles.group}>
            <Text variant="caption" color="textSecondary">
              Common names
            </Text>
            <View style={styles.chips}>
              {COMMON_NAMES.map((n) => (
                <Chip
                  key={n}
                  label={n}
                  selected={name === n}
                  onPress={() => {
                    setName(n);
                    setError(null);
                  }}
                />
              ))}
            </View>
          </View>

          <Field
            label="Dose"
            placeholder="e.g. 500mg, 1 tablet"
            helper="Whatever your prescription or the label says."
            value={dose}
            onChangeText={setDose}
          />

          <View style={styles.group}>
            <Text variant="caption" color="textSecondary">
              Type
            </Text>
            <View style={styles.chips}>
              {CATEGORIES.map((c) => (
                <Chip
                  key={c}
                  label={c}
                  icon={CATEGORY_ICON[c]}
                  selected={category === c}
                  onPress={() => setCategory(c)}
                />
              ))}
            </View>
          </View>

          <View style={styles.group}>
            <Text variant="caption" color="textSecondary">
              How often
            </Text>
            <View style={styles.chips}>
              {FREQUENCIES.map((f) => (
                <Chip
                  key={f}
                  label={f}
                  selected={frequency === f}
                  onPress={() => setFrequency(f)}
                />
              ))}
            </View>
          </View>

          <Field
            label="Notes"
            placeholder="e.g. take with food"
            helper="Optional."
            value={notes}
            onChangeText={setNotes}
            multiline
            numberOfLines={2}
          />
        </Screen>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MedicationTrackingScreen() {
  const { colors } = useTheme();
  const toast = useToast();

  const [meds, setMeds] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<AdherenceLog[]>([]);
  const [ready, setReady] = useState(false);
  const [adding, setAdding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([loadMeds(), loadLogs()]).then(([m, l]) => {
        if (!active) return;
        setMeds(m);
        setLogs(l);
        setReady(true);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const activeMeds = useMemo(() => meds.filter((m) => m.active), [meds]);
  const today = todayKey();

  const takenToday = useCallback(
    (id: string) => logs.some((l) => l.medicationId === id && l.date === today && l.taken),
    [logs, today]
  );

  const scheduled = activeMeds.filter((m) => m.frequency !== "As needed");
  const doneToday = scheduled.filter((m) => takenToday(m.id)).length;

  const handleAdd = async (data: Omit<Medication, "id" | "active">) => {
    const next = [{ ...data, id: Date.now().toString(), active: true }, ...meds];
    setMeds(next);
    await saveMeds(next);
    toast.show(`${data.name} added`);
  };

  const handleToggle = async (med: Medication) => {
    const already = takenToday(med.id);
    const next = already
      ? logs.filter((l) => !(l.medicationId === med.id && l.date === today))
      : [
          ...logs,
          {
            id: Date.now().toString(),
            medicationId: med.id,
            date: today,
            taken: true,
          },
        ];
    setLogs(next);
    await saveLogs(next);
  };

  const handleRemove = async (med: Medication) => {
    const next = meds.filter((m) => m.id !== med.id);
    setMeds(next);
    await saveMeds(next);
    toast.show(`${med.name} removed`);
  };

  return (
    <Screen>
      <ScreenHeader
        title="Medications"
        action={{
          icon: "add",
          label: "Add a medication",
          onPress: () => setAdding(true),
        }}
      />

      {ready && activeMeds.length === 0 ? (
        <Card padded={false}>
          <EmptyState
            icon="medkit-outline"
            title="Nothing added yet"
            description="Add what you take and tick it off each day. After a week you'll see how consistent you've been."
            actionLabel="Add your first"
            onActionPress={() => setAdding(true)}
          />
        </Card>
      ) : (
        <>
          {scheduled.length > 0 && (
            <Card variant="raised" style={styles.today}>
              <Stat
                label="Taken today"
                value={`${doneToday}`}
                unit={`of ${scheduled.length}`}
              />
              {doneToday === scheduled.length && (
                <View style={[styles.allDone, { backgroundColor: colors.riskLowSubtle }]}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.riskLow} />
                  <Text variant="callout" style={{ color: colors.riskLow }}>
                    All done
                  </Text>
                </View>
              )}
            </Card>
          )}

          <Section title="Today" style={styles.section}>
            <View style={styles.list}>
              {activeMeds.map((med) => {
                const taken = takenToday(med.id);
                const stats = adherence(med, logs);
                const asNeeded = med.frequency === "As needed";

                return (
                  <Card key={med.id} style={styles.med}>
                    <View style={styles.medRow}>
                      <Pressable
                        onPress={() => handleToggle(med)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: taken }}
                        accessibilityLabel={`${med.name}${med.dose ? `, ${med.dose}` : ""}. Mark as taken today.`}
                        hitSlop={spacing.sm}
                        style={[
                          styles.check,
                          {
                            backgroundColor: taken ? colors.primary : "transparent",
                            borderColor: taken ? colors.primary : colors.borderStrong,
                          },
                        ]}
                      >
                        {taken && (
                          <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
                        )}
                      </Pressable>

                      <View style={styles.medText}>
                        <Text variant="bodyStrong">{med.name}</Text>
                        <Text variant="caption" color="textTertiary">
                          {[med.dose, med.frequency].filter(Boolean).join(" · ")}
                        </Text>
                        {med.notes ? (
                          <Text variant="caption" color="textSecondary" style={styles.medNote}>
                            {med.notes}
                          </Text>
                        ) : null}
                      </View>

                      <Pressable
                        onPress={() => handleRemove(med)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${med.name}`}
                        hitSlop={spacing.sm}
                        style={styles.remove}
                      >
                        <Ionicons name="close" size={18} color={colors.textTertiary} />
                      </Pressable>
                    </View>

                    {/*
                      Shown only where it means something. "As needed" has no
                      schedule; a medication added two days ago has no week to
                      measure. Both used to read 14% in red.
                    */}
                    {stats ? (
                      <View style={styles.adherence}>
                        <View style={[styles.bar, { backgroundColor: colors.sunken }]}>
                          <View
                            style={[
                              styles.barFill,
                              {
                                width: `${stats.pct}%`,
                                backgroundColor:
                                  stats.pct >= 80 ? colors.riskLow : colors.riskModerate,
                              },
                            ]}
                          />
                        </View>
                        <Text variant="caption" color="textSecondary" numeric>
                          {stats.taken} of {stats.expected} this week
                        </Text>
                      </View>
                    ) : asNeeded ? null : (
                      <Text variant="caption" color="textTertiary" style={styles.adherence}>
                        Keep ticking — a weekly figure appears after a few days.
                      </Text>
                    )}
                  </Card>
                );
              })}
            </View>
          </Section>
        </>
      )}

      <AddMedicationSheet
        visible={adding}
        onClose={() => setAdding(false)}
        onSave={handleAdd}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  today: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  allDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  section: { marginTop: spacing.xxl },
  list: { gap: spacing.md },

  med: { gap: spacing.md },
  medRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  check: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  medText: { flex: 1, gap: 1 },
  medNote: { marginTop: spacing.xs },
  remove: {
    width: minTouchTarget - 12,
    height: minTouchTarget - 12,
    alignItems: "center",
    justifyContent: "center",
  },

  adherence: { gap: spacing.xs },
  bar: { height: 5, borderRadius: radius.sm, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: radius.sm },

  sheet: { flex: 1 },
  sheetBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetBody: { paddingTop: spacing.lg, gap: spacing.lg },
  group: { gap: spacing.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
