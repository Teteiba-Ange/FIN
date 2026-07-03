const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const sqlite3 = require("sqlite3").verbose();

const SQLITE_DB_PATH = path.resolve(__dirname, "../../data/pcos.sqlite");

// Convert sqlite-style '?' placeholders to Postgres $1, $2, ...
function convertPlaceholders(query) {
  let i = 0;
  return query.replace(/\?/g, () => {
    i += 1;
    return `$${i}`;
  });
}

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || null;
const usePostgres = Boolean(connectionString);

if (!usePostgres) {
  console.warn(
    "[WARN] No DATABASE_URL or POSTGRES_URL provided. Falling back to SQLite for local development."
  );
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
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
      console.error("[FATAL] SQLite database open failed:", err);
      process.exit(1);
    }
  });
}

const executeSqlite = (query, params = []) =>
  new Promise((resolve, reject) => {
    sqliteDb.run(query, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const getSqlite = (query, params = []) =>
  new Promise((resolve, reject) => {
    sqliteDb.get(query, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const allSqlite = (query, params = []) =>
  new Promise((resolve, reject) => {
    sqliteDb.all(query, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

const initializeDatabase = async () => {
  if (usePostgres) {
    const client = await pool.connect();
    try {
      // Users table
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          fullName TEXT,
          age INTEGER,
          weight REAL,
          height REAL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Symptoms table
      await client.query(`
        CREATE TABLE IF NOT EXISTS symptoms (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          cycleRegularity TEXT,
          avgCycleLength INTEGER,
          lastPeriod TEXT,
          symptoms TEXT,
          exerciseHabit TEXT,
          fastFoodFrequency TEXT,
          maritalStatus TEXT,
          familyHistory TEXT,
          medicalBackground TEXT,
          medicalTags TEXT,
          recordedDate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      // Reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          fileName TEXT NOT NULL,
          fileUrl TEXT NOT NULL,
          uploadedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      // Posts table
      await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          username TEXT,
          content TEXT NOT NULL,
          anonymous INTEGER DEFAULT 0,
          likes INTEGER DEFAULT 0,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      // Comments table
      await client.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id TEXT PRIMARY KEY,
          postId TEXT NOT NULL,
          userId TEXT NOT NULL,
          username TEXT,
          text TEXT NOT NULL,
          anonymous INTEGER DEFAULT 0,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(postId) REFERENCES posts(id),
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      // Predictions table
      await client.query(`
        CREATE TABLE IF NOT EXISTS predictions (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          score REAL,
          riskLevel TEXT,
          predictedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      // Refresh tokens table (for refresh token rotation)
      await client.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expiresAt TIMESTAMP,
          revoked BOOLEAN DEFAULT FALSE,
          FOREIGN KEY(userId) REFERENCES users(id)
        )
      `);

      console.log("✅ PostgreSQL database tables initialized");
    } finally {
      client.release();
    }
  } else {
    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        fullName TEXT,
        age INTEGER,
        weight REAL,
        height REAL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS symptoms (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        cycleRegularity TEXT,
        avgCycleLength INTEGER,
        lastPeriod TEXT,
        symptoms TEXT,
        exerciseHabit TEXT,
        fastFoodFrequency TEXT,
        maritalStatus TEXT,
        familyHistory TEXT,
        medicalBackground TEXT,
        medicalTags TEXT,
        recordedDate TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        fileName TEXT NOT NULL,
        fileUrl TEXT NOT NULL,
        uploadedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        username TEXT,
        content TEXT NOT NULL,
        anonymous INTEGER DEFAULT 0,
        likes INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        postId TEXT NOT NULL,
        userId TEXT NOT NULL,
        username TEXT,
        text TEXT NOT NULL,
        anonymous INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(postId) REFERENCES posts(id),
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS predictions (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        score REAL,
        riskLevel TEXT,
        predictedAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    await executeSqlite(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        expiresAt TEXT,
        revoked INTEGER DEFAULT 0,
        FOREIGN KEY(userId) REFERENCES users(id)
      )
    `);

    console.log("✅ SQLite database tables initialized");
  }
};

const run = async (query, params = []) => {
  if (usePostgres) {
    const converted = convertPlaceholders(query);
    return pool.query(converted, params);
  }
  return executeSqlite(query, params);
};

const get = async (query, params = []) => {
  if (usePostgres) {
    const converted = convertPlaceholders(query);
    const res = await pool.query(converted, params);
    return res.rows[0] || null;
  }
  return getSqlite(query, params);
};

const all = async (query, params = []) => {
  if (usePostgres) {
    const converted = convertPlaceholders(query);
    const res = await pool.query(converted, params);
    return res.rows;
  }
  return allSqlite(query, params);
};

module.exports = {
  db: usePostgres ? pool : sqliteDb,
  initializeDatabase,
  run,
  get,
  all,
};
