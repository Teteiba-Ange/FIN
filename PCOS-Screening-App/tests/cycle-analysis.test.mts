/**
 * Tests for lib/cycle/analysis — the shared source of truth for what a user's
 * logged cycles mean.
 *
 * This module is read by three separate features: the cycle tracker screen,
 * the notification scheduler, and step 2 of the assessment. If they ever
 * disagree, the app tells the user three different things about the same
 * dates — so the rules live in one place and this file pins them down.
 *
 * Deliberately dependency-free. Runs on Node's built-in type stripping:
 *
 *     npm run test:logic
 *
 * A real runner (jest-expo) belongs with the rest of G-04 in phase 06; this
 * exists because the logic shipped now and shouldn't ship untested.
 */

import { analyseCycles, periodDayKeys, predictedDayKeys, dateKey } from "../lib/cycle/analysis.ts";

const DAY = 86400000;
const ago = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const e = (start: number, len = 4) => ({
  id: "x" + start, startDate: ago(start), endDate: ago(start - len), flow: "Medium" as const, notes: "",
});

let pass = 0, fail = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
  ok ? pass++ : fail++;
};

console.log("\nregularity verdicts:");
check("no entries -> no verdict", analyseCycles([]).regularity, null);
check("one entry -> no verdict", analyseCycles([e(5)]).regularity, null);
check("28/28 -> Regular", analyseCycles([e(61),e(33),e(5)]).regularity, "Regular");
check("24/41/26 spread -> Irregular", analyseCycles([e(91),e(67),e(26),e(0)]).regularity, "Irregular");
check("avg 45d -> Irregular", analyseCycles([e(90),e(45),e(0)]).regularity, "Irregular");
check("none for 120d -> No Cycle", analyseCycles([e(148),e(120)]).regularity, "No Cycle");

console.log("\naverages:");
check("28d average", analyseCycles([e(33),e(5)]).average, 28);
check("period duration", analyseCycles([e(33,4),e(5,4)]).averagePeriodDays, 5);
check("sample size = gaps not entries", analyseCycles([e(61),e(33),e(5)]).sampleSize, 2);

console.log("\ngarbage input:");
check("duplicate dates ignored", analyseCycles([e(30),e(30),e(2)]).average, 28);
check("400d gap excluded", analyseCycles([e(400),e(3)]).average, null);
check("malformed date survives", analyseCycles([{id:"b",startDate:"not-a-date",endDate:"",flow:"Medium",notes:""} as any]).regularity, null);
check("reversed end date clamped", analyseCycles([{id:"c",startDate:ago(5),endDate:ago(30),flow:"Medium",notes:""} as any]).averagePeriodDays, null);

console.log("\nlateness:");
check("not late", analyseCycles([e(33),e(5)]).daysLate, null);
check("late by ~7d", analyseCycles([e(63),e(35)]).daysLate, 7);

console.log("\ncalendar keys:");
const days = periodDayKeys([{id:"d",startDate:"2026-03-01T00:00:00Z",endDate:"2026-03-04T00:00:00Z",flow:"Medium",notes:""} as any]);
check("4-day period -> 4 keys", days.size, 4);
const runaway = periodDayKeys([{id:"e",startDate:"2026-01-01T00:00:00Z",endDate:"2027-01-01T00:00:00Z",flow:"Medium",notes:""} as any]);
check("year-long entry clamped to 15", runaway.size, 15);
check("prediction window non-empty", predictedDayKeys(analyseCycles([e(33),e(5)])).size > 0, true);
check("no prediction -> no keys", predictedDayKeys(analyseCycles([])).size, 0);

console.log("\nlocal-date key (not UTC-shifted):");
const late = new Date(2026, 2, 15, 23, 30);
check("11:30pm stays on the 15th", dateKey(late), "2026-03-15");

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
