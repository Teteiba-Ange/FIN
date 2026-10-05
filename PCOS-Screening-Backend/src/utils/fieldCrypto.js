// src/utils/fieldCrypto.js
/**
 * Field-level encryption for sensitive health values (AES-256-GCM).
 *
 * This consolidates two previous implementations:
 *
 *   - `src/encrypt.js` read `FIELD_ENCRYPTION_KEY` at module load and passed
 *     it straight to `Buffer.from(key, "hex")`. With the variable unset that
 *     throws on import, so the file could only ever be required if the key was
 *     already configured. Nothing imported it.
 *   - `src/controllers/symptomController.js` carried a safer copy inline,
 *     which is the one this is based on.
 *
 * Behaviour:
 *   - In production, a missing or malformed key is fatal. Silently storing
 *     health data in plaintext because an env var was forgotten is the worst
 *     of the available outcomes.
 *   - In development it warns once and passes values through, so the project
 *     runs on a fresh clone without setup.
 *   - `decrypt` returns non-encrypted input unchanged, so rows written before
 *     a key was configured still read correctly.
 *
 * Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH_HEX = 64; // 32 bytes

let warned = false;

function getKey() {
  const hex = process.env.FIELD_ENCRYPTION_KEY;

  if (!hex || hex.length !== KEY_LENGTH_HEX || !/^[0-9a-fA-F]+$/.test(hex)) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "[FATAL] FIELD_ENCRYPTION_KEY is missing or invalid. Generate one with: " +
          'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    if (!warned) {
      warned = true;
      console.warn(
        "[WARN] FIELD_ENCRYPTION_KEY not set — health fields will be stored " +
          "UNENCRYPTED. This is allowed in development only."
      );
    }
    return null;
  }

  return Buffer.from(hex, "hex");
}

/** Output format: `<iv>:<authTag>:<ciphertext>`, all hex. */
function encrypt(value) {
  const key = getKey();
  const text = String(value ?? "");
  if (!key) return text;

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);

  return [
    iv.toString("hex"),
    cipher.getAuthTag().toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

function decrypt(stored) {
  if (stored == null || stored === "") return "";

  const parts = String(stored).split(":");
  // Not in the encrypted shape — a legacy plaintext row. Return it as-is.
  if (parts.length !== 3) return String(stored);

  const key = getKey();
  if (!key) return String(stored);

  try {
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivHex, "hex")
    );
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    // Key rotation or corruption. Returning the raw value beats throwing on a
    // read path that would otherwise take down the whole history endpoint.
    console.error("[ERROR] fieldCrypto.decrypt failed:", error.message);
    return String(stored);
  }
}

module.exports = { encrypt, decrypt };
