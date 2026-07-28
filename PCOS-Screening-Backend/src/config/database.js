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

let pool = null;
let sqliteDb = null;

if (usePostgres) {
  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
  });
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
          predictedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

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
        predictedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

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

    console.log("✅ SQLite tables initialized");
  }
};

const run = async (query, params = []) => {
  if (usePostgres) return pool.query(convertPlaceholders(query), params);
  return executeSqlite(query, params);
};

const get = async (query, params = []) => {
  if (usePostgres) {
    const res = await pool.query(convertPlaceholders(query), params);
    return res.rows[0] || null;
  }
  return getSqlite(query, params);
};

const all = async (query, params = []) => {
  if (usePostgres) {
    const res = await pool.query(convertPlaceholders(query), params);
    return res.rows;
  }
  return allSqlite(query, params);
};

module.exports = { db: usePostgres ? pool : sqliteDb, initializeDatabase, run, get, all };