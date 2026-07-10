/**
 * ╔════════════════════════════════════════╗
 * ║   PMOS — SQLite Database Inspector     ║
 * ║                                        ║
 * ║  Run:  node db-inspect.js              ║
 * ║  Or:   node db-inspect.js users        ║
 * ║  Or:   node db-inspect.js predictions  ║
 * ╚════════════════════════════════════════╝
 *
 * Shows row counts and sample data for every table.
 * Place in your project ROOT (same level as package.json).
 */

"use strict";

require("dotenv").config();

const path   = require("path");
const DB_PATH = path.resolve(__dirname, "src/config/database");
const { initializeDatabase, all } = require(DB_PATH);

const TABLES = [
  "users",
  "symptoms",
  "predictions",
  "posts",
  "comments",
  "reports",
  "refresh_tokens",
];

const SENSITIVE = ["password", "token_hash"]; // hide these in output

function maskSensitive(row) {
  const out = { ...row };
  for (const key of Object.keys(out)) {
    if (SENSITIVE.includes(key.toLowerCase())) {
      out[key] = "••••••••";
    }
  }
  return out;
}

function truncate(val, max = 60) {
  const s = String(val ?? "");
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function printTable(name, rows) {
  console.log(`\n${"═".repeat(70)}`);
  console.log(`  📋  TABLE: ${name.toUpperCase()}   (${rows.length} rows)`);
  console.log("═".repeat(70));

  if (rows.length === 0) {
    console.log("  (empty)\n");
    return;
  }

  const cols   = Object.keys(maskSensitive(rows[0]));
  const sample = rows.slice(0, 5).map(maskSensitive);

  // Column widths
  const widths = cols.map((c) =>
    Math.min(
      30,
      Math.max(c.length, ...sample.map((r) => truncate(r[c], 28).length))
    )
  );

  // Header
  const header = cols.map((c, i) => c.padEnd(widths[i])).join("  │  ");
  console.log("  " + header);
  console.log("  " + widths.map((w) => "─".repeat(w)).join("──┼──"));

  // Rows
  for (const row of sample) {
    const line = cols.map((c, i) => truncate(row[c], widths[i]).padEnd(widths[i])).join("  │  ");
    console.log("  " + line);
  }

  if (rows.length > 5) {
    console.log(`\n  … and ${rows.length - 5} more rows`);
  }
  console.log();
}

async function inspect() {
  await initializeDatabase();

  const targetTable = process.argv[2]?.toLowerCase();

  const tablesToShow = targetTable
    ? TABLES.filter((t) => t === targetTable)
    : TABLES;

  if (tablesToShow.length === 0) {
    console.error(`\n❌ Unknown table: "${targetTable}". Valid tables: ${TABLES.join(", ")}\n`);
    process.exit(1);
  }

  console.log("\n╔══════════════════════════════════════════════╗");
  console.log("║       PMOS — Database Inspector              ║");
  console.log("╚══════════════════════════════════════════════╝");

  for (const table of tablesToShow) {
    try {
      const rows = await all(`SELECT * FROM ${table} ORDER BY rowid DESC`);
      printTable(table, rows);
    } catch (err) {
      console.log(`\n  ⚠️  ${table}: ${err.message}`);
    }
  }

  // Summary counts
  console.log("═".repeat(70));
  console.log("  SUMMARY");
  console.log("─".repeat(70));
  for (const table of TABLES) {
    try {
      const [row] = await all(`SELECT COUNT(*) as c FROM ${table}`);
      const count = String(row?.c ?? 0).padStart(4);
      console.log(`  ${count}  rows  →  ${table}`);
    } catch {
      console.log(`     ?  rows  →  ${table}  (table may not exist yet)`);
    }
  }
  console.log("═".repeat(70) + "\n");

  process.exit(0);
}

inspect().catch((err) => {
  console.error("❌ Inspector failed:", err);
  process.exit(1);
});
