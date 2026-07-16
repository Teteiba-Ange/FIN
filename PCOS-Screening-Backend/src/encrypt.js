// utils/encrypt.js
const crypto = require("crypto");

const ALGORITHM  = "aes-256-gcm";
const SECRET_KEY = Buffer.from(process.env.FIELD_ENCRYPTION_KEY, "hex");
// Generate key once: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

const encrypt = (text) => {
  const iv         = crypto.randomBytes(16);
  const cipher     = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  const encrypted  = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const authTag    = cipher.getAuthTag();
  // Store iv + authTag + encrypted as one string
  return iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted.toString("hex");
};

const decrypt = (stored) => {
  const [ivHex, authTagHex, encryptedHex] = stored.split(":");
  const iv        = Buffer.from(ivHex, "hex");
  const authTag   = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher  = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
};

module.exports = { encrypt, decrypt };