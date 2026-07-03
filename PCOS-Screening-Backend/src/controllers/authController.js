const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const { get, run } = require("../config/database");
const { generateToken } = require("../utils/helpers");
const fs = require("fs");
const path = require("path");

// ===== LOGGING UTILITY =====
const LOG_DIR = path.join(__dirname, "../../logs");
const LOG_FILE = path.join(LOG_DIR, "auth.log");

// Create logs directory if it doesn't exist
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const logAuthEvent = (action, data) => {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] ${action}: ${JSON.stringify(data)}`;
  
  // Console log with colors
  console.log(`\n${"=".repeat(60)}`);
  console.log(`📝 AUTH LOG - ${action.toUpperCase()}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`Time: ${timestamp}`);
  console.log(`Email: ${data.email}`);
  console.log(`Full Name: ${data.fullName || "N/A"}`);
  console.log(`Status: ${data.status || "Processing"}`);
  if (data.userId) console.log(`User ID: ${data.userId}`);
  if (data.error) console.log(`Error: ${data.error}`);
  console.log(`${"=".repeat(60)}\n`);
  
  // Write to file
  fs.appendFileSync(LOG_FILE, message + "\n");
};

// ===== AUTH CONTROLLERS =====
const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10) || 12;

const signup = async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password || !fullName) {
      logAuthEvent("SIGNUP_FAILED", {
        email,
        fullName,
        status: "FAILED",
        error: "Missing required fields",
      });
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if user exists
    const existingUser = await get("SELECT id FROM users WHERE LOWER(email) = ?", [normalizedEmail]);
    if (existingUser) {
      logAuthEvent("SIGNUP_FAILED", {
        email: normalizedEmail,
        fullName,
        status: "FAILED",
        error: "Email already registered",
      });
      return res.status(409).json({ error: "Email already registered" });
    }

    // Hash password (configurable cost factor)
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const userId = uuidv4();
    await run(
      "INSERT INTO users (id, email, password, fullName) VALUES (?, ?, ?, ?)",
      [userId, normalizedEmail, hashedPassword, fullName]
    );

    // Generate access token
    const token = generateToken(userId);

    // Create refresh token (id.secret) and store hashed secret
    const refreshId = uuidv4();
    const refreshSecret = uuidv4() + uuidv4();
    const refreshToken = `${refreshId}.${refreshSecret}`;
    const refreshHash = await bcrypt.hash(refreshSecret, saltRounds);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "30", 10) * 24 * 60 * 60 * 1000)).toISOString();
    await run(
      "INSERT INTO refresh_tokens (id, userId, token_hash, expiresAt) VALUES (?, ?, ?, ?)",
      [refreshId, userId, refreshHash, expiresAt]
    );

    // Log successful signup
    logAuthEvent("SIGNUP_SUCCESS", {
      email,
      fullName,
      userId,
      status: "SUCCESS",
    });

    res.status(201).json({
      user: { id: userId, email, fullName },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error(error);
    logAuthEvent("SIGNUP_ERROR", {
      email: req.body?.email,
      fullName: req.body?.fullName,
      status: "ERROR",
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    if (!normalizedEmail || !password) {
      logAuthEvent("LOGIN_FAILED", {
        email,
        status: "FAILED",
        error: "Missing email or password",
      });
      return res.status(401).json({ error: "Missing email or password" });
    }

    // Find user
    const user = await get("SELECT * FROM users WHERE LOWER(email) = ?", [normalizedEmail]);
    if (!user) {
      logAuthEvent("LOGIN_FAILED", {
        email: normalizedEmail,
        status: "FAILED",
        error: "User not found",
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      logAuthEvent("LOGIN_FAILED", {
        email,
        fullName: user.fullName,
        status: "FAILED",
        error: "Invalid password",
      });
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Generate token
    const token = generateToken(user.id);

    // Generate and store refresh token (rotate)
    const refreshId = uuidv4();
    const refreshSecret = uuidv4() + uuidv4();
    const refreshToken = `${refreshId}.${refreshSecret}`;
    const refreshHash = await bcrypt.hash(refreshSecret, saltRounds);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "30", 10) * 24 * 60 * 60 * 1000)).toISOString();
    await run(
      "INSERT INTO refresh_tokens (id, userId, token_hash, expiresAt) VALUES (?, ?, ?, ?)",
      [refreshId, user.id, refreshHash, expiresAt]
    );

    // Log successful login
    logAuthEvent("LOGIN_SUCCESS", {
      email,
      fullName: user.fullName,
      userId: user.id,
      status: "SUCCESS",
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        age: user.age,
        weight: user.weight,
        height: user.height,
      },
      token,
      refreshToken,
    });
  } catch (error) {
    console.error(error);
    logAuthEvent("LOGIN_ERROR", {
      email: req.body?.email,
      status: "ERROR",
      error: error.message,
    });
    res.status(500).json({ error: error.message });
  }
};

const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

    const parts = refreshToken.split(".");
    if (parts.length < 2) return res.status(400).json({ error: "Invalid refresh token format" });
    const tokenId = parts[0];
    const secret = parts.slice(1).join(".");

    const row = await get("SELECT * FROM refresh_tokens WHERE id = ? AND revoked = FALSE", [tokenId]);
    if (!row) return res.status(401).json({ error: "Invalid refresh token" });

    if (row.expiresat && new Date(row.expiresat) < new Date()) {
      return res.status(401).json({ error: "Refresh token expired" });
    }

    const match = await bcrypt.compare(secret, row.token_hash);
    if (!match) return res.status(401).json({ error: "Invalid refresh token" });

    // Rotate: revoke old token and issue a new one
    await run("UPDATE refresh_tokens SET revoked = TRUE WHERE id = ?", [tokenId]);

    const newId = uuidv4();
    const newSecret = uuidv4() + uuidv4();
    const newRefreshToken = `${newId}.${newSecret}`;
    const newHash = await bcrypt.hash(newSecret, saltRounds);
    const expiresAt = new Date(Date.now() + (parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "30", 10) * 24 * 60 * 60 * 1000)).toISOString();
    await run("INSERT INTO refresh_tokens (id, userId, token_hash, expiresAt) VALUES (?, ?, ?, ?)", [newId, row.userid, newHash, expiresAt]);

    const newAccessToken = generateToken(row.userid);

    res.json({ token: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error("[ERROR] refreshToken:", error);
    res.status(500).json({ error: error.message });
  }
};

const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });
    const parts = refreshToken.split(".");
    if (parts.length < 2) return res.status(400).json({ error: "Invalid refresh token format" });
    const tokenId = parts[0];

    await run("UPDATE refresh_tokens SET revoked = TRUE WHERE id = ?", [tokenId]);

    res.json({ success: true, message: "Logged out" });
  } catch (error) {
    console.error("[ERROR] logout:", error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { signup, login, refreshToken, logout };
