/**
 * lib/cycle/analysis
 * ─────────────────────────────────────────────────────────────────────────────
 * The single source of truth for what a user's logged cycles mean.
 *
 * This existed in two places before — `analyse()` in the cycle tracker screen
 * and `predictNextPeriod()` in the notification scheduler — with the gap
 * filter and averaging duplicated in both. Two copies of a rule is one copy
 * away from a notification claiming a date the screen disagrees with, which
 * for a health app is the kind of contradiction users are right to distrust.
 *
 * Everything derived here follows one principle carried through the rest of
 * the app: nothing is asserted from insufficient data. Fewer than two logged
 * cycles yields no average, no prediction and no regularity verdict, rather
 * than a confident-looking number extrapolated from one point.
 */

import type { CycleEntry } from "@/lib/storage";

export const DAY_MS = 86_400_000;

/**
 * Gaps outside this range are excluded from the average. A gap under 11 days
 * is almost always two entries for the same period; one over 119 is a stretch
 * of untracked months rather than a cycle. Including either would drag the
 * mean somewhere the user would not recognise.
 */
const MIN_GAP = 11;
const MAX_GAP = 119;

/** Clinical rules of thumb, used only to phrase a prompt — never a diagnosis. */
const TYPICAL_MIN = 21;
const TYPICAL_MAX = 35;
/** Variation beyond this is what clinicians describe as irregular. */
const IRREGULAR_SPREAD = 9;
/** No period for this long is the "absent" case, distinct from "irregular". */
const ABSENT_DAYS = 90;

/** Matches `AssessmentData["cycleRegularity"]` so it can be handed straight over. */
export type Regularity = "Regular" | "Irregular" | "No Cycle";

export type CycleAnalysis = {
  /** Cycles used, i.e. gaps between consecutive starts. Zero means no verdict. */
  sampleSize: number;
  /** Mean cycle length in days, or null when there isn't enough history. */
  average: number | null;
  /** Spread between the shortest and longest cycle, in days. */
  variation: number | null;
  shortest: number | null;
  longest: number | null;
  /** Mean bleeding duration in days, across entries that recorded an end. */
  averagePeriodDays: number | null;
  /** Estimated start of the next period. */
  nextExpected: Date | null;
  /** Days past `nextExpected`; null when not overdue or not predictable. */
  daysLate: number | null;
  /** What the logs suggest. Null when there is too little to say. */
  regularity: Regularity | null;
  /** Why `regularity` came out as it did, in words the UI can show verbatim. */
  reason: string | null;
  /** Start dates, oldest first, as ISO strings. */
  sortedStarts: string[];
};

const EMPTY: CycleAnalysis = {
  sampleSize: 0,
  average: null,
  variation: null,
  shortest: null,
  longest: null,
  averagePeriodDays: null,
  nextExpected: null,
  daysLate: null,
  regularity: null,
  reason: null,
  sortedStarts: [],
};

const daysBetween = (a: string | Date, b: string | Date) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);

export function analyseCycles(entries: CycleEntry[]): CycleAnalysis {
  const valid = (entries ?? []).filter((e) => e?.startDate && !Number.isNaN(new Date(e.startDate).getTime()));
  if (valid.length === 0) return EMPTY;

  const sorted = [...valid].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const sortedStarts = sorted.map((e) => e.startDate);

  // Bleeding duration is independent of cycle length, and available from a
  // single entry — so it is reported even when no cycle average exists.
  const durations = sorted
    .filter((e) => e.endDate && !Number.isNaN(new Date(e.endDate).getTime()))
    .map((e) => daysBetween(e.startDate, e.endDate) + 1)
    .filter((d) => d >= 1 && d <= 14);

  const averagePeriodDays = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  const lastStart = sorted[sorted.length - 1].startDate;
  const sinceLast = daysBetween(lastStart, new Date());

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const gap = daysBetween(sorted[i - 1].startDate, sorted[i].startDate);
    if (gap >= MIN_GAP && gap <= MAX_GAP) gaps.push(gap);
  }

  // Absence is detectable from one entry, and matters more than an average.
  if (gaps.length === 0) {
    if (sinceLast >= ABSENT_DAYS) {
      return {
        ...EMPTY,
        sortedStarts,
        averagePeriodDays,
        regularity: "No Cycle",
        reason: `No period logged for ${sinceLast} days.`,
      };
    }
    return { ...EMPTY, sortedStarts, averagePeriodDays };
  }

  const average = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  const shortest = Math.min(...gaps);
  const longest = Math.max(...gaps);
  const variation = gaps.length >= 2 ? longest - shortest : null;

  const nextExpected = new Date(new Date(lastStart).getTime() + average * DAY_MS);
  const late = daysBetween(nextExpected, new Date());
  const daysLate = late > 0 ? late : null;

  let regularity: Regularity;
  let reason: string;

  if (sinceLast >= ABSENT_DAYS) {
    regularity = "No Cycle";
    reason = `No period logged for ${sinceLast} days.`;
  } else if (variation != null && variation > IRREGULAR_SPREAD) {
    regularity = "Irregular";
    reason = `Your cycles range from ${shortest} to ${longest} days — a ${variation}-day spread.`;
  } else if (average < TYPICAL_MIN || average > TYPICAL_MAX) {
    regularity = "Irregular";
    reason = `Your cycles average ${average} days, outside the usual ${TYPICAL_MIN}–${TYPICAL_MAX}.`;
  } else {
    regularity = "Regular";
    reason = `Your cycles average ${average} days and vary by ${variation ?? 0}.`;
  }

  return {
    sampleSize: gaps.length,
    average,
    variation,
    shortest,
    longest,
    averagePeriodDays,
    nextExpected,
    daysLate,
    regularity,
    reason,
    sortedStarts,
  };
}

/**
 * Days a period is known to have covered, as `YYYY-MM-DD` keys, for the
 * calendar to shade. An entry with no end date marks its start day only.
 */
export function periodDayKeys(entries: CycleEntry[]): Set<string> {
  const keys = new Set<string>();

  for (const entry of entries ?? []) {
    const start = new Date(entry.startDate);
    if (Number.isNaN(start.getTime())) continue;

    const end = entry.endDate ? new Date(entry.endDate) : start;
    const span = Number.isNaN(end.getTime()) ? 0 : daysBetween(start, end);
    // Guard against a reversed or absurd range producing an unbounded loop.
    const days = Math.min(Math.max(span, 0), 14);

    for (let i = 0; i <= days; i++) {
      keys.add(dateKey(new Date(start.getTime() + i * DAY_MS)));
    }
  }

  return keys;
}

/**
 * The window the next period is expected in, as date keys. Rendered as an
 * outline rather than a fill, because it is an estimate and should not look
 * like recorded fact.
 */
export function predictedDayKeys(
  analysis: CycleAnalysis,
  spreadDays = 2
): Set<string> {
  const keys = new Set<string>();
  if (!analysis.nextExpected) return keys;

  const centre = analysis.nextExpected.getTime();
  const duration = analysis.averagePeriodDays ?? 5;

  for (let offset = -spreadDays; offset < duration + spreadDays; offset++) {
    keys.add(dateKey(new Date(centre + offset * DAY_MS)));
  }

  return keys;
}

/** Local-time `YYYY-MM-DD`. `toISOString` would shift the day in most timezones. */
export function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
