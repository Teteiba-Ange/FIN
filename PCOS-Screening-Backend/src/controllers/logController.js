// src/controllers/logController.js
/**
 * Daily health logs — symptoms, cycles and moods.
 *
 * A-02. These three lived only in AsyncStorage on the handset, so a reinstall
 * or a new phone erased every entry the user had ever made. They are also the
 * data that makes the rest of the app worth anything: without them on the
 * server, Trends can never plot symptoms against risk score.
 *
 * Design notes:
 *
 *   Client-generated ids. The app creates the id and the writes below are
 *   upserts keyed on it, so replaying a queued request is a no-op rather than
 *   a duplicate row. This is what lets the client retry blindly after being
 *   offline without needing a reconciliation pass.
 *
 *   Ownership is enforced in the WHERE clause of every statement, never
 *   assumed from the id. A client-supplied id is untrusted input: without the
 *   `userId = ?` guard, anyone could overwrite another user's row by guessing
 *   an id.
 *
 *   Free-text notes are encrypted at rest, matching how `symptomController`
 *   treats medical background. Structured values (severity, flow, dates) are
 *   left in the clear so they remain queryable and sortable.
 *
 *   Rows come back in a normalised camelCase shape. Postgres folds unquoted
 *   identifiers to lowercase, so selecting `*` yields `loggedat` there and
 *   `loggedAt` on SQLite — the same drift that A-05 had to paper over on the
 *   client. Normalising here means it never reaches the app at all.
 */

const { run, all, get, usePostgres } = require("../config/database");
const { encrypt, decrypt } = require("../utils/fieldCrypto");

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Reads a column regardless of the casing the driver returned it in. */
const col = (row, name) => {
  if (row[name] !== undefined) return row[name];
  const lower = name.toLowerCase();
  if (row[lower] !== undefined) return row[lower];
  return null;
};

const asIso = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

/**
 * Portable idempotent insert. Both branches update the same non-key columns,
 * so a re-sent entry that the user edited locally lands correctly rather than
 * being silently ignored.
 */
const upsert = (table, columns) => {
  const placeholders = columns.map(() => "?").join(", ");
  const list = columns.join(", ");

  if (usePostgres) {
    const updates = columns
      .filter((c) => c !== "id" && c !== "userId")
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(", ");
    return `INSERT INTO ${table} (${list}) VALUES (${placeholders})
            ON CONFLICT (id) DO UPDATE SET ${updates}`;
  }

  return `INSERT OR REPLACE INTO ${table} (${list}) VALUES (${placeholders})`;
};

/** Rejects anything that isn't a usable timestamp before it reaches the DB. */
const requireIso = (value, field) => {
  const iso = asIso(value);
  if (!iso) throw Object.assign(new Error(`${field} must be a valid date`), { status: 400 });
  return iso;
};

const requireId = (value) => {
  const id = String(value ?? "").trim();
  if (!id || id.length > 64) {
    throw Object.assign(new Error("A valid id is required"), { status: 400 });
  }
  return id;
};

const clampInt = (value, min, max, fallback = null) => {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const fail = (res, error, label) => {
  const status = error.status || 500;
  if (status === 500) console.error(`[ERROR] ${label}:`, error);
  res.status(status).json({ error: status === 500 ? "Something went wrong" : error.message });
};

// ─── Symptom logs ────────────────────────────────────────────────────────────

const formatSymptomLog = (row) => ({
  id: col(row, "id"),
  symptom: col(row, "symptom"),
  severity: col(row, "severity"),
  notes: decrypt(col(row, "notes")),
  date: asIso(col(row, "loggedAt")),
});

const saveSymptomLog = async (req, res) => {
  try {
    const { id, symptom, severity, notes, date } = req.body;

    const name = String(symptom ?? "").trim();
    if (!name) {
      return res.status(400).json({ error: "A symptom is required" });
    }

    await run(
      upsert("symptom_logs", ["id", "userId", "symptom", "severity", "notes", "loggedAt"]),
      [
        requireId(id),
        req.userId,
        name.slice(0, 120),
        clampInt(severity, 1, 5, 3),
        encrypt(String(notes ?? "").slice(0, 2000)),
        requireIso(date, "date"),
      ]
    );

    res.status(201).json({ id, synced: true });
  } catch (error) {
    fail(res, error, "saveSymptomLog");
  }
};

const getSymptomLogs = async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM symptom_logs WHERE userId = ? ORDER BY loggedAt DESC LIMIT 500",
      [req.userId]
    );
    res.json(rows.map(formatSymptomLog));
  } catch (error) {
    fail(res, error, "getSymptomLogs");
  }
};

const deleteSymptomLog = async (req, res) => {
  try {
    // `userId` in the WHERE clause is the authorisation check.
    await run("DELETE FROM symptom_logs WHERE id = ? AND userId = ?", [
      requireId(req.params.id),
      req.userId,
    ]);
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "deleteSymptomLog");
  }
};

// ─── Cycle entries ───────────────────────────────────────────────────────────

const formatCycleEntry = (row) => ({
  id: col(row, "id"),
  startDate: asIso(col(row, "startDate")),
  endDate: asIso(col(row, "endDate")),
  flow: col(row, "flow"),
  notes: decrypt(col(row, "notes")),
});

const VALID_FLOWS = new Set(["Light", "Medium", "Heavy"]);

const saveCycleEntry = async (req, res) => {
  try {
    const { id, startDate, endDate, flow, notes } = req.body;

    const start = requireIso(startDate, "startDate");
    const end = endDate ? requireIso(endDate, "endDate") : null;

    if (end && new Date(end) < new Date(start)) {
      return res.status(400).json({ error: "endDate cannot be before startDate" });
    }

    await run(
      upsert("cycle_entries", ["id", "userId", "startDate", "endDate", "flow", "notes"]),
      [
        requireId(id),
        req.userId,
        start,
        end,
        VALID_FLOWS.has(flow) ? flow : "Medium",
        encrypt(String(notes ?? "").slice(0, 2000)),
      ]
    );

    res.status(201).json({ id, synced: true });
  } catch (error) {
    fail(res, error, "saveCycleEntry");
  }
};

const getCycleEntries = async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM cycle_entries WHERE userId = ? ORDER BY startDate DESC LIMIT 500",
      [req.userId]
    );
    res.json(rows.map(formatCycleEntry));
  } catch (error) {
    fail(res, error, "getCycleEntries");
  }
};

const deleteCycleEntry = async (req, res) => {
  try {
    await run("DELETE FROM cycle_entries WHERE id = ? AND userId = ?", [
      requireId(req.params.id),
      req.userId,
    ]);
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "deleteCycleEntry");
  }
};

// ─── Mood entries ────────────────────────────────────────────────────────────

const formatMoodEntry = (row) => ({
  id: col(row, "id"),
  mood: col(row, "mood"),
  notes: decrypt(col(row, "notes")),
  date: asIso(col(row, "loggedAt")),
});

const saveMoodEntry = async (req, res) => {
  try {
    const { id, mood, notes, date } = req.body;

    const value = clampInt(mood, 1, 5);
    if (value === null) {
      return res.status(400).json({ error: "mood must be between 1 and 5" });
    }

    await run(
      upsert("mood_entries", ["id", "userId", "mood", "notes", "loggedAt"]),
      [
        requireId(id),
        req.userId,
        value,
        encrypt(String(notes ?? "").slice(0, 2000)),
        requireIso(date, "date"),
      ]
    );

    res.status(201).json({ id, synced: true });
  } catch (error) {
    fail(res, error, "saveMoodEntry");
  }
};

const getMoodEntries = async (req, res) => {
  try {
    const rows = await all(
      "SELECT * FROM mood_entries WHERE userId = ? ORDER BY loggedAt DESC LIMIT 500",
      [req.userId]
    );
    res.json(rows.map(formatMoodEntry));
  } catch (error) {
    fail(res, error, "getMoodEntries");
  }
};

const deleteMoodEntry = async (req, res) => {
  try {
    await run("DELETE FROM mood_entries WHERE id = ? AND userId = ?", [
      requireId(req.params.id),
      req.userId,
    ]);
    res.json({ success: true });
  } catch (error) {
    fail(res, error, "deleteMoodEntry");
  }
};

// ─── Batch sync ──────────────────────────────────────────────────────────────

/** Guard against a client flushing an unbounded backlog in one request. */
const MAX_BATCH = 100;

/**
 * Drains the client's write-ahead queue in one round trip.
 *
 * Each operation is reported individually: a single malformed entry from an
 * older app version must not block the rest of the queue, or the client would
 * retry the whole batch forever. The client drops what succeeded and what was
 * permanently rejected, and keeps only what failed transiently.
 */
const syncBatch = async (req, res) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({ error: "operations must be an array" });
    }
    if (operations.length > MAX_BATCH) {
      return res.status(413).json({ error: `Send at most ${MAX_BATCH} operations` });
    }

    const results = [];

    for (const op of operations) {
      const { opId, kind, action, payload } = op ?? {};
      try {
        await applyOperation(req.userId, kind, action, payload);
        results.push({ opId, status: "ok" });
      } catch (error) {
        // 4xx means the operation will never succeed — tell the client to
        // discard it. 5xx means try again later.
        const permanent = (error.status || 500) < 500;
        if (!permanent) console.error("[ERROR] syncBatch operation:", error);
        results.push({
          opId,
          status: permanent ? "rejected" : "retry",
          error: permanent ? error.message : "Temporary failure",
        });
      }
    }

    res.json({ results });
  } catch (error) {
    fail(res, error, "syncBatch");
  }
};

async function applyOperation(userId, kind, action, payload) {
  const invalid = (message) => Object.assign(new Error(message), { status: 400 });

  const tables = {
    symptom: "symptom_logs",
    cycle: "cycle_entries",
    mood: "mood_entries",
  };
  const table = tables[kind];
  if (!table) throw invalid(`Unknown kind: ${kind}`);

  if (action === "delete") {
    await run(`DELETE FROM ${table} WHERE id = ? AND userId = ?`, [
      requireId(payload?.id),
      userId,
    ]);
    return;
  }

  if (action !== "save") throw invalid(`Unknown action: ${action}`);

  // Reuse the single-item handlers by faking the express shapes, so validation
  // lives in exactly one place per kind.
  const fakeReq = { userId, body: payload, params: {} };
  const captured = {};
  const fakeRes = {
    status(code) {
      captured.code = code;
      return this;
    },
    json(body) {
      captured.body = body;
      return this;
    },
  };

  const handler = {
    symptom: saveSymptomLog,
    cycle: saveCycleEntry,
    mood: saveMoodEntry,
  }[kind];

  await handler(fakeReq, fakeRes);

  if (captured.code && captured.code >= 400) {
    throw Object.assign(new Error(captured.body?.error ?? "Rejected"), {
      status: captured.code,
    });
  }
}

/** Everything the app needs to rebuild local state after a reinstall. */
const getAllLogs = async (req, res) => {
  try {
    const [symptoms, cycles, moods] = await Promise.all([
      all("SELECT * FROM symptom_logs WHERE userId = ? ORDER BY loggedAt DESC LIMIT 500", [
        req.userId,
      ]),
      all("SELECT * FROM cycle_entries WHERE userId = ? ORDER BY startDate DESC LIMIT 500", [
        req.userId,
      ]),
      all("SELECT * FROM mood_entries WHERE userId = ? ORDER BY loggedAt DESC LIMIT 500", [
        req.userId,
      ]),
    ]);

    res.json({
      symptoms: symptoms.map(formatSymptomLog),
      cycles: cycles.map(formatCycleEntry),
      moods: moods.map(formatMoodEntry),
    });
  } catch (error) {
    fail(res, error, "getAllLogs");
  }
};

module.exports = {
  saveSymptomLog,
  getSymptomLogs,
  deleteSymptomLog,
  saveCycleEntry,
  getCycleEntries,
  deleteCycleEntry,
  saveMoodEntry,
  getMoodEntries,
  deleteMoodEntry,
  syncBatch,
  getAllLogs,
};
