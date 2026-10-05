const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const sqlite3 = require("sqlite3").verbose();

const SQLITE_DB_PATH = path.resolve(__dirname, "../../data/pcos.sqlite");

function convertPlaceholders(query) {
  let i = 0;
  return query.replace(/\?/g, () => `$${++i}`);
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
const usePostgres = Boolean(connectionString);

if (!usePostgres) {
  console.warn("[WARN] No DATABASE_URL provided. Using SQLite for local development.");
}

/**
 * Whether to negotiate TLS.
 *
 * Previously this was keyed on `NODE_ENV === "production"`, which breaks
 * against Neon: Neon requires TLS on every connection, so a development run
 * pointed at it failed with "The server does not support SSL connections" —
 * a confusing error for what is really a config mismatch.
 *
 * TLS is now the default for any remote host, and only skipped where it
 * genuinely does not apply: an explicit `sslmode=disable`, or a local server.
 */
function resolveSsl(url) {
  if (!url) return false;
  if (/sslmode=disable/i.test(url)) return false;
  if (/@(localhost|127\.0\.0\.1|\[::1\])[:/]/i.test(url)) return false;

  // Managed Postgres (Neon, Supabase, Render, Heroku) terminates TLS at a
  // proxy whose certificate chain the Node client cannot verify by default.
  // This encrypts the connection without asserting the chain.
  return { rejectUnauthorized: false };
}

let pool = null;
let sqliteDb = null;

if (usePostgres) {
  const isNeon = /neon\.tech/i.test(connectionString);

  pool = new Pool({
    connectionString,
    ssl: resolveSsl(connectionString),
    // Neon closes idle connections on its side and, on the free tier, spins
    // the compute down entirely. A large pool of half-dead sockets is worse
    // than a small one that reconnects, and the first query after a scale-to-
    // zero needs long enough to wake it.
    max: isNeon ? 10 : 20,
    idleTimeoutMillis: isNeon ? 20_000 : 30_000,
    connectionTimeoutMillis: isNeon ? 15_000 : 5_000,
    // Keeps a dropped socket from hanging a request indefinitely.
    keepAlive: true,
  });

  // A pool error with no listener is an uncaught exception that takes the
  // process down — which is how an idle-connection reset becomes an outage.
  pool.on("error", (err) => {
    console.error("[DB] Idle client error (pool will recover):", err.message);
  });

  console.log(
    `[DB] PostgreSQL${isNeon ? " (Neon)" : ""}, TLS ${resolveSsl(connectionString) ? "on" : "off"}`
  );
} else {
  const dataDir = path.dirname(SQLITE_DB_PATH);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  sqliteDb = new sqlite3.Database(
    SQLITE_DB_PATH,
    sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
    (err) => {
      if (err) { console.error("[FATAL] SQLite open failed:", err); process.exit(1); }
    }
  );
}

const executeSqlite = (query, params = []) =>
  new Promise((resolve, reject) => {
    sqliteDb.run(query, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const getSqlite = (query, params = []) =>
  new Promise((resolve, reject) =>
    sqliteDb.get(query, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

const allSqlite = (query, params = []) =>
  new Promise((resolve, reject) =>
    sqliteDb.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

// ─── Safe ALTER helper — ignores "duplicate column" errors ───────────────────
const safeAlter = async (sql) => {
  try {
    await executeSqlite(sql);
  } catch (e) {
    if (!e.message?.includes("duplicate column")) {
      console.warn("[MIGRATION] ALTER warning:", e.message);
    }
  }
};

const initializeDatabase = async () => {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id              TEXT PRIMARY KEY,
          email           TEXT UNIQUE NOT NULL,
          password        TEXT NOT NULL,
          fullName        TEXT,
          age             INTEGER,
          weight          REAL,
          height          REAL,
          profilePicture  TEXT DEFAULT NULL,
          pushToken       TEXT DEFAULT NULL,
          notifSymptom    INTEGER DEFAULT 1,
          notifCycle      INTEGER DEFAULT 1,
          notifWellness   INTEGER DEFAULT 0,
          notifCommunity  INTEGER DEFAULT 1,
          createdAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Add new columns to existing PostgreSQL databases safely
      const pgAlters = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS profilePicture TEXT DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS pushToken TEXT DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifSymptom INTEGER DEFAULT 1",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifCycle INTEGER DEFAULT 1",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifWellness INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS notifCommunity INTEGER DEFAULT 1",
      ];
      for (const sql of pgAlters) {
        await client.query(sql).catch(() => {});
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS symptoms (
          id                 TEXT PRIMARY KEY,
          userId             TEXT NOT NULL,
          cycleRegularity    TEXT,
          avgCycleLength     INTEGER,
          lastPeriod         TEXT,
          symptoms           TEXT,
          exerciseHabit      TEXT,
          fastFoodFrequency  TEXT,
          maritalStatus      TEXT,
          familyHistory      TEXT,
          medicalBackground  TEXT,
          medicalTags        TEXT,
          recordedDate       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id          TEXT PRIMARY KEY,
          userId      TEXT NOT NULL,
          fileName    TEXT NOT NULL,
          fileUrl     TEXT NOT NULL,
          uploadedAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id         TEXT PRIMARY KEY,
          userId     TEXT NOT NULL,
          username   TEXT,
          content    TEXT NOT NULL,
          anonymous  INTEGER DEFAULT 0,
          likes      INTEGER DEFAULT 0,
          createdAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id         TEXT PRIMARY KEY,
          postId     TEXT NOT NULL,
          userId     TEXT NOT NULL,
          username   TEXT,
          text       TEXT NOT NULL,
          anonymous  INTEGER DEFAULT 0,
          createdAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(postId) REFERENCES posts(id),
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS predictions (
          id          TEXT PRIMARY KEY,
          userId      TEXT NOT NULL,
          score       REAL,
          riskLevel   TEXT,
          topFeatures TEXT,
          predictedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      // A-04 — `CREATE TABLE IF NOT EXISTS` is a no-op on an existing database,
      // so the column above never reaches one that already has the table.
      // Postgres supports IF NOT EXISTS on ADD COLUMN, so this is idempotent.
      await client.query(
        `ALTER TABLE predictions ADD COLUMN IF NOT EXISTS topFeatures TEXT`
      );

      await client.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id          TEXT PRIMARY KEY,
          userId      TEXT NOT NULL,
          token_hash  TEXT NOT NULL,
          createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expiresAt   TIMESTAMP,
          revoked     BOOLEAN DEFAULT FALSE,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      // ── Daily logs (A-02) ───────────────────────────────────────────────────
      // Distinct from the `symptoms` table, which holds the assessment
      // snapshot. These are the day-to-day entries that previously lived only
      // in AsyncStorage on the handset and died with the install.
      //
      // `id` is generated by the client so a retried sync is idempotent — the
      // upsert below is what makes the write-ahead queue safe to replay.
      await client.query(`
        CREATE TABLE IF NOT EXISTS symptom_logs (
          id         TEXT PRIMARY KEY,
          userId     TEXT NOT NULL,
          symptom    TEXT NOT NULL,
          severity   INTEGER,
          notes      TEXT,
          loggedAt   TIMESTAMP NOT NULL,
          createdAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS cycle_entries (
          id         TEXT PRIMARY KEY,
          userId     TEXT NOT NULL,
          startDate  TIMESTAMP NOT NULL,
          endDate    TIMESTAMP,
          flow       TEXT,
          notes      TEXT,
          createdAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS mood_entries (
          id         TEXT PRIMARY KEY,
          userId     TEXT NOT NULL,
          mood       INTEGER NOT NULL,
          notes      TEXT,
          loggedAt   TIMESTAMP NOT NULL,
          createdAt  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      // History reads are always "this user, newest first".
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_symptom_logs_user ON symptom_logs (userId, loggedAt DESC)`
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_cycle_entries_user ON cycle_entries (userId, startDate DESC)`
      );
      await client.query(
        `CREATE INDEX IF NOT EXISTS idx_mood_entries_user ON mood_entries (userId, loggedAt DESC)`
      );

      console.log("✅ PostgreSQL tables initialized");
    } finally {
      client.release();
    }
  } else {
    // ── SQLite ────────────────────────────────────────────────────────────────
    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS users (
        id              TEXT PRIMARY KEY,
        email           TEXT UNIQUE NOT NULL,
        password        TEXT NOT NULL,
        fullName        TEXT,
        age             INTEGER,
        weight          REAL,
        height          REAL,
        profilePicture  TEXT DEFAULT NULL,
        pushToken       TEXT DEFAULT NULL,
        notifSymptom    INTEGER DEFAULT 1,
        notifCycle      INTEGER DEFAULT 1,
        notifWellness   INTEGER DEFAULT 0,
        notifCommunity  INTEGER DEFAULT 1,
        createdAt       TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt       TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Safely add new columns to existing database (won't fail if they exist)
    await safeAlter("ALTER TABLE users ADD COLUMN profilePicture TEXT DEFAULT NULL");
    await safeAlter("ALTER TABLE users ADD COLUMN pushToken TEXT DEFAULT NULL");
    await safeAlter("ALTER TABLE users ADD COLUMN notifSymptom INTEGER DEFAULT 1");
    await safeAlter("ALTER TABLE users ADD COLUMN notifCycle INTEGER DEFAULT 1");
    await safeAlter("ALTER TABLE users ADD COLUMN notifWellness INTEGER DEFAULT 0");
    await safeAlter("ALTER TABLE users ADD COLUMN notifCommunity INTEGER DEFAULT 1");

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS symptoms (
        id                 TEXT PRIMARY KEY,
        userId             TEXT NOT NULL,
        cycleRegularity    TEXT,
        avgCycleLength     INTEGER,
        lastPeriod         TEXT,
        symptoms           TEXT,
        exerciseHabit      TEXT,
        fastFoodFrequency  TEXT,
        maritalStatus      TEXT,
        familyHistory      TEXT,
        medicalBackground  TEXT,
        medicalTags        TEXT,
        recordedDate       TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS reports (
        id          TEXT PRIMARY KEY,
        userId      TEXT NOT NULL,
        fileName    TEXT NOT NULL,
        fileUrl     TEXT NOT NULL,
        uploadedAt  TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS posts (
        id         TEXT PRIMARY KEY,
        userId     TEXT NOT NULL,
        username   TEXT,
        content    TEXT NOT NULL,
        anonymous  INTEGER DEFAULT 0,
        likes      INTEGER DEFAULT 0,
        createdAt  TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt  TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS comments (
        id         TEXT PRIMARY KEY,
        postId     TEXT NOT NULL,
        userId     TEXT NOT NULL,
        username   TEXT,
        text       TEXT NOT NULL,
        anonymous  INTEGER DEFAULT 0,
        createdAt  TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(postId) REFERENCES posts(id),
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS predictions (
        id          TEXT PRIMARY KEY,
        userId      TEXT NOT NULL,
        score       REAL,
        riskLevel   TEXT,
        topFeatures TEXT,
        predictedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    // A-04 — same migration for an existing SQLite file. SQLite has no
    // `ADD COLUMN IF NOT EXISTS`, so check the table info first; adding a
    // duplicate column is an error rather than a no-op.
    const predictionColumns = await allSqlite(`PRAGMA table_info(predictions)`);
    if (!predictionColumns.some((c) => c.name === "topFeatures")) {
      await executeSqlite(`ALTER TABLE predictions ADD COLUMN topFeatures TEXT`);
      console.log("[MIGRATION] Added predictions.topFeatures");
    }

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id          TEXT PRIMARY KEY,
        userId      TEXT NOT NULL,
        token_hash  TEXT NOT NULL,
        createdAt   TEXT DEFAULT CURRENT_TIMESTAMP,
        expiresAt   TEXT,
        revoked     INTEGER DEFAULT 0,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    // ── Daily logs (A-02) — see the Postgres block above for the rationale ───
    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS symptom_logs (
        id         TEXT PRIMARY KEY,
        userId     TEXT NOT NULL,
        symptom    TEXT NOT NULL,
        severity   INTEGER,
        notes      TEXT,
        loggedAt   TEXT NOT NULL,
        createdAt  TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS cycle_entries (
        id         TEXT PRIMARY KEY,
        userId     TEXT NOT NULL,
        startDate  TEXT NOT NULL,
        endDate    TEXT,
        flow       TEXT,
        notes      TEXT,
        createdAt  TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS mood_entries (
        id         TEXT PRIMARY KEY,
        userId     TEXT NOT NULL,
        mood       INTEGER NOT NULL,
        notes      TEXT,
        loggedAt   TEXT NOT NULL,
        createdAt  TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(
      `CREATE INDEX IF NOT EXISTS idx_symptom_logs_user ON symptom_logs (userId, loggedAt DESC)`
    );
    await executeSqlite(
      `CREATE INDEX IF NOT EXISTS idx_cycle_entries_user ON cycle_entries (userId, startDate DESC)`
    );
    await executeSqlite(
      `CREATE INDEX IF NOT EXISTS idx_mood_entries_user ON mood_entries (userId, loggedAt DESC)`
    );

    console.log("✅ SQLite tables initialized");
  }
};

// ─── Identifier casing ───────────────────────────────────────────────────────
/**
 * Postgres folds unquoted identifiers to lower case. A column declared as
 * `fullName` is stored as `fullname`, and `SELECT *` hands back `row.fullname`
 * — so `user.fullName` silently becomes `undefined`.
 *
 * SQLite preserves the declared case, which is why this never showed up while
 * the app ran on SQLite. Switching to Neon would have broken roughly thirty
 * reads across six controllers, mostly as blank fields and nulls rather than
 * loud errors: profile names vanishing, `predictedAt` missing from history,
 * notification toggles all reading false.
 *
 * Rather than quoting every identifier in the DDL (invasive, and easy to get
 * half-right) or rewriting each controller, every Postgres row is mapped back
 * to the declared casing here. Controllers stay engine-agnostic, and adding a
 * column means adding one entry below.
 *
 * The lower-cased keys are left in place as well, so code written either way
 * keeps working.
 */
const SCHEMA_COLUMNS = [
  // users
  "fullName", "profilePicture", "pushToken", "createdAt", "updatedAt",
  "notifSymptom", "notifCycle", "notifCommunity", "notifWellness",
  // symptoms (assessment snapshot)
  "userId", "cycleRegularity", "avgCycleLength", "lastPeriod",
  "exerciseHabit", "fastFoodFrequency", "maritalStatus", "familyHistory",
  "medicalBackground", "medicalTags", "recordedDate",
  // predictions
  "riskLevel", "topFeatures", "predictedAt",
  // daily logs
  "loggedAt", "startDate", "endDate",
  // posts, comments, reports
  "postId", "fileName", "fileUrl", "uploadedAt", "reportType",
  // refresh tokens
  "expiresAt",
];

/** lowercase -> declared casing. Built once. */
const CASE_MAP = Object.fromEntries(
  SCHEMA_COLUMNS.map((name) => [name.toLowerCase(), name])
);

function restoreCase(row) {
  if (!row || typeof row !== "object") return row;

  let changed = false;
  const out = {};

  for (const key of Object.keys(row)) {
    out[key] = row[key];
    const declared = CASE_MAP[key];
    // Only add the alias when the driver actually lower-cased it.
    if (declared && declared !== key && out[declared] === undefined) {
      out[declared] = row[key];
      changed = true;
    }
  }

  return changed ? out : row;
}

const run = async (query, params = []) => {
  if (usePostgres) return pool.query(convertPlaceholders(query), params);
  return executeSqlite(query, params);
};

const get = async (query, params = []) => {
  if (usePostgres) {
    const res = await pool.query(convertPlaceholders(query), params);
    return res.rows[0] ? restoreCase(res.rows[0]) : null;
  }
  return getSqlite(query, params);
};

const all = async (query, params = []) => {
  if (usePostgres) {
    const res = await pool.query(convertPlaceholders(query), params);
    return res.rows.map(restoreCase);
  }
  return allSqlite(query, params);
};

module.exports = {
  db: usePostgres ? pool : sqliteDb,
  initializeDatabase,
  run,
  get,
  all,
  /**
   * Exposed so controllers can pick the right upsert syntax — Postgres wants
   * `ON CONFLICT (id) DO UPDATE`, SQLite wants `INSERT OR REPLACE`. There is
   * no portable spelling, and the sync queue depends on the write being
   * idempotent so a retried request can't duplicate a row.
   */
  usePostgres,
};