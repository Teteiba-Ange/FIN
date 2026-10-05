// src/controllers/accountController.js
/**
 * Data export and account deletion (G-06).
 *
 * Both app stores require an in-app account deletion path for any app with
 * accounts, and this one holds menstrual history, symptoms, medications and
 * family medical history. Neither existed.
 *
 * Two decisions worth stating:
 *
 *   Deletion is real, not a flag. A "deleted" account that still holds the
 *   rows is not deletion, and for health data the difference is the whole
 *   point. Every table is cleared and the user row goes with it.
 *
 *   Deletion requires the current password. The access token alone is not
 *   enough — a borrowed unlocked phone should not be able to destroy someone's
 *   medical history in two taps.
 */

const bcrypt = require("bcryptjs");
const { run, get, all } = require("../config/database");
const { decrypt } = require("../utils/fieldCrypto");

/** Tables holding rows keyed by userId, cleared on deletion. */
const USER_TABLES = [
  "symptom_logs",
  "cycle_entries",
  "mood_entries",
  "symptoms",
  "predictions",
  "reports",
  "comments",
  "posts",
  "refresh_tokens",
];

const decryptSafe = (value) => {
  try {
    return decrypt(value);
  } catch {
    return "";
  }
};

const safeJSON = (value, fallback = []) => {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

/**
 * Everything held about the requesting user, as one JSON document.
 *
 * Decrypted, because an export the user cannot read is not an export. It goes
 * only to the authenticated owner over their own session.
 */
const exportData = async (req, res) => {
  try {
    const user = await get(
      "SELECT id, email, fullName, age, weight, height, createdAt FROM users WHERE id = ?",
      [req.userId]
    );
    if (!user) return res.status(404).json({ error: "Account not found" });

    const [symptomLogs, cycles, moods, assessments, predictions, posts, comments] =
      await Promise.all([
        all("SELECT * FROM symptom_logs WHERE userId = ? ORDER BY loggedAt DESC", [req.userId]),
        all("SELECT * FROM cycle_entries WHERE userId = ? ORDER BY startDate DESC", [req.userId]),
        all("SELECT * FROM mood_entries WHERE userId = ? ORDER BY loggedAt DESC", [req.userId]),
        all("SELECT * FROM symptoms WHERE userId = ?", [req.userId]),
        all("SELECT * FROM predictions WHERE userId = ? ORDER BY predictedAt DESC", [req.userId]),
        all("SELECT * FROM posts WHERE userId = ?", [req.userId]),
        all("SELECT * FROM comments WHERE userId = ?", [req.userId]),
      ]);

    res.json({
      exportedAt: new Date().toISOString(),
      format: "pcos-screening-export/1",
      account: {
        email: user.email,
        fullName: user.fullName,
        age: user.age,
        weight: user.weight,
        height: user.height,
        joined: user.createdAt ?? user.createdat ?? null,
      },
      symptomLogs: symptomLogs.map((r) => ({
        symptom: r.symptom,
        severity: r.severity,
        notes: decryptSafe(r.notes),
        date: r.loggedAt ?? r.loggedat,
      })),
      cycles: cycles.map((r) => ({
        startDate: r.startDate ?? r.startdate,
        endDate: r.endDate ?? r.enddate,
        flow: r.flow,
        notes: decryptSafe(r.notes),
      })),
      moods: moods.map((r) => ({
        mood: r.mood,
        notes: decryptSafe(r.notes),
        date: r.loggedAt ?? r.loggedat,
      })),
      assessments: assessments.map((r) => ({
        cycleRegularity: r.cycleRegularity ?? r.cycleregularity,
        avgCycleLength: r.avgCycleLength ?? r.avgcyclelength,
        symptoms: safeJSON(decryptSafe(r.symptoms)),
        familyHistory: safeJSON(r.familyHistory ?? r.familyhistory),
        exerciseHabit: r.exerciseHabit ?? r.exercisehabit,
        fastFoodFrequency: r.fastFoodFrequency ?? r.fastfoodfrequency,
        recordedAt: r.recordedDate ?? r.recordeddate,
      })),
      riskAssessments: predictions.map((r) => ({
        score: r.score,
        riskLevel: r.riskLevel ?? r.risklevel,
        influences: safeJSON(r.topFeatures ?? r.topfeatures),
        date: r.predictedAt ?? r.predictedat,
      })),
      communityPosts: posts.map((r) => ({
        content: r.content,
        anonymous: Boolean(r.anonymous),
        date: r.createdAt ?? r.createdat,
      })),
      communityComments: comments.map((r) => ({
        text: r.text,
        anonymous: Boolean(r.anonymous),
        date: r.createdAt ?? r.createdat,
      })),
    });
  } catch (error) {
    console.error("[ERROR] exportData:", error);
    res.status(500).json({ error: "Could not build your export" });
  }
};

/**
 * Permanently deletes the account and everything attached to it.
 *
 * Not reversible and not a soft flag. Requires the current password, so a
 * stolen session cannot trigger it.
 */
const deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: "Your password is required to delete your account" });
    }

    const user = await get("SELECT id, password FROM users WHERE id = ?", [req.userId]);
    if (!user) return res.status(404).json({ error: "Account not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "That password isn't right" });
    }

    // Children first — the users row is referenced by every one of these, and
    // dropping it first would orphan rows on engines not enforcing the keys.
    for (const table of USER_TABLES) {
      try {
        await run(`DELETE FROM ${table} WHERE userId = ?`, [req.userId]);
      } catch (error) {
        // A table that doesn't exist on this deployment must not abort the
        // deletion — the user asked for their data gone, and partial failure
        // on an optional table is not a reason to keep the rest.
        console.warn(`[DELETE] Skipped ${table}: ${error.message}`);
      }
    }

    await run("DELETE FROM users WHERE id = ?", [req.userId]);

    // No email or name — the whole point was to stop holding those.
    console.log(`[ACCOUNT] Deleted user ${req.userId} and all associated records`);

    res.json({ success: true, message: "Your account and all your data have been deleted" });
  } catch (error) {
    console.error("[ERROR] deleteAccount:", error);
    res.status(500).json({ error: "Could not delete your account" });
  }
};

module.exports = { exportData, deleteAccount };
