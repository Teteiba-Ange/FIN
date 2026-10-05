// app/(menu)/cycle-tracker.tsx
/**
 * Cycle tracker (E-04).
 *
 * The original was 97 lines: two raw `<Button>`s, a native `Picker`, a notes
 * box, five entries as unstyled text, no header and no analysis. It stored
 * dates and told the user nothing about them.
 *
 * This is built around a month calendar, because for a cycle tracker the
 * calendar *is* the product — it is the only view where "my periods are
 * irregular" stops being a feeling and becomes visible.
 *
 * Logging is now tap-a-day rather than fill-a-form: pick the start on the
 * calendar, pick the end, confirm. The form is still there underneath for the
 * flow and notes, but the dates come from the grid.
 *
 * All derived numbers come from `lib/cycle/analysis`, which the notification
 * scheduler and the assessment also use — so the screen, the reminder and the
 * assessment can never disagree about what the same logs mean.
 */

import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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
  MonthCalendar,
  useToast,
} from "@/components/ui";
import { getCycleEntries, addCycleEntry, type CycleEntry } from "@/lib/logs";
import {
  analyseCycles,
  periodDayKeys,
  predictedDayKeys,
  dateKey,
} from "@/lib/cycle/analysis";
import { scheduleCycleReminder } from "@/lib/notifications";
import { getNotificationSettings } from "@/lib/storage";
import { useTheme, spacing, radius } from "@/theme";

const FLOWS = ["Light", "Medium", "Heavy"] as const;
type Flow = (typeof FLOWS)[number];

/** Nothing is logged until both ends are chosen, so the draft holds one or two. */
type Draft = { start: Date; end: Date | null };

export default function CycleTrackerScreen() {
  const { colors } = useTheme();
  const toast = useToast();

  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [month, setMonth] = useState(() => new Date());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [flow, setFlow] = useState<Flow>("Medium");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getCycleEntries().then((stored) => {
        if (active) setEntries(stored);
      });
      return () => {
        active = false;
      };
    }, [])
  );

  const analysis = useMemo(() => analyseCycles(entries), [entries]);
  const logged = useMemo(() => periodDayKeys(entries), [entries]);
  const predicted = useMemo(() => predictedDayKeys(analysis), [analysis]);

  /** The draft range, so days shade as they're picked rather than after saving. */
  const draftDays = useMemo(() => {
    if (!draft) return new Set<string>();
    const keys = new Set<string>();
    const end = draft.end ?? draft.start;
    const days = Math.min(
      Math.max(Math.round((end.getTime() - draft.start.getTime()) / 86_400_000), 0),
      14
    );
    for (let i = 0; i <= days; i++) {
      keys.add(dateKey(new Date(draft.start.getTime() + i * 86_400_000)));
    }
    return keys;
  }, [draft]);

  const handleSelectDay = (date: Date) => {
    // First tap sets the start. Second sets the end, unless it's earlier —
    // in which case the user is more likely restarting than making a mistake.
    if (!draft || draft.end) {
      setDraft({ start: date, end: null });
      return;
    }
    if (date < draft.start) {
      setDraft({ start: date, end: null });
      return;
    }
    setDraft({ ...draft, end: date });
  };

  const handleSave = async () => {
    if (!draft) return;
    setSaving(true);

    const updated = await addCycleEntry({
      startDate: draft.start.toISOString(),
      endDate: (draft.end ?? draft.start).toISOString(),
      flow,
      notes: notes.trim(),
    });

    setEntries(updated);
    setDraft(null);
    setNotes("");
    setFlow("Medium");
    setSaving(false);
    toast.show("Period logged");

    // The prediction moves with every entry, so the queued reminder has to be
    // rebuilt — one scheduled against the old average would fire on a date the
    // calendar above no longer agrees with. (C-01.)
    getNotificationSettings()
      .then((prefs) => (prefs.cycleReminder ? scheduleCycleReminder() : null))
      .catch(() => {});
  };

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <Screen>
      <ScreenHeader title="Cycle" />

      <Card>
        <MonthCalendar
          month={month}
          onMonthChange={setMonth}
          // The draft is shown in the same style as saved days, so the user
          // sees the range they are about to commit.
          periodDays={new Set([...logged, ...draftDays])}
          predictedDays={predicted}
          selected={draft?.start ?? null}
          onSelectDay={handleSelectDay}
        />
      </Card>

      {/* ── Logging ─────────────────────────────────────────────────────── */}
      {draft ? (
        <Card variant="raised" style={styles.draft}>
          <Text variant="label" color="textTertiary">
            {draft.end ? "New entry" : "Now pick the last day"}
          </Text>
          <Text variant="subhead">
            {draft.end
              ? `${fmt(draft.start)} – ${fmt(draft.end)}`
              : `Started ${fmt(draft.start)}`}
          </Text>

          {!draft.end && (
            <Text variant="callout" color="textSecondary">
              Tap the day it ended. If it was a single day, tap the same one
              again.
            </Text>
          )}

          {draft.end && (
            <>
              <View style={styles.group}>
                <Text variant="caption" color="textSecondary">
                  Flow
                </Text>
                <View style={styles.chips}>
                  {FLOWS.map((f) => (
                    <Chip key={f} label={f} selected={flow === f} onPress={() => setFlow(f)} />
                  ))}
                </View>
              </View>

              <Field
                label="Notes"
                placeholder="Cramps, spotting, anything unusual…"
                helper="Optional."
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={2}
              />

              <Button
                label="Save entry"
                onPress={handleSave}
                loading={saving}
                icon="checkmark"
              />
            </>
          )}

          <Button
            label="Cancel"
            onPress={() => {
              setDraft(null);
              setNotes("");
            }}
            variant="ghost"
            size="sm"
          />
        </Card>
      ) : (
        <Card variant="sunken" style={styles.prompt}>
          <Ionicons name="hand-left-outline" size={18} color={colors.textSecondary} />
          <Text variant="callout" color="textSecondary" style={styles.promptText}>
            Tap the day your last period started to log it.
          </Text>
        </Card>
      )}

      {/* ── What the logs mean ──────────────────────────────────────────── */}
      {analysis.average != null ? (
        <Section title="Your pattern" style={styles.section}>
          <Card>
            <View style={styles.stats}>
              <Stat label="Average cycle" value={String(analysis.average)} unit="days" />
              {analysis.variation != null && (
                <Stat label="Varies by" value={String(analysis.variation)} unit="days" />
              )}
              {analysis.averagePeriodDays != null && (
                <Stat
                  label="Period lasts"
                  value={String(analysis.averagePeriodDays)}
                  unit="days"
                />
              )}
            </View>

            <Text variant="caption" color="textTertiary" style={styles.sample}>
              From {analysis.sampleSize} {analysis.sampleSize === 1 ? "cycle" : "cycles"}.
            </Text>
          </Card>

          {analysis.daysLate != null ? (
            <Card variant="sunken" style={[styles.flag, { backgroundColor: colors.riskModerateSubtle }]}>
              <Text variant="callout" style={{ color: colors.riskModerate }}>
                Your period is about {analysis.daysLate}{" "}
                {analysis.daysLate === 1 ? "day" : "days"} later than your average
                would suggest. That happens — but if it keeps happening, it&apos;s
                worth mentioning to a doctor.
              </Text>
            </Card>
          ) : analysis.nextExpected ? (
            <Card variant="sunken" style={styles.next}>
              <Text variant="callout" color="textSecondary">
                Next period estimated around{" "}
                <Text variant="callout" style={{ color: colors.textPrimary, fontWeight: "600" }}>
                  {analysis.nextExpected.toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "long",
                  })}
                </Text>
                . An estimate from your own logs, not a certainty.
              </Text>
            </Card>
          ) : null}

          {analysis.regularity === "Irregular" && (
            <Card variant="sunken" style={[styles.flag, { backgroundColor: colors.riskModerateSubtle }]}>
              <Text variant="callout" style={{ color: colors.riskModerate }}>
                {analysis.reason} Cycle irregularity is one of the main things a
                doctor asks about, and this is exactly the kind of record worth
                showing them.
              </Text>
            </Card>
          )}
        </Section>
      ) : entries.length > 0 ? (
        <Card variant="sunken" style={styles.section}>
          <Text variant="callout" color="textSecondary">
            One period logged. Log the next one and this screen starts showing
            your average length and when to expect the one after.
          </Text>
        </Card>
      ) : null}

      {/* ── History ─────────────────────────────────────────────────────── */}
      <Section title="History" style={styles.section}>
        {entries.length === 0 ? (
          <Card padded={false}>
            <EmptyState
              icon="calendar-outline"
              title="Nothing logged yet"
              description="Tap a day on the calendar above. After two or three periods you'll see your average cycle length and a prediction."
            />
          </Card>
        ) : (
          <Card padded={false} style={styles.list}>
            {entries.slice(0, 8).map((entry, i) => {
              const start = new Date(entry.startDate);
              const end = new Date(entry.endDate);
              const duration =
                Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;

              return (
                <View
                  key={entry.id}
                  style={[
                    styles.entry,
                    i > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}
                  accessible
                  accessibilityLabel={`Period starting ${start.toLocaleDateString()}, ${duration} days, ${entry.flow} flow${
                    entry.notes ? `. Note: ${entry.notes}` : ""
                  }`}
                >
                  <View style={styles.entryText}>
                    <Text variant="bodyStrong">
                      {start.toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "long",
                      })}
                    </Text>
                    <Text variant="caption" color="textTertiary">
                      {duration === 1 ? "1 day" : `${duration} days`} · {entry.flow}
                    </Text>
                    {entry.notes ? (
                      <Text variant="callout" color="textSecondary" style={styles.entryNote}>
                        {entry.notes}
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
  draft: { gap: spacing.md, marginTop: spacing.lg },
  prompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  promptText: { flex: 1 },

  group: { gap: spacing.sm },
  chips: { flexDirection: "row", gap: spacing.sm },

  section: { marginTop: spacing.xxl },
  stats: { flexDirection: "row", gap: spacing.xl, flexWrap: "wrap" },
  sample: { marginTop: spacing.md },
  next: { marginTop: spacing.md },
  flag: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.md },

  list: { paddingHorizontal: spacing.lg },
  entry: { paddingVertical: spacing.md },
  entryText: { gap: 1 },
  entryNote: { marginTop: spacing.xs },
});
