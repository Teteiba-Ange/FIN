const { v4: uuidv4 } = require("uuid");
const { run, all, get } = require("../config/database");
const crypto = require("crypto");

// ─── Field-level Encryption ───────────────────────────────────────────────────
// Encrypts sensitive health fields using AES-256-GCM before storing in the DB.
// To generate your key, run once in terminal:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// Then add to your .env:
//   FIELD_ENCRYPTION_KEY=<the 64-char hex string you just generated>

const ALGORITHM = "aes-256-gcm";

/**
 * Returns the encryption key from env.
 * Falls back to a warning + null so the app still runs without the key set,
 * but will skip encryption (safe for local dev, must be set in production).
 */
const getKey = () => {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[FATAL] FIELD_ENCRYPTION_KEY is missing or invalid. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
      );
    }
    // Development fallback — logs a warning but continues
    console.warn(
      "[WARN] FIELD_ENCRYPTION_KEY not set. Symptom fields will be stored " +
      "unencrypted. Set this key before deploying to production."
    );
    return null;
  }
  return Buffer.from(hex, "hex");
};

/**
 * Encrypts a string value.
 * Output format: <iv_hex>:<authTag_hex>:<ciphertext_hex>
 * Returns the original value unchanged if no key is configured (dev mode).
 */
const encrypt = (value) => {
  const key = getKey();
  if (!key) return String(value ?? ""); // dev fallback — no encryption

  const text    = String(value ?? "");
  const iv      = crypto.randomBytes(16);
  const cipher  = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return (
    iv.toString("hex") +
    ":" +
    authTag.toString("hex") +
    ":" +
    encrypted.toString("hex")
  );
};

/**
 * Decrypts a value encrypted by encrypt().
 * Returns the raw value as-is if it is not in the encrypted format
 * (handles legacy unencrypted rows gracefully).
 */
const decrypt = (stored) => {
  if (!stored) return "";

  // Not in encrypted format — legacy unencrypted value, return as-is
  const parts = String(stored).split(":");
  if (parts.length !== 3) return stored;

  const key = getKey();
  if (!key) return stored; // dev fallback

  try {
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv        = Buffer.from(ivHex, "hex");
    const authTag   = Buffer.from(authTagHex, "hex");
    const encrypted = Buffer.from(encryptedHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]).toString("utf8");
  } catch (err) {
    // Decryption failed — could be a key mismatch or corrupted data
    console.error("[ERROR] decrypt: failed to decrypt field:", err.message);
    return stored; // return raw value rather than crashing
  }
};

// ─── Safe JSON parse helper ───────────────────────────────────────────────────
const safeJSON = (value, fallback = []) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

// ─── Decrypt and format a raw DB symptom row ─────────────────────────────────
const formatSymptomRow = (s) => ({
  ...s,
  // Decrypt the three sensitive encrypted fields
  symptoms:          safeJSON(decrypt(s.symptoms),          []),
  medicalBackground: decrypt(s.medicalBackground),
  medicalTags:       safeJSON(decrypt(s.medicalTags),       []),
  // familyHistory is not encrypted (not clinical/medical data)
  familyHistory:     safeJSON(s.familyHistory,              []),
});

// ─── Controllers ─────────────────────────────────────────────────────────────

const recordSymptoms = async (req, res) => {
  try {
    const {
      cycleRegularity,
      avgCycleLength,
      lastPeriod,
      symptoms,
      exerciseHabit,
      fastFoodFrequency,
      maritalStatus,
      familyHistory,
      medicalBackground,
      medicalTags,
    } = req.body;

    const symptomId = uuidv4();

    await run(
      `INSERT INTO symptoms 
       (id, userId, cycleRegularity, avgCycleLength, lastPeriod, symptoms, 
        exerciseHabit, fastFoodFrequency, maritalStatus, familyHistory, 
        medicalBackground, medicalTags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        symptomId,
        req.userId,
        cycleRegularity,
        avgCycleLength,
        lastPeriod,
        encrypt(JSON.stringify(symptoms || [])),     // 🔒 encrypted
        exerciseHabit,
        fastFoodFrequency,
        maritalStatus,
        JSON.stringify(familyHistory || []),          // not encrypted
        encrypt(medicalBackground || ""),             // 🔒 encrypted
        encrypt(JSON.stringify(medicalTags || [])),   // 🔒 encrypted
      ]
    );

    res.status(201).json({
      message: "Symptoms recorded successfully",
      symptomId,
    });
  } catch (error) {
    console.error("[ERROR] recordSymptoms:", error);
    res.status(500).json({ error: error.message });
  }
};

const getSymptomHistory = async (req, res) => {
  try {
    const symptoms = await all(
      "SELECT * FROM symptoms WHERE userId = ? ORDER BY recordedDate DESC",
      [req.userId]
    );

    // Decrypt the sensitive fields on the way out
    const formattedSymptoms = symptoms.map(formatSymptomRow);

    res.json(formattedSymptoms);
  } catch (error) {
    console.error("[ERROR] getSymptomHistory:", error);
    res.status(500).json({ error: error.message });
  }
};

const getLatestSymptoms = async (req, res) => {
  try {
    const symptom = await get(
      "SELECT * FROM symptoms WHERE userId = ? ORDER BY recordedDate DESC LIMIT 1",
      [req.userId]
    );

    if (!symptom) {
      return res.status(404).json({ error: "No symptoms recorded yet" });
    }

    // Decrypt the sensitive fields on the way out
    res.json(formatSymptomRow(symptom));
  } catch (error) {
    console.error("[ERROR] getLatestSymptoms:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { recordSymptoms, getSymptomHistory, getLatestSymptoms };