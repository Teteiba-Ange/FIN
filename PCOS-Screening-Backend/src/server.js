const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");

dotenv.config();

const { initializeDatabase } = require("./config/database");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const symptomRoutes = require("./routes/symptoms");
const reportRoutes = require("./routes/reports");
const postRoutes = require("./routes/posts");
const predictionRoutes = require("./routes/predictions");
const logRoutes = require("./routes/logs");

const app = express();

// -----------------------------------------------------------------------------
// Rate Limiters
// -----------------------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    error: "Too many attempts. Please try again in 15 minutes.",
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

// -----------------------------------------------------------------------------
// Upload Directories
// -----------------------------------------------------------------------------
const resolveAppPath = (value) =>
  path.isAbsolute(value)
    ? value
    : path.resolve(__dirname, "..", value);

const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? resolveAppPath(process.env.UPLOAD_DIR)
  : path.resolve(__dirname, "../data/uploads");

const AVATAR_DIR = process.env.AVATAR_DIR
  ? resolveAppPath(process.env.AVATAR_DIR)
  : path.resolve(__dirname, "../data/avatars");

[UPLOAD_DIR, AVATAR_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`[INFO] Created directory: ${dir}`);
  }
});

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------
app.use(cors());

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// -----------------------------------------------------------------------------
// Static Files
// -----------------------------------------------------------------------------
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/avatars", express.static(AVATAR_DIR));

// -----------------------------------------------------------------------------
// Rate Limiting
// -----------------------------------------------------------------------------
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);

app.use("/api", generalLimiter);

// -----------------------------------------------------------------------------
// Routes
// -----------------------------------------------------------------------------
const registerRoutes = () => {
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/symptoms", symptomRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/predictions", predictionRoutes);
  app.use("/api/logs", logRoutes);

  // Health Check
  app.get("/health", (req, res) => {
    res.json({
      status: "Backend is running",
      timestamp: new Date(),
      uploadDir: UPLOAD_DIR,
      avatarDir: AVATAR_DIR,
    });
  });

  // Global Error Handler
  app.use((err, req, res, next) => {
    console.error("[ERROR]", err);

    res.status(err.statusCode || 500).json({
      error: err.message || "Internal server error",
    });
  });
};

// -----------------------------------------------------------------------------
// Server Startup
// -----------------------------------------------------------------------------
const tryListen = (port) =>
  new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on("error", reject);
  });

const startServer = async () => {
  const initialPort = parseInt(process.env.PORT || "5000", 10);
  let port = Number.isNaN(initialPort) ? 5000 : initialPort;

  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await tryListen(port);

      console.log(`\n🚀 PCOS Backend running on http://localhost:${port}`);
      console.log(`📁 Uploads : ${UPLOAD_DIR}`);
      console.log(`👤 Avatars : ${AVATAR_DIR}`);

      return;
    } catch (error) {
      if (error.code === "EADDRINUSE") {
        console.warn(
          `⚠️ Port ${port} is already in use. Trying ${port + 1}...`
        );
        port++;
        continue;
      }

      console.error("[FATAL] Server failed to start:", error);
      process.exit(1);
    }
  }

  console.error(
    `[FATAL] Could not start server after ${maxAttempts} attempts.`
  );
  process.exit(1);
};

// -----------------------------------------------------------------------------
// Initialize Application
// -----------------------------------------------------------------------------
(async () => {
  try {
    await initializeDatabase();
    registerRoutes();
    await startServer();
  } catch (error) {
    console.error("[FATAL] Application failed to start:", error);
    process.exit(1);
  }
})();