/**
 * lib/content/articles
 * ─────────────────────────────────────────────────────────────────────────────
 * The wellness library's actual content.
 *
 * This replaces four outbound links that all pointed at `example.com` — the
 * app's only educational path terminated in dead URLs, including the one the
 * home screen promotes. (C-07 in PLAN.md.)
 *
 * Written to the same standard the assessment result screen already holds
 * itself to:
 *
 *   - No statistics. If a number can't be cited it isn't stated. The
 *     mindfulness screen's "lowers cortisol by up to 25%" is exactly the
 *     failure mode being avoided here.
 *   - Nothing prescriptive. No supplement is named, no dose is given, no
 *     treatment is recommended. Describing what a clinician might discuss is
 *     different from telling someone what to take.
 *   - Hedged where the evidence is genuinely mixed, because it often is.
 *
 * Content lives in the bundle rather than behind a fetch: it works offline,
 * costs no request, and can be reviewed by a supervisor as part of the
 * project rather than changing under the app.
 */

import type { Ionicons } from "@expo/vector-icons";

export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] };

export type Article = {
  id: string;
  category: "Understanding PCOS" | "Your cycle" | "Everyday life" | "Getting care";
  title: string;
  /** One line, shown on the library card. */
  summary: string;
  icon: keyof typeof Ionicons.glyphMap;
  readingMinutes: number;
  body: ArticleBlock[];
};

export const ARTICLES: Article[] = [
  {
    id: "what-is-pcos",
    category: "Understanding PCOS",
    title: "What PCOS actually is",
    summary: "A hormonal condition, not a single problem with the ovaries.",
    icon: "help-circle-outline",
    readingMinutes: 3,
    body: [
      {
        type: "paragraph",
        text: "Polycystic ovary syndrome is a hormonal condition. The name is unhelpful, because it points at the ovaries and at cysts, and neither is the whole story — many people diagnosed with PCOS have no cysts at all, and the ones often seen on a scan are not cysts in the usual sense. They are follicles that started to develop and stopped.",
      },
      {
        type: "paragraph",
        text: "What is going on underneath is a pattern of hormones that sits outside the usual range. That pattern affects the menstrual cycle, the skin and hair, and how the body handles blood sugar. It shows up differently in different people, which is a large part of why it is so often missed.",
      },
      { type: "heading", text: "How it is usually diagnosed" },
      {
        type: "paragraph",
        text: "Most clinicians work from three features, and look for at least two of them being present with other causes ruled out:",
      },
      {
        type: "list",
        items: [
          "Irregular or absent periods, meaning ovulation is not happening reliably",
          "Raised androgen levels — either measured in blood, or visible as excess hair growth, persistent acne or scalp hair thinning",
          "Ovaries with a particular appearance on ultrasound",
        ],
      },
      {
        type: "paragraph",
        text: "This is why an app cannot diagnose it. Two of those three require a blood test or a scan. What an app can do is help you notice a pattern and describe it accurately to someone who can order those tests.",
      },
      { type: "heading", text: "It is common, and it is manageable" },
      {
        type: "paragraph",
        text: "PCOS is one of the more common hormonal conditions in people of reproductive age. It is also long-term — it is managed rather than cured — and management is usually a combination of things rather than one intervention. Many people find their symptoms change substantially over the years.",
      },
    ],
  },

  {
    id: "insulin-resistance",
    category: "Understanding PCOS",
    title: "Why insulin resistance matters",
    summary: "How blood sugar, weight and cycle regularity connect.",
    icon: "pulse-outline",
    readingMinutes: 4,
    body: [
      {
        type: "paragraph",
        text: "Insulin is the hormone that moves sugar out of the blood and into cells. Insulin resistance means the cells respond to it less readily, so the body compensates by producing more. Blood sugar can look normal on a test for a long time while insulin levels are quietly high.",
      },
      {
        type: "paragraph",
        text: "This matters for PCOS because raised insulin appears to push the ovaries toward producing more androgens — the hormone group that includes testosterone. That is the link between a metabolic problem and symptoms that seem unrelated to metabolism: the excess hair growth, the persistent acne, the cycles that stop being predictable.",
      },
      { type: "heading", text: "The loop" },
      {
        type: "paragraph",
        text: "Raised insulin encourages androgen production. Raised androgens make it harder for the body to use insulin well. Each side reinforces the other, which is why the condition tends to be self-sustaining rather than self-correcting, and why interventions that improve insulin sensitivity often improve symptoms that look hormonal rather than metabolic.",
      },
      { type: "heading", text: "What tends to help" },
      {
        type: "paragraph",
        text: "The evidence is strongest and least controversial for these, and they are the things clinicians usually raise first:",
      },
      {
        type: "list",
        items: [
          "Regular movement — the kind you can sustain matters more than the kind that is most intense. Muscle uses glucose during and after activity.",
          "Meals built around whole grains, beans, vegetables and protein, which raise blood sugar more slowly than refined carbohydrates.",
          "Sleep. Short or disrupted sleep measurably worsens insulin sensitivity, and it is the one people most often leave out.",
        ],
      },
      {
        type: "paragraph",
        text: "There are also medications that act directly on insulin sensitivity, and they are prescribed for PCOS in some circumstances. Whether they are appropriate for you is a conversation with a doctor — it depends on your test results, and on what you are trying to achieve.",
      },
      {
        type: "paragraph",
        text: "One caveat worth stating plainly: insulin resistance is common in PCOS but not universal, and it occurs in people of every body size. If you have been told your weight is the whole explanation, that is worth questioning.",
      },
    ],
  },

  {
    id: "reading-your-cycle",
    category: "Your cycle",
    title: "What counts as an irregular cycle",
    summary: "The numbers clinicians actually use, and what they mean.",
    icon: "calendar-outline",
    readingMinutes: 3,
    body: [
      {
        type: "paragraph",
        text: "A cycle is measured from the first day of one period to the first day of the next — not from when bleeding stops. That single detail causes a lot of confusion, and getting it right changes the number you would report to a doctor.",
      },
      { type: "heading", text: "The usual ranges" },
      {
        type: "paragraph",
        text: "Most clinicians treat cycles between roughly 21 and 35 days as typical for an adult. Two things move a cycle out of that description:",
      },
      {
        type: "list",
        items: [
          "Length — consistently shorter than 21 days, or consistently longer than 35",
          "Variation — cycles that swing widely from one month to the next, even when the average sits inside the range",
        ],
      },
      {
        type: "paragraph",
        text: "The second is the one people tend to under-report, because an average that looks fine hides the swing. A run of 26, 41, 24 and 38 days averages to something unremarkable and is not remotely regular.",
      },
      { type: "heading", text: "Why it is the most useful thing you can track" },
      {
        type: "paragraph",
        text: "Irregular cycles are the most common reason people first raise PCOS with a doctor, and cycle pattern is one of the three diagnostic features. It is also the only one of the three you can document yourself, without a test.",
      },
      {
        type: "paragraph",
        text: "A few months of logged start dates is worth considerably more in an appointment than a description from memory. It turns \"I think they're irregular\" into a specific set of numbers, and it is much harder to wave away.",
      },
      { type: "heading", text: "Some normal caveats" },
      {
        type: "paragraph",
        text: "Cycles are commonly irregular in the first years after periods begin and again approaching menopause. Illness, significant stress, travel across time zones, and large changes in weight or training load can all shift a cycle temporarily. One unusual month is not a pattern.",
      },
    ],
  },

  {
    id: "preparing-for-an-appointment",
    category: "Getting care",
    title: "Preparing for a doctor's appointment",
    summary: "What to bring so a short appointment goes further.",
    icon: "clipboard-outline",
    readingMinutes: 3,
    body: [
      {
        type: "paragraph",
        text: "PCOS is frequently missed, and one reason is structural: a first appointment is short, symptoms sound vague described from memory, and the ones that matter most are easy to leave out because they seem unrelated to each other.",
      },
      {
        type: "paragraph",
        text: "Going in with specifics changes the conversation. Here is what is worth having ready.",
      },
      { type: "heading", text: "Bring" },
      {
        type: "list",
        items: [
          "Your cycle dates — the start date of each of your last few periods, not a description",
          "The symptoms you have noticed and roughly when each began",
          "Family history of PCOS or type 2 diabetes, including grandparents",
          "Anything you have already tried, and whether it changed anything",
          "Any medication or supplement you take, with the dose",
        ],
      },
      { type: "heading", text: "Ask" },
      {
        type: "list",
        items: [
          "Are my symptoms worth investigating for PCOS, and if not, what else could explain them?",
          "Which blood tests would help, and when in my cycle should they be taken?",
          "Should I have an ultrasound?",
          "What would we do differently depending on the results?",
        ],
      },
      {
        type: "paragraph",
        text: "That last question is a useful one in general. It moves the appointment from listing symptoms to agreeing a plan, and it makes the next step explicit before you leave.",
      },
      { type: "heading", text: "If you are not taken seriously" },
      {
        type: "paragraph",
        text: "It is common enough to be worth naming. If your symptoms are dismissed and you remain concerned, asking for the reasoning to be recorded, or seeking a second opinion, is reasonable. Bringing written evidence of a pattern makes both easier.",
      },
    ],
  },
];

export const getArticle = (id: string): Article | undefined =>
  ARTICLES.find((a) => a.id === id);
