#!/usr/bin/env node
/**
 * Verifies the configured database end to end.
 *
 *     node scripts/verify-db.js
 *
 * Written for the Neon migration. Switching engines is the kind of change that
 * appears to work — the server starts, the health check passes — and then fails
 * quietly in ways that look like missing data rather than a broken query.
 *
 * The specific hazard is identifier casing. Postgres folds unquoted identifiers
 * to lower case, so a column declared `fullName` comes back as `fullname` and
 * `user.fullName` is silently `undefined`. SQLite preserves the declared case,
 * which is why nothing showed this while the app ran on SQLite. `restoreCase`
 * in config/database.js maps rows back; this script proves it actually works
 * against the live engine rather than in theory.
 *
 * Creates a throwaway user, exercises every table, then deletes it. Safe to run
 * against a database with real data in it.
 */

require("dotenv").config();

const crypto = require("crypto");
const { initializeDatabase, run, get, all, usePostgres } = require("../src/config/database");

const id = () => crypto.randomUUID();

let passed = 0;
let failed = 0;

const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  ${detail}` : ""}`);
  ok ? passed++ : failed++;
  return ok;
};

/** Columns whose declared casing must survive a round trip through the driver. */
const CASING_CHECKS = [
  ["users", "fullName"],
  ["users", "createdAt"],
  ["users", "notifSymptom"],
  ["symptom_logs", "loggedAt"],
  ["symptom_logs", "userId"],
  ["cycle_entries", "startDate"],
  ["cycle_entries", "endDate"],
  ["mood_entries", "loggedAt"],
  ["predictions", "predictedAt"],
  ["predictions", "riskLevel"],
  ["predictions", "topFeatures"],
  ["refresh_tokens", "expiresAt"],
];

const TABLES = [
  "users",
  "symptoms",
  "predictions",
  "posts",
  "comments",
  "reports",
  "refresh_tokens",
  "symptom_logs",
  "cycle_entries",
  "mood_entries",
];

async function main() {
  console.log(`\nEngine: ${usePostgres ? "PostgreSQL" : "SQLite"}`);
  if (usePostgres) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
    // Host only — never print credentials.
    const host = url.replace(/^.*@/, "").replace(/[/?].*$/, "");
    console.log(`Host:   ${host}`);
    console.log(`Neon:   ${/neon\.tech/i.test(url) ? "yes" : "no"}`);
  }

  console.log("\n── Connection and schema ──");
  await initializeDatabase();
  check("connected and initialised", true);

  for (const table of TABLES) {
    try {
      await all(`SELECT * FROM ${table} LIMIT 1`, []);
      check(`table ${table}`, true);
    } catch (error) {
      check(`table ${table}`, false, error.message);
    }
  }

  // ── Round trip ────────────────────────────────────────────────────────────
  console.log("\n── Write and read back ──");

  const userId = id();
  let created = false;

  try {
    await run(
      `INSERT INTO users (id, email, password, fullName, age, weight, height)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, `verify-${Date.now()}@example.invalid`, "x", "Casing Probe", 29, 64, 168]
    );
    created = true;
    check("insert user", true);
  } catch (error) {
    check("insert user", false, error.message);
    console.log("\nCannot continue without a user row.\n");
    process.exit(1);
  }

  const now = new Date().toISOString();

  const writes = [
    [
      "symptom_logs",
      `INSERT INTO symptom_logs (id, userId, symptom, severity, notes, loggedAt) VALUES (?, ?, ?, ?, ?, ?)`,
      [id(), userId, "Fatigue", 4, "probe", now],
    ],
    [
      "cycle_entries",
      `INSERT INTO cycle_entries (id, userId, startDate, endDate, flow, notes) VALUES (?, ?, ?, ?, ?, ?)`,
      [id(), userId, now, now, "Medium", "probe"],
    ],
    [
      "mood_entries",
      `INSERT INTO mood_entries (id, userId, mood, notes, loggedAt) VALUES (?, ?, ?, ?, ?)`,
      [id(), userId, 3, "probe", now],
    ],
    [
      "predictions",
      `INSERT INTO predictions (id, userId, score, riskLevel, topFeatures) VALUES (?, ?, ?, ?, ?)`,
      [id(), userId, 42.5, "Moderate Risk", JSON.stringify([{ feature: "BMI" }])],
    ],
    [
      "refresh_tokens",
      `INSERT INTO refresh_tokens (id, userId, token_hash, expiresAt) VALUES (?, ?, ?, ?)`,
      [id(), userId, "hash", now],
    ],
  ];

  for (const [table, sql, params] of writes) {
    try {
      await run(sql, params);
      check(`insert into ${table}`, true);
    } catch (error) {
      check(`insert into ${table}`, false, error.message);
    }
  }

  // ── Casing ────────────────────────────────────────────────────────────────
  console.log("\n── Column casing (the migration's real hazard) ──");

  for (const [table, column] of CASING_CHECKS) {
    try {
      // `users` is keyed on `id`; every other table references it as `userId`.
      const keyColumn = table === "users" ? "id" : "userId";
      const row = await get(`SELECT * FROM ${table} WHERE ${keyColumn} = ? LIMIT 1`, [userId]);
      if (!row) {
        check(`${table}.${column}`, false, "no row to read");
        continue;
      }
      const present = row[column] !== undefined;
      check(
        `${table}.${column}`,
        present,
        present ? "" : `got keys: ${Object.keys(row).slice(0, 8).join(", ")}`
      );
    } catch (error) {
      check(`${table}.${column}`, false, error.message);
    }
  }

  // ── Behaviour that differs between engines ────────────────────────────────
  console.log("\n── Engine-specific behaviour ──");

  try {
    const rows = await all("SELECT * FROM symptom_logs WHERE userId = ? ORDER BY loggedAt DESC", [userId]);
    check("ordered query", Array.isArray(rows) && rows.length > 0);
  } catch (error) {
    check("ordered query", false, error.message);
  }

  try {
    const row = await get("SELECT * FROM refresh_tokens WHERE userId = ? AND revoked = FALSE", [userId]);
    check("boolean literal (revoked = FALSE)", Boolean(row));
  } catch (error) {
    check("boolean literal (revoked = FALSE)", false, error.message);
  }

  try {
    // The upsert the sync queue depends on. Different syntax per engine — if
    // this is wrong, retried writes duplicate rows instead of updating.
    const dupId = id();
    const cols = ["id", "userId", "symptom", "severity", "notes", "loggedAt"];
    const sql = usePostgres
      ? `INSERT INTO symptom_logs (${cols.join(", ")}) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET symptom = EXCLUDED.symptom, severity = EXCLUDED.severity`
      : `INSERT OR REPLACE INTO symptom_logs (${cols.join(", ")}) VALUES (?, ?, ?, ?, ?, ?)`;

    await run(sql, [dupId, userId, "First", 1, "", now]);
    await run(sql, [dupId, userId, "Second", 5, "", now]);

    const rows = await all("SELECT * FROM symptom_logs WHERE id = ?", [dupId]);
    check(
      "idempotent upsert (replayed write)",
      rows.length === 1 && rows[0].symptom === "Second",
      `${rows.length} row(s), symptom=${rows[0]?.symptom}`
    );
  } catch (error) {
    check("idempotent upsert (replayed write)", false, error.message);
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log("\n── Cleanup ──");
  if (created) {
    for (const table of ["symptom_logs", "cycle_entries", "mood_entries", "predictions", "refresh_tokens"]) {
      await run(`DELETE FROM ${table} WHERE userId = ?`, [userId]).catch(() => {});
    }
    await run("DELETE FROM users WHERE id = ?", [userId]).catch(() => {});
    const gone = await get("SELECT id FROM users WHERE id = ?", [userId]);
    check("probe data removed", !gone);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error("\nVerification crashed:", error.message);
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED/.test(error.message)) {
    console.error("Could not reach the database. Check DATABASE_URL and your network.\n");
  } else if (/does not support SSL|self.signed|SSL/i.test(error.message)) {
    console.error("TLS negotiation failed. Neon requires sslmode=require.\n");
  } else if (/password authentication/i.test(error.message)) {
    console.error("Credentials rejected. Re-copy the connection string from Neon.\n");
  }
  process.exit(1);
});
