// src/routes/logs.js
/**
 * Daily health logs (A-02).
 *
 * Deliberately mounted at /api/logs rather than folded into /api/symptoms —
 * that route serves the assessment snapshot, which is a different thing with
 * a different shape, and overloading it would make both harder to reason about.
 */

const express = require("express");
const {
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
} = require("../controllers/logController");
const { authMiddleware } = require("../middleware/auth");

const router = express.Router();

// Everything here is per-user health data; none of it is public.
router.use(authMiddleware);

// Bulk — used on sign-in and reinstall to rebuild the device's local cache.
router.get("/", getAllLogs);

// Drains the client's write-ahead queue in one round trip.
router.post("/sync", syncBatch);

router.get("/symptoms", getSymptomLogs);
router.post("/symptoms", saveSymptomLog);
router.delete("/symptoms/:id", deleteSymptomLog);

router.get("/cycles", getCycleEntries);
router.post("/cycles", saveCycleEntry);
router.delete("/cycles/:id", deleteCycleEntry);

router.get("/moods", getMoodEntries);
router.post("/moods", saveMoodEntry);
router.delete("/moods/:id", deleteMoodEntry);

module.exports = router;
