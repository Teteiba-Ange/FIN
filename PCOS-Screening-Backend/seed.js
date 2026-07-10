/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║           PMOS Wellness App — Database Seed Script           ║
 * ║                                                              ║
 * ║  Run with:  node seed.js                                     ║
 * ║  Place this file in the ROOT of your backend project         ║
 * ║  (same level as package.json)                                ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Tables seeded:
 *   ✅ users          — 22 realistic female profiles
 *   ✅ symptoms       — 25 symptom records (varied regularity/history)
 *   ✅ predictions    — 25 ML risk predictions (low / moderate / high)
 *   ✅ posts          — 22 community posts (named + anonymous)
 *   ✅ comments       — 30 comments across posts
 *   ✅ reports        — 20 uploaded lab report records
 *   ✅ refresh_tokens — skipped (runtime-only, not needed for demo)
 *
 * Safe to re-run: skips users that already exist (checks by email).
 */

"use strict";

require("dotenv").config(); // loads .env from project root

const { v4: uuidv4 } = require("uuid");
const bcrypt          = require("bcryptjs");
const path            = require("path");

// ── Resolve the database module from src/config/database ─────────────────────
const DB_PATH = path.resolve(__dirname, "src/config/database");
const { initializeDatabase, run, get, all } = require(DB_PATH);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const SALT_ROUNDS   = 10;
const DEMO_PASSWORD = "Demo1234!"; // All seed users share this password

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const rnd  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndN = (min, max) => +(Math.random() * (max - min) + min).toFixed(1);
const ts   = (daysAgo = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

// ─── SEED DATA ────────────────────────────────────────────────────────────────

const USERS = [
  { fullName: "Abena Mensah",      email: "abena.mensah@gmail.com",      age: 26, weight: 62, height: 163 },
  { fullName: "Efua Boateng",      email: "efua.boateng@gmail.com",       age: 29, weight: 71, height: 158 },
  { fullName: "Akosua Darko",      email: "akosua.darko@yahoo.com",       age: 23, weight: 55, height: 170 },
  { fullName: "Adwoa Asante",      email: "adwoa.asante@outlook.com",     age: 31, weight: 83, height: 162 },
  { fullName: "Ama Owusu",         email: "ama.owusu@gmail.com",          age: 27, weight: 68, height: 165 },
  { fullName: "Serwaa Amponsah",   email: "serwaa.amponsah@gmail.com",    age: 24, weight: 57, height: 168 },
  { fullName: "Yaa Ofori",         email: "yaa.ofori@hotmail.com",        age: 33, weight: 79, height: 160 },
  { fullName: "Maame Agyemang",    email: "maame.agyemang@gmail.com",     age: 28, weight: 74, height: 166 },
  { fullName: "Adjoa Koomson",     email: "adjoa.koomson@gmail.com",      age: 22, weight: 52, height: 172 },
  { fullName: "Ekua Frimpong",     email: "ekua.frimpong@yahoo.com",      age: 35, weight: 89, height: 159 },
  { fullName: "Nana Adusei",       email: "nana.adusei@gmail.com",        age: 30, weight: 66, height: 164 },
  { fullName: "Afua Bonsu",        email: "afua.bonsu@gmail.com",         age: 25, weight: 60, height: 167 },
  { fullName: "Esi Quaye",         email: "esi.quaye@outlook.com",        age: 32, weight: 77, height: 161 },
  { fullName: "Araba Antwi",       email: "araba.antwi@gmail.com",        age: 21, weight: 49, height: 173 },
  { fullName: "Baaba Mensah",      email: "baaba.mensah@gmail.com",       age: 27, weight: 64, height: 165 },
  { fullName: "Dede Asiedu",       email: "dede.asiedu@yahoo.com",        age: 34, weight: 86, height: 157 },
  { fullName: "Fosua Tetteh",      email: "fosua.tetteh@gmail.com",       age: 26, weight: 59, height: 169 },
  { fullName: "Gyamfua Opoku",     email: "gyamfua.opoku@hotmail.com",    age: 29, weight: 72, height: 162 },
  { fullName: "Hawa Dramani",      email: "hawa.dramani@gmail.com",       age: 23, weight: 56, height: 171 },
  { fullName: "Iyabo Amoah",       email: "iyabo.amoah@gmail.com",        age: 36, weight: 91, height: 156 },
  { fullName: "Juliet Sarkodie",   email: "juliet.sarkodie@gmail.com",    age: 28, weight: 67, height: 165 },
  { fullName: "Konadu Boahene",    email: "konadu.boahene@outlook.com",   age: 31, weight: 75, height: 160 },
];

const SYMPTOM_POOL = [
  "weight_gain", "hair_growth", "skin_darkening",
  "hair_loss", "acne", "fatigue", "mood_swings",
  "bloating", "sleep_issues",
];

const MEDICAL_TAGS_POOL = [
  "PMOS Diagnosed", "Insulin Resistant", "Hypothyroidism",
  "Hyperprolactinemia", "On Metformin", "On Birth Control",
  "Family History of PMOS", "Endometriosis", "Anemia",
];

const CYCLE_REGULARITIES = ["Regular", "Irregular", "Very Irregular"];
const EXERCISE_HABITS    = ["Sedentary", "Lightly Active", "Active", "Very Active"];
const FAST_FOOD_FREQS    = ["never", "rarely", "sometimes", "frequently"];
const MARITAL_STATUSES   = ["Single", "Married", "In a Relationship"];
const REPORT_TYPES       = [
  "Hormone Panel", "Glucose / Insulin", "Thyroid Panel",
  "Ultrasound Report", "Full Blood Count",
];

const POST_CONTENTS = [
  "Just got diagnosed with PMOS and I'm feeling so overwhelmed. Has anyone else felt this way at first?",
  "My doctor recommended a low-GI diet for my insulin resistance. Anyone have good Ghanaian recipe ideas that are low GI?",
  "I've been taking inositol supplements for 3 months and my cycles have become more regular! Sharing in case it helps someone 🙏",
  "Does anyone else struggle with hair loss from PMOS? It's really affecting my confidence.",
  "Just completed my second risk assessment on this app and my score dropped from 78% to 61% after lifestyle changes! Progress! 💪",
  "Looking for a PMOS-friendly gynecologist in Accra — any recommendations?",
  "The connection between stress and PMOS is so real. Since I started yoga, my symptoms have improved a lot.",
  "My LH:FSH ratio came back at 3:1. Doctor says this is consistent with PMOS. Anyone else get this result?",
  "I've been told I need to lose weight for my PMOS but it's so hard when the condition itself causes weight gain. Frustrated.",
  "Sharing my meal plan that helped me manage my symptoms — message me if you want it!",
  "Finally feeling understood after joining this community. My family kept dismissing my symptoms as 'normal women problems'.",
  "Anyone tried acupuncture for PMOS? My friend swore by it but I'm skeptical.",
  "Reminder: you are more than your diagnosis. PMOS doesn't define you 💕",
  "My ultrasound showed 14 follicles on each ovary. The radiologist confirmed PMOS morphology. Now waiting for the hormone results.",
  "Has anyone successfully gotten pregnant with PMOS? I'd love some hope right now.",
  "I was prescribed Metformin yesterday. Nervous about starting it — what were your experiences?",
  "The PCOS/PMOS name change is actually a big deal. The old name made people think it was only about cysts, which led to misdiagnosis.",
  "Daily tip I follow: drink spearmint tea twice a day. Some studies suggest it reduces androgens. It's helped with my facial hair.",
  "Warning: not all 'PMOS supplements' you see online are evidence-based. Please check with your doctor before buying anything!",
  "Just want to say this app has genuinely helped me track my symptoms and understand my body better. Thank you to the team! ❤️",
  "Anyone else notice their symptoms get worse around exam/work stress periods? My cycles completely stopped during finals.",
  "For those newly diagnosed — it gets better. It took me a year to find the right treatment plan, but I'm in a much better place now.",
];

const COMMENT_POOL = [
  "Thank you for sharing this! I felt exactly the same way.",
  "I've been through this too. You are not alone 💕",
  "This really helped me understand my situation better.",
  "Have you tried speaking to an endocrinologist? They were so helpful for me.",
  "Same here! The low-GI diet made a huge difference for me.",
  "Sending you strength. It's a tough journey but you've got this.",
  "I asked my doctor about this and she confirmed it's very common with PMOS.",
  "This is such important information, thank you for posting!",
  "I recommend Dr. Asante at the PMOS clinic — she's brilliant.",
  "Metformin was a game changer for me. Side effects ease after 2 weeks.",
  "Yes! Spearmint tea is backed by research. Keep it up!",
  "My score also dropped after I started exercising 3x a week. Stay consistent!",
  "Please don't be discouraged. Many women with PMOS have healthy pregnancies.",
  "The name change is long overdue. It'll help so many women get properly diagnosed.",
  "Inositol is amazing — myo-inositol specifically. Combined with D-chiro-inositol works best.",
  "I cried reading this. I thought I was alone. Thank you 🙏",
  "Low-GI Ghanaian foods: brown rice, beans stew, plantain in small amounts, oats. Avoid white rice often.",
  "Yoga really helped my stress levels and surprisingly my cycle became more predictable.",
  "Acupuncture helped me! I did 8 sessions over 2 months.",
  "Your progress is inspiring! What lifestyle changes did you make?",
  "Same situation. My doctor said the ratio suggests my body isn't ovulating regularly.",
  "The weight gain cycle is so frustrating. Have you been referred to a dietitian?",
  "So proud of you for tracking your progress. Keep going!",
  "This should be pinned at the top. So well said.",
  "I've been using this app for 4 months. Totally changed how I understand my cycle.",
  "Hope and strength to you. You're asking the right questions.",
  "That's great progress! Lifestyle changes really do work.",
  "Confirmed — Metformin side effects are mostly GI and settle down quickly.",
  "Always verify supplements with your healthcare provider first. Great reminder!",
  "You've come so far! Sharing your experience helps so many of us.",
];

const RISK_LEVELS = [
  { level: "Low",      scoreMin: 10, scoreMax: 34, color: "#22c55e",
    desc: "Your symptoms suggest a low likelihood of PMOS. Maintain a healthy lifestyle." },
  { level: "Moderate", scoreMin: 35, scoreMax: 64, color: "#f59e0b",
    desc: "Some PMOS indicators are present. Consider consulting a gynecologist." },
  { level: "High",     scoreMin: 65, scoreMax: 92, color: "#ef4444",
    desc: "Several PMOS risk factors identified. Please seek medical evaluation promptly." },
];

// ─── MAIN SEEDER ──────────────────────────────────────────────────────────────
async function seed() {
  console.log("\n╔══════════════════════════════════════════════════╗");
  console.log("║        PMOS App — Database Seeder Starting       ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // Init tables (creates them if they don't exist yet)
  await initializeDatabase();
  console.log("✅ Database tables ready\n");

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // ── 1. USERS ──────────────────────────────────────────────────────────────
  console.log("👤 Seeding users...");
  const userIds = [];

  for (const u of USERS) {
    // Check if already exists
    const existing = await get("SELECT id FROM users WHERE LOWER(email) = ?", [u.email.toLowerCase()]);
    if (existing) {
      console.log(`   ⏭  Skipped (exists): ${u.email}`);
      userIds.push(existing.id);
      continue;
    }

    const id = uuidv4();
    await run(
      "INSERT INTO users (id, email, password, fullName, age, weight, height) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, u.email.toLowerCase(), hashedPassword, u.fullName, u.age, u.weight, u.height]
    );
    userIds.push(id);
    console.log(`   ✅ Created: ${u.fullName} <${u.email}>`);
  }
  console.log(`\n   Total users in seed: ${userIds.length}\n`);

  // ── 2. SYMPTOMS ───────────────────────────────────────────────────────────
  console.log("🩺 Seeding symptoms...");
  let symptomCount = 0;

  for (let i = 0; i < 25; i++) {
    const userId       = rnd(userIds);
    const numSymptoms  = Math.floor(Math.random() * 5) + 1;
    const chosenSymps  = [...SYMPTOM_POOL].sort(() => 0.5 - Math.random()).slice(0, numSymptoms);
    const numTags      = Math.floor(Math.random() * 3);
    const chosenTags   = [...MEDICAL_TAGS_POOL].sort(() => 0.5 - Math.random()).slice(0, numTags);
    const daysAgo      = Math.floor(Math.random() * 120);
    const lastPeriod   = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const id = uuidv4();
    await run(
      `INSERT INTO symptoms
         (id, userId, cycleRegularity, avgCycleLength, lastPeriod, symptoms,
          exerciseHabit, fastFoodFrequency, maritalStatus, familyHistory,
          medicalBackground, medicalTags, recordedDate)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        rnd(CYCLE_REGULARITIES),
        Math.floor(rndN(25, 40)),
        lastPeriod,
        JSON.stringify(chosenSymps),
        rnd(EXERCISE_HABITS),
        rnd(FAST_FOOD_FREQS),
        rnd(MARITAL_STATUSES),
        JSON.stringify(Math.random() > 0.5 ? ["Mother has PMOS"] : []),
        "Recorded during routine PMOS screening assessment.",
        JSON.stringify(chosenTags),
        ts(daysAgo),
      ]
    );
    symptomCount++;
  }
  console.log(`   ✅ ${symptomCount} symptom records created\n`);

  // ── 3. PREDICTIONS ────────────────────────────────────────────────────────
  console.log("🤖 Seeding predictions...");
  let predCount = 0;

  // Ensure a spread: ~8 low, ~9 moderate, ~8 high
  const riskDistribution = [
    ...Array(8).fill(RISK_LEVELS[0]),
    ...Array(9).fill(RISK_LEVELS[1]),
    ...Array(8).fill(RISK_LEVELS[2]),
  ].sort(() => 0.5 - Math.random());

  for (let i = 0; i < 25; i++) {
    const userId   = rnd(userIds);
    const riskDef  = riskDistribution[i % riskDistribution.length];
    const score    = rndN(riskDef.scoreMin, riskDef.scoreMax);
    const daysAgo  = Math.floor(Math.random() * 90);

    const id = uuidv4();
    await run(
      "INSERT INTO predictions (id, userId, score, riskLevel, predictedAt) VALUES (?, ?, ?, ?, ?)",
      [id, userId, score, riskDef.level, ts(daysAgo)]
    );
    predCount++;
  }
  console.log(`   ✅ ${predCount} prediction records created\n`);

  // ── 4. POSTS ──────────────────────────────────────────────────────────────
  console.log("💬 Seeding community posts...");
  const postIds = [];

  for (let i = 0; i < POST_CONTENTS.length; i++) {
    const userId    = rnd(userIds);
    const anonymous = Math.random() < 0.25 ? 1 : 0;
    const user      = USERS.find((_, idx) => userIds[idx] === userId);
    const username  = anonymous ? "Anonymous" : (user?.fullName || "PMOS User");
    const likes     = Math.floor(Math.random() * 45);
    const daysAgo   = Math.floor(Math.random() * 60);

    const id = uuidv4();
    await run(
      `INSERT INTO posts (id, userId, username, content, anonymous, likes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, username, POST_CONTENTS[i], anonymous, likes, ts(daysAgo), ts(daysAgo)]
    );
    postIds.push(id);
  }
  console.log(`   ✅ ${postIds.length} posts created\n`);

  // ── 5. COMMENTS ───────────────────────────────────────────────────────────
  console.log("💭 Seeding comments...");
  let commentCount = 0;

  // Give each post 1–3 comments
  for (const postId of postIds) {
    const numComments = Math.floor(Math.random() * 3) + 1;
    for (let c = 0; c < numComments; c++) {
      const userId    = rnd(userIds);
      const anonymous = Math.random() < 0.2 ? 1 : 0;
      const user      = USERS.find((_, idx) => userIds[idx] === userId);
      const username  = anonymous ? "Anonymous" : (user?.fullName || "PMOS User");
      const daysAgo   = Math.floor(Math.random() * 55);

      const id = uuidv4();
      await run(
        `INSERT INTO comments (id, postId, userId, username, text, anonymous, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [id, postId, userId, username, rnd(COMMENT_POOL), anonymous, ts(daysAgo)]
      );
      commentCount++;
    }
  }
  console.log(`   ✅ ${commentCount} comments created\n`);

  // ── 6. REPORTS ────────────────────────────────────────────────────────────
  console.log("📄 Seeding lab reports...");
  let reportCount = 0;

  const reportFiles = [
    { name: "Hormone_Panel_Results.pdf",    url: "/uploads/seed-hormone-panel.pdf" },
    { name: "Glucose_Insulin_Test.pdf",     url: "/uploads/seed-glucose-insulin.pdf" },
    { name: "Thyroid_Panel_TSH_T3_T4.pdf", url: "/uploads/seed-thyroid-panel.pdf" },
    { name: "Ovarian_Ultrasound_Report.pdf",url: "/uploads/seed-ultrasound.pdf" },
    { name: "Full_Blood_Count.pdf",         url: "/uploads/seed-fbc.pdf" },
    { name: "AMH_Level_Test.pdf",           url: "/uploads/seed-amh.pdf" },
    { name: "Testosterone_DHEA_Panel.pdf",  url: "/uploads/seed-testosterone.pdf" },
    { name: "Fasting_Glucose_HbA1c.pdf",   url: "/uploads/seed-hba1c.pdf" },
    { name: "Pelvic_Scan_Report.pdf",       url: "/uploads/seed-pelvic.pdf" },
    { name: "Progesterone_Day21.pdf",       url: "/uploads/seed-progesterone.pdf" },
  ];

  for (let i = 0; i < 20; i++) {
    const userId    = rnd(userIds);
    const file      = rnd(reportFiles);
    const daysAgo   = Math.floor(Math.random() * 180);
    const id        = uuidv4();

    await run(
      "INSERT INTO reports (id, userId, fileName, fileUrl, uploadedAt) VALUES (?, ?, ?, ?, ?)",
      [id, userId, file.name, file.url, ts(daysAgo)]
    );
    reportCount++;
  }
  console.log(`   ✅ ${reportCount} report records created\n`);

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const counts = {
    users:       (await all("SELECT COUNT(*) as c FROM users"))[0].c,
    symptoms:    (await all("SELECT COUNT(*) as c FROM symptoms"))[0].c,
    predictions: (await all("SELECT COUNT(*) as c FROM predictions"))[0].c,
    posts:       (await all("SELECT COUNT(*) as c FROM posts"))[0].c,
    comments:    (await all("SELECT COUNT(*) as c FROM comments"))[0].c,
    reports:     (await all("SELECT COUNT(*) as c FROM reports"))[0].c,
  };

  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║             ✅  SEED COMPLETE                    ║");
  console.log("╠══════════════════════════════════════════════════╣");
  console.log(`║  👤 Users         : ${String(counts.users).padEnd(28)}║`);
  console.log(`║  🩺 Symptoms      : ${String(counts.symptoms).padEnd(28)}║`);
  console.log(`║  🤖 Predictions   : ${String(counts.predictions).padEnd(28)}║`);
  console.log(`║  💬 Posts         : ${String(counts.posts).padEnd(28)}║`);
  console.log(`║  💭 Comments      : ${String(counts.comments).padEnd(28)}║`);
  console.log(`║  📄 Reports       : ${String(counts.reports).padEnd(28)}║`);
  console.log("╠══════════════════════════════════════════════════╣");
  console.log("║  🔑 Demo password : Demo1234!                    ║");
  console.log("║  📧 Any seed email can be used to log in         ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  process.exit(0);
}

seed().catch((err) => {
  console.error("\n❌ Seed failed:", err);
  process.exit(1);
});
