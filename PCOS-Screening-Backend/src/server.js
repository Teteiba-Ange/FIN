const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");

dotenv.config();

const { initializeDatabase } = require("./config/database");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const symptomRoutes = require("./routes/symptoms");
const reportRoutes = require("./routes/reports");
const postRoutes = require("./routes/posts");
const predictionRoutes = require("./routes/predictions");

const app = express();

// --- Ensure upload directories exist -----------------------------------------
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

// --- Middleware ---------------------------------------------------------------
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// --- Static file serving ------------------------------------------------------
app.use("/uploads", express.static(UPLOAD_DIR));
app.use("/avatars", express.static(AVATAR_DIR));

// --- Database and route registration -------------------------------------------
const registerRoutes = () => {
  app.use("/api/auth", authRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/symptoms", symptomRoutes);
  app.use("/api/reports", reportRoutes);
  app.use("/api/posts", postRoutes);
  app.use("/api/predictions", predictionRoutes);

  // --- Health check ---------------------------------------------------------
  app.get("/health", (req, res) => {
    res.json({
      status: "Backend is running",
      timestamp: new Date(),
      uploadDir: UPLOAD_DIR,
      avatarDir: AVATAR_DIR,
    });
  });

  // --- Global error handler -------------------------------------------------
  app.use((err, req, res, next) => {
    console.error("[ERROR]", err);
    res.status(err.statusCode || 500).json({
      error: err.message || "Internal server error",
    });
  });
};

const tryListen = (port) =>
  new Promise((resolve, reject) => {
    const server = app.listen(port, () => resolve(server));
    server.on("error", (err) => reject(err));
  });

const startServer = async () => {
  const initialPort = parseInt(process.env.PORT || "5000", 10);
  let port = Number.isNaN(initialPort) ? 5000 : initialPort;
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      await tryListen(port);
      console.log(`\n?? PCOS Backend running on http://localhost:${port}`);
      console.log(`?? Uploads:  ${UPLOAD_DIR}`);
      console.log(`???  Avatars:  ${AVATAR_DIR}`);
      return;
    } catch (error) {
      if (error && error.code === "EADDRINUSE") {
        console.warn(`?? Port ${port} is already in use. Trying port ${port + 1}...`);
        port += 1;
        continue;
      }
      console.error("[FATAL] Server failed to start:", error);
      process.exit(1);
    }
  }

  console.error(`[FATAL] Could not start server after ${maxAttempts} attempts.`);
  process.exit(1);
};

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
