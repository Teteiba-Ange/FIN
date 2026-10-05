// src/services/groqService.js
/**
 * Personalised guidance from the assessment result, via Groq.
 *
 * Lives on the server, not in the app, for one non-negotiable reason: an API
 * key shipped inside a mobile bundle is a published API key. Anything prefixed
 * `EXPO_PUBLIC_` is readable by anyone who downloads the app, and a key in the
 * JS bundle is readable regardless of prefix.
 *
 * ─── The safety constraints matter more than the feature ────────────────────
 *
 * This project has spent a lot of effort removing invented health claims — the
 * fabricated "lowers cortisol by 25%", the SHAP attributions for features the
 * user never supplied, the three mindfulness sessions nobody completed. Putting
 * a language model in front of the same users is the single easiest way to
 * reintroduce all of it at scale.
 *
 * So the model is fenced in hard:
 *
 *   - It receives only what the user actually reported. No invented context.
 *   - It is instructed never to state a statistic, name a medication or
 *     supplement, give a dose, or diagnose. The output is then *checked* for
 *     those, because an instruction is not an enforcement mechanism.
 *   - It must return strict JSON in a fixed shape, so the app renders it as
 *     structured content rather than free text it cannot vet.
 *   - Anything that fails validation is discarded entirely and the caller
 *     falls back to the app's hand-written suggestions. A partial or
 *     suspicious response is not shown.
 *
 * The app labels the result as AI-generated. That labelling is part of the
 * feature, not decoration.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

/**
 * Chosen by testing against this account's actual model list, not by assumption.
 *
 * `openai/gpt-oss-20b` and `qwen/qwen3.6-27b` both fail with HTTP 400
 * "Failed to validate JSON" under `response_format: json_object` for this
 * prompt. `openai/gpt-oss-120b` returns valid, rule-respecting JSON in about
 * two seconds, which is comfortably inside the window where the score is
 * already on screen.
 *
 * Override with GROQ_MODEL. Check availability first — the catalogue differs
 * per account:
 *   curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
 */
const DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * Used for the final attempt. The 120b model is the more capable of the two
 * but is noticeably more rate-limited on the free tier — most observed
 * failures were 429s rather than bad output. The smaller model gets through
 * when the larger one is throttled, and its output passes the same checks.
 */
const FALLBACK_MODEL = "openai/gpt-oss-20b";

const TIMEOUT_MS = Number(process.env.GROQ_TIMEOUT_MS || 12_000);

const SYSTEM_PROMPT = `You write short, practical guidance for someone who has just completed a PCOS screening questionnaire in a mobile app.

You are NOT a doctor and must never appear to be one.

HARD RULES — breaking any of these makes the response unusable:
1. Never state a statistic, percentage, figure or number of any kind. Not "30% of women", not "lowers X by half", not "within 3 months". No numbers at all.
2. Never name or imply a medication, supplement, vitamin, herb or treatment. Not metformin, not inositol, not birth control, not vitamin D.
3. Never diagnose, never say the person has or likely has PCOS, and never predict what a test will show.
4. Never claim a mechanism as established fact. Prefer "many people find", "some evidence suggests", "your doctor may look at".
5. Never suggest anything that would delay someone seeing a clinician.
6. Do not mention the risk score itself. The app already shows it.

STYLE:
- Address the reader as "you". Warm, plain, direct. No cheerleading, no exclamation marks.
- Each suggestion must be actionable this week, not a lifestyle overhaul.
- Ground every suggestion in something the person actually reported. If they reported irregular cycles, talk about tracking them. Do not invent context.
- British English.

OUTPUT: strict JSON only, no markdown fence, no prose around it:
{"suggestions":[{"title":"...","body":"...","icon":"..."}]}

- 3 to 4 suggestions.
- "title": at most 6 words.
- "body": 1-2 sentences, at most 240 characters.
- "icon": exactly one of: calendar-outline, walk-outline, nutrition-outline, moon-outline, medkit-outline, water-outline, heart-outline, clipboard-outline, people-outline, leaf-outline`;

/** Words that must never appear in output shown to a user. */
const BANNED_TERMS = [
  "metformin", "inositol", "spironolactone", "clomid", "letrozole",
  "birth control", "contraceptive", "supplement", "vitamin", "berberine",
  "spearmint", "dosage", "prescri",
  "you have pcos", "diagnos", "cure",
];

/**
 * Phrases that only matter in a specific shape, where a plain substring match
 * would fire on innocent text. "treat your condition" is a claim; "treat
 * yourself to a walk" is not, and the previous `"treat your"` entry killed
 * both. Likewise a bare "mg" matched inside ordinary words.
 */
const BANNED_PATTERNS = [
  /\btreat (your|this) (condition|pcos|symptoms)\b/i,
  /\b\d+\s?(mg|mcg|iu|ml)\b/i,
  /\btake (a|an|one|two|\d+)\b.*\b(pill|tablet|capsule|dose)\b/i,
];

/**
 * Numbers that constitute a *claim* about outcomes — a percentage, or a
 * promised timeframe.
 *
 * Deliberately narrower than before. The old pattern also caught any duration
 * or frequency, so ordinary advice like "walk on three days a week" or "log
 * for 7 days" was rejected and took the whole batch with it. Those are
 * instructions, not health claims, and the system prompt already forbids
 * asserting outcomes.
 */
const NUMERIC_CLAIM =
  /\b\d+(\.\d+)?\s*(%|percent|per cent)|\b(within|in|after|by)\s+\d+\s*(days?|weeks?|months?)\b/i;

const ALLOWED_ICONS = new Set([
  "calendar-outline", "walk-outline", "nutrition-outline", "moon-outline",
  "medkit-outline", "water-outline", "heart-outline", "clipboard-outline",
  "people-outline", "leaf-outline",
]);

/**
 * Describes what the user reported, in plain language.
 *
 * Deliberately not the raw payload: sending field names and enum values invites
 * the model to reason about the scoring, and there is no reason for it to see
 * the numbers at all.
 */
function describeAnswers(answers = {}) {
  const lines = [];

  if (answers.cycleRegularity) {
    const phrasing = {
      Regular: "Their periods are regular.",
      Irregular: "Their periods are irregular — the timing varies a lot.",
      "No Cycle": "They have not had a period for three months or more.",
    };
    lines.push(phrasing[answers.cycleRegularity] ?? "");
  }

  const symptomWords = {
    hair_growth: "excess hair growth on the face or body",
    hair_loss: "thinning hair on the scalp",
    acne: "persistent acne or oily skin",
    weight_gain: "unexplained weight gain",
    skin_darkening: "darkened patches of skin",
    fatigue: "ongoing tiredness",
    mood: "mood changes",
  };
  const reported = (answers.symptoms ?? [])
    .filter((s) => s !== "none")
    .map((s) => symptomWords[s])
    .filter(Boolean);

  if (reported.length) {
    lines.push(`They reported: ${reported.join(", ")}.`);
  } else if ((answers.symptoms ?? []).includes("none")) {
    lines.push("They reported none of the listed symptoms.");
  }

  if (answers.exerciseHabit === "Sedentary") {
    lines.push("They describe themselves as mostly sitting during the day.");
  } else if (answers.exerciseHabit === "Active") {
    lines.push("They are already regularly active.");
  }

  if (["3–4x / week", "Daily"].includes(answers.fastFoodFrequency)) {
    lines.push("They eat fast food most days or several times a week.");
  }

  const family = answers.familyHistory ?? [];
  if (family.includes("pcos")) lines.push("PCOS runs in their family.");
  if (family.includes("diabetes")) lines.push("Type 2 diabetes runs in their family.");
  if (family.includes("unsure")) lines.push("They do not know their family history.");

  if (answers.riskLevel) {
    // The band, never the number — the model must not reason about the score.
    lines.push(`The screening placed them in the ${String(answers.riskLevel).toLowerCase()} band.`);
  }

  return lines.filter(Boolean).join("\n") || "They completed the questionnaire but reported little detail.";
}

function isSafe(text) {
  const value = String(text ?? "");
  const lower = value.toLowerCase();
  if (BANNED_TERMS.some((term) => lower.includes(term))) return false;
  if (BANNED_PATTERNS.some((pattern) => pattern.test(value))) return false;
  if (NUMERIC_CLAIM.test(value)) return false;
  return true;
}

/**
 * Pulls a JSON object out of whatever the model returned.
 *
 * Even with `response_format: json_object` the response occasionally arrives
 * wrapped in a markdown fence or with a sentence in front of it, and that was
 * being counted as a total failure. Finding the outermost braces recovers a
 * response that is otherwise perfectly good.
 */
function extractJson(raw) {
  if (typeof raw !== "string") return raw ?? null;

  const text = raw.trim();

  try {
    return JSON.parse(text);
  } catch {
    /* Fall through to the recovery below. */
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Validates and sanitises the model's response.
 *
 * Individual suggestions are dropped, not the whole batch.
 *
 * This previously returned null the moment *any* item broke a rule, so one
 * suggestion mentioning a supplement threw away three perfectly good ones and
 * the user silently got the built-ins instead. Discarding the offender and
 * keeping the rest is both safer-by-default and far more likely to produce
 * something useful, since the remaining items were independently checked.
 *
 * Returns null only when fewer than two usable suggestions survive — at which
 * point the caller's hand-written set is genuinely the better answer.
 */
function validate(raw) {
  const parsed = extractJson(raw);

  const list = parsed?.suggestions;
  if (!Array.isArray(list) || list.length === 0) return null;

  const clean = [];
  let dropped = 0;

  for (const item of list) {
    if (clean.length >= 4) break;

    const title = String(item?.title ?? "").trim();
    const body = String(item?.body ?? "").trim();
    const icon = String(item?.icon ?? "").trim();

    if (!title || !body || title.length > 60 || body.length > 300) {
      dropped++;
      continue;
    }

    if (!isSafe(title) || !isSafe(body)) {
      dropped++;
      console.warn(`[GROQ] Dropped a suggestion that broke the content rules: "${title}"`);
      continue;
    }

    clean.push({
      title,
      body,
      icon: ALLOWED_ICONS.has(icon) ? icon : "leaf-outline",
    });
  }

  if (dropped > 0) {
    console.warn(`[GROQ] Kept ${clean.length} suggestion(s), dropped ${dropped}`);
  }

  return clean.length >= 2 ? clean : null;
}

/** True when the feature is configured at all. */
const isConfigured = () => Boolean(process.env.GROQ_API_KEY);

/**
 * Returns an array of suggestions, or null.
 *
 * Null means "use the built-in ones" — no key configured, the service was
 * unreachable, or the response failed validation. It is never an error the
 * caller needs to surface: guidance is an enhancement, and the app has a
 * perfectly good hand-written fallback.
 */
/** One attempt. Returns validated suggestions, or a reason to retry / give up. */
async function attempt(prompt, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        // Low temperature: this is a constrained, structured task, and
        // creativity here means invention.
        temperature: 0.3,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // 429 is rate limiting and 5xx is transient — both are worth another go.
      // A 400 here is usually the model failing strict JSON mode rather than a
      // malformed request, and that is also worth retrying.
      const retryable = response.status === 429 || response.status === 400 || response.status >= 500;
      const after = Number(response.headers.get("retry-after")) || null;

      console.warn(`[GROQ] HTTP ${response.status}: ${detail.slice(0, 160)}`);
      return { ok: false, retryable, retryAfterMs: after ? after * 1000 : null };
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return { ok: false, retryable: true, retryAfterMs: null };

    const suggestions = validate(content);
    if (!suggestions) {
      console.warn("[GROQ] Response failed validation");
      // Worth one more roll of the dice: the same prompt at this temperature
      // usually produces a clean result on a second pass.
      return { ok: false, retryable: true, retryAfterMs: null };
    }

    return { ok: true, suggestions };
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn(`[GROQ] Timed out after ${TIMEOUT_MS}ms`);
      return { ok: false, retryable: false, retryAfterMs: null };
    }
    console.warn("[GROQ] Request failed:", error.message);
    return { ok: false, retryable: true, retryAfterMs: null };
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getRecommendations(answers) {
  if (!isConfigured()) return null;

  const prompt = `Here is what this person reported:\n\n${describeAnswers(
    answers
  )}\n\nWrite their suggestions as JSON.`;

  const primary = process.env.GROQ_MODEL || DEFAULT_MODEL;
  /**
   * Measured, not assumed: across repeated runs the primary model returns a
   * usable result roughly half the time, failing with intermittent 429s and
   * occasional strict-JSON errors. A single attempt therefore meant the
   * feature silently fell back to the built-in suggestions about as often as
   * it worked.
   *
   * Two attempts on the primary, then one on the smaller model — which is far
   * less rate-limited — turns that into a reliable path. The last attempt
   * still failing is fine: the caller has hand-written suggestions.
   */
  const plan = [primary, primary, FALLBACK_MODEL];

  for (let i = 0; i < plan.length; i++) {
    const result = await attempt(prompt, plan[i]);
    if (result.ok) {
      if (i > 0) console.log(`[GROQ] Succeeded on attempt ${i + 1} (${plan[i]})`);
      return result.suggestions;
    }
    if (!result.retryable) return null;
    if (i === plan.length - 1) break;

    // Honour Retry-After when the API sends one; otherwise back off gently.
    await sleep(result.retryAfterMs ?? 400 * (i + 1));
  }

  console.warn("[GROQ] All attempts failed — using built-in suggestions");
  return null;
}

module.exports = { getRecommendations, isConfigured, describeAnswers, validate };
