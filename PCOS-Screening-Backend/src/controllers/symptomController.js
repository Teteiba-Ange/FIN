const { v4: uuidv4 } = require("uuid");
const { run, all, get } = require("../config/database");

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
        JSON.stringify(symptoms || []),
        exerciseHabit,
        fastFoodFrequency,
        maritalStatus,
        JSON.stringify(familyHistory || []),
        medicalBackground,
        JSON.stringify(medicalTags || []),
      ]
    );

    res.status(201).json({
      message: "Symptoms recorded successfully",
      symptomId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

const getSymptomHistory = async (req, res) => {
  try {
    const symptoms = await all(
      "SELECT * FROM symptoms WHERE userId = ? ORDER BY recordedDate DESC",
      [req.userId]
    );

    const formattedSymptoms = symptoms.map((s) => ({
      ...s,
      symptoms: JSON.parse(s.symptoms || "[]"),
      familyHistory: JSON.parse(s.familyHistory || "[]"),
      medicalTags: JSON.parse(s.medicalTags || "[]"),
    }));

    res.json(formattedSymptoms);
  } catch (error) {
    console.error(error);
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

    res.json({
      ...symptom,
      symptoms: JSON.parse(symptom.symptoms || "[]"),
      familyHistory: JSON.parse(symptom.familyHistory || "[]"),
      medicalTags: JSON.parse(symptom.medicalTags || "[]"),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { recordSymptoms, getSymptomHistory, getLatestSymptoms };
