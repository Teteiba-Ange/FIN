# PCOS App — Remediation Plan & Tracker

Working tracker for the engineering + design audit of `PCOS-Screening-App`.
**Scope: the mobile app.** Backend and ML service appear only where they cause app-visible behaviour.

- **Audit date:** 2026-08-16
- **Baseline:** 54 findings — 10 critical, 23 major, 21 minor
- **Baseline health:** `tsc --noEmit` clean · `expo lint` 6 errors, 16 warnings · 0 tests · 5 of 24 screens on the design system
- **Full audit with evidence:** https://claude.ai/code/artifact/98cb9b54-cd15-4724-8d82-c6b8df9b68ae

---

## How to use this file

Tick boxes as you go. Every task carries its finding ID (`A-01`, `E-03`…) so it maps back to the audit.
Update **Progress** below when you close a phase. Log anything you decide differently in **Decision log**.

**Status legend** — `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` won't do (add a line to the Decision log)

---

## Progress

| Phase | Title | Findings | Status |
|---|---|---|---|
| 00 | Stop the bleeding | 3 | `[~]` crash fixed; **git still uncommitted (user deferred)** |
| 01 | Make the app keep what the user gives it | 7 | `[x]` (D-03 blocked on a model retrain) |
| 02 | Tell the truth on every screen | 10 | `[x]` (C-09 partial) |
| 03 | Finish the design system migration | 12 | `[x]` |
| 04 | Build the two missing features | 2 | `[x]` |
| 05 | Onboarding, consent, offline | 5 | `[x]` (G-08 needs your Sentry DSN) |
| 06 | Make it shippable | 6 | `[~]` G-03 done early |

**Closed: 42 / 54**  ·  Critical 8/10 · Major 21/23 · Minor 13/21

Remaining criticals: **G-01** (git — deferred by user) · **G-02** (no `eas.json`)

📱 **Device testing:** see [DEVICE-TESTING.md](DEVICE-TESTING.md). One step needs your admin rights (the firewall rule).

### Health check

| Metric | Baseline | Now |
|---|---|---|
| Screens on the design system | 5 / 24 | **20 / 20** |
| Hardcoded colours in screen code | ~330 | **0** |
| `expo lint` | 6 errors, 16 warnings | **0** |
| `tsc --noEmit` | clean | clean |
| Emoji used as icons | ~30 | **0** |
| Screens with no dark mode | 19 | **0** |
| Tests | 0 | 0 |

---

## Phase 00 — Stop the bleeding

> Under an hour. Nothing else should start before this is done.

- [x] **G-07** `.env` gitignored ✅ *2026-08-16*
  - App `.gitignore` only had `.env*.local`; `.env` added (verified with `git check-ignore`). Backend already covered it.
  - `.env.example` written for **both** projects and explicitly un-ignored.
  - ⚠️ Matters more now: the backend `.env` holds a real `FIELD_ENCRYPTION_KEY`, and the app `.env` holds the dev API URL.
- [ ] **G-01** Commit everything and push to a remote. ⚠️ **STILL OPEN — now the highest risk item in the project.**
  - `git ls-files` still returns **0**, and there are now ~20 rewritten files on top of the original. None of it is recoverable if the disk goes.
- [x] **B-01** Delete the module-scope `useRouter()` call. ✅ *2026-08-16*
  - Was `app/(menu)/mental-wellbeing.tsx:5`. Removed with the unused import during the screen's migration.

---

## Phase 01 — Make the app keep what the user gives it

> Correctness only. Nothing visual changes in this phase.

- [x] **A-01** Persist auth tokens *(critical)* ✅ *2026-08-16*
  - New `lib/api/tokenStore.ts` backed by **`expo-secure-store`** (iOS Keychain / Android EncryptedSharedPreferences), not AsyncStorage — these are bearer credentials for health data. AsyncStorage fallback on web only.
  - `PCOSAPIService` hydrates from storage on first token access; `restoreSession()` is awaited by the auth gate at startup.
  - Startup no longer clears the session on a *network* failure — only on genuine rejection after the refresh attempt. Opening the app offline used to be indistinguishable from a dead token.
  - ✅ **The backend's refresh-token rotation now executes for the first time.**
- [x] **A-02** Sync symptom / cycle / mood logs to the server *(critical)* ✅ *2026-08-16*
  - **Backend:** three new tables (`symptom_logs`, `cycle_entries`, `mood_entries`) with indexes, `src/controllers/logController.js`, `src/routes/logs.js` mounted at `/api/logs`. Kept separate from `/api/symptoms`, which serves the *assessment snapshot* — a different shape entirely.
  - **Idempotent upserts on client-generated ids** — portable across Postgres (`ON CONFLICT DO UPDATE`) and SQLite (`INSERT OR REPLACE`), which is what makes the queue safe to replay blindly.
  - **Ownership enforced in every WHERE clause.** A client-supplied id is untrusted; without `userId = ?` anyone could overwrite another user's row by guessing an id.
  - **Client:** `lib/sync/queue.ts` (write-ahead queue) + `lib/logs/index.ts` (the facade the screens use). Writes go local-first then enqueue; flushes on write, on app foreground, and at startup. No NetInfo dependency added.
  - Queue collapses superseded ops (save→edit→delete for one entity sends one delete), distinguishes `rejected` (drop) from `retry` (keep), caps attempts at 8, and shares one in-flight flush so overlapping triggers can't double-send.
  - `pullFromServer()` refuses to run while writes are pending — pulling first would overwrite un-synced entries, the exact loss this prevents.
  - Wired into auth: pull on sign-in, flush-then-clear on logout so one account's health data isn't left readable to the next person on the handset.
  - **Notes encrypted at rest** (AES-256-GCM) via new `src/utils/fieldCrypto.js`, consolidating two prior implementations — `src/encrypt.js` threw at import with no key and was imported by nothing; `symptomController` had a safer copy inline.
  - ⚠️ **Medication logs are NOT included** — they use their own `pmos_medications` AsyncStorage keys and a different shape. Still device-only.

  **Verified end-to-end against a running server:** signup → write → read-back → 3× replay yields 1 row with the edit applied → mixed batch (2 ok, 1 rejected) → reinstall recovery of all three types → cross-user delete blocked → 401 without a token → notes ciphertext in the DB, plaintext to the owner → production refuses to boot without an encryption key.
- [x] **A-03** Persist assessment progress ✅ *2026-08-16*
  - Draft answers, current step and last result survive a restart (debounced 400ms writes; drafts expire after 7 days).
  - Restoring is **not silent** — the wizard asks "Pick up where you left off?" rather than presenting week-old answers as fresh and scoring them without anyone noticing.
  - Also fixed: `profileSync` was written from inside a `setState` updater; it's derived with `useMemo` now.
- [x] **A-04** Store `topFeatures` server-side ✅ *2026-08-16*
  - Added `predictions.topFeatures`, with idempotent migrations for **both** Postgres (`ADD COLUMN IF NOT EXISTS`) and SQLite (`PRAGMA table_info` guard) — `CREATE TABLE IF NOT EXISTS` is a no-op on an existing database, so a new column never reaches one.
  - Trends falls back to stored attributions when memory is empty.
- [x] **D-01** Fix the `fast_food` feature mapping *(critical)* ✅ *2026-08-16*
  - **Verified:** `Never`→0, `1–2x / week`→0, `3–4x / week`→1, `Daily`→1. Was **0 for all four**. Handles en-dash and hyphen variants.
- [x] **D-02** The four constant model features ✅ *2026-08-16*
  - Waist + hip added to step 1 as **optional** fields with a live waist-to-hip ratio; the backend computes the real ratio when present and falls back to a declared population median when not.
  - `pregnant`, `num_abortions`, `years_married` remain constants (the model was trained with them; dropping needs a retrain) — but they are now **stripped from SHAP attributions** before the result reaches the app, so the app never explains a score using a number the user never gave. Waist/hip attributions are stripped too when the fields were skipped.
- [x] **B-02** Replace the local `Field` in Edit Profile with the kit's *(critical)* ✅ *2026-08-16*
  - Screen rebuilt on the kit. Also removed the placeholder values that were pre-filled as if they were the user's answers (`avgCycleLength: "34"`, `lastPeriod: "Not tracked"`, `medicalBackground: "No medical background provided"`) in fields that were never sent on save. Added range validation on age/weight/height.

**Also folded in:**
- [x] **A-05** Casing normalised ✅ — `normalisePrediction()` in the API client handles every casing plus JSON-string `topFeatures`. Both screens' workarounds removed. `getLatestPrediction()` returns `null` for a never-assessed user instead of throwing on the 404.
- [~] **D-03** `avgPeriodDuration` — **still open, with the real reason now recorded.**
  - It *cannot* be used as-is: the model takes exactly 16 features (`ml-service/models/feature_names.pkl`) and period duration is not among them. The ML service **ignores unknown keys** rather than rejecting them, so sending it would look like a fix while changing nothing. Deliberately not sent.
  - Resolve by retraining with the feature, or by removing the question from step 2.

**Pulled forward from Phase 06:**
- [x] **G-03** API base URL ✅ *2026-08-16*
  - Reads `EXPO_PUBLIC_API_URL` (the old `process.env.API_PORT` was never inlined by Expo, so it was always `undefined`). Falls back to Metro's `hostUri` — the dev machine's LAN address, which a *physical device* can actually reach — before the emulator-only `10.0.2.2`.
  - ⚠️ Still HTTP. TLS + per-profile values in `eas.json` stay in Phase 06.

**New dependency:** `expo-secure-store` (added via `npx expo install`; config plugin auto-registered).

---

## Phase 02 — Tell the truth on every screen ✅ *2026-08-16*

> Fastest phase, highest reputational return. Matters as much as the crashes for a health app being marked as research.

- [x] **C-02** Fabricated forum counters removed. Post and reply counts are derived from the loaded data, and shown only when there is something to count.
- [x] **C-03** "Elena Richardson" fallback removed. Signed-out state now says "Not signed in" and offers a sign-in button.
- [x] **C-04** Invented clinical claims rewritten. The "lowers cortisol by up to 25%" paragraph is gone; each exercise now describes *what the pattern is* and what people commonly use it for, rather than asserting three clinical effects.
- [x] **C-05** Doses stripped from medication presets. Presets are names only, framed as spelling help; the dose field is always the user's own to fill from their prescription.
- [x] **C-06** Adherence denominator fixed. Computed from doses actually expected since the medication was added; withheld entirely for "As needed" and until at least 3 doses are expected.
- [x] **C-08** "FR-13" and "FR-16" removed from screen headers.
- [~] **C-09** Product naming — **partially done.** "Join PMOS Wellness" and "PCOS Wellness" removed from user-facing copy. **Still inconsistent:** `app.json` name/slug, the `"PMOS Reminders"` Android notification channel in `lib/notifications/index.ts:52`, and the root README. Storage keys deliberately left as `pmos_`.
- [x] **C-10** Incorrect timezone note gone — the screen holding it was deleted (see E-07).
- [x] **B-05** Facebook button removed from Login and Signup.
- [x] **B-06** "Forgot password" removed rather than left as a dead control. **Re-add when the backend route exists** — a user who forgets their password is still locked out.
- [x] **B-04** Google sign-in buttons hidden. See Decision log.

---

## Phase 03 — Finish the design system migration ✅ *2026-08-16*

> The largest phase and the one that changes how the app feels.

**All 12 screens migrated. 20/20 screens now on the system; zero hardcoded colours remain in screen code.**

- [x] **E-01a** `app/login.tsx` — inline validation, no social buttons, dark mode
- [x] **E-01b** `app/signup.tsx` — password rules stated up front, stock photo removed
- [x] **E-01c** `app/(menu)/symptom-log.tsx` — Picker → Chips, anchored severity scale
- [x] **E-01d** `app/(menu)/mental-wellbeing.tsx` — crash fixed, 7-day mood strip added
- [x] **E-01e** `app/(menu)/cycle-tracker.tsx` — plus derived stats (see E-04 note below)
- [x] **E-01f** `app/(menu)/profile.tsx` — fake identity removed
- [x] **E-01g** `app/(menu)/edit-profile.tsx` — keyboard bug fixed
- [x] **E-01h** `app/(tabs)/forum.tsx` — real loading/error/empty, refresh, optimistic likes, memoised rows
- [x] **E-01i** `app/(menu)/mindfulness/*` (4 screens) + `BreathingCircle`
- [x] **E-01j** `app/(menu)/medication-tracking.tsx`
- [x] **E-01k** `app/(menu)/wellness-library.tsx` — plus real article content
- [x] **E-01l** `app/(menu)/notification-settings.tsx` — **deleted** (E-07)

**Cross-cutting:**

- [x] **E-02** Dark mode works on every screen — zero hardcoded backgrounds left.
- [x] **E-03** All ~30 emoji replaced with Ionicons on token colours. `▲ ▼ ▶ ← ✓` glyph buttons gone.
- [x] **E-07** Duplicate notification screen deleted; menu row points at Settings.
- [~] **E-08** Navigation duplication — **partially done.** Notifications row removed. **Still duplicated:** "Edit profile" appears in both the menu's Account group and in Settings, and Profile is reachable from the menu card as well.
- [x] **E-09** `ScreenHeader` on Cycle Tracker, Mental Wellbeing, Wellness Library.
- [x] **E-10** Native `Picker` gone from both screens; `Chip` rows instead.
- [x] **E-11** `Alert` success confirmations → new `Toast` component. `Alert` kept for destructive actions only.
- [x] **E-12** `RefreshControl`, `SkeletonRows`, optimistic likes with rollback, memoised list rows.
- [ ] **E-13** Water pips still not tappable — mis-tap unfixable until midnight.
- [x] **F-01** `textTertiary` darkened `#7b908e` → `#5f7573` (3.35:1 → 4.75:1). Dark equivalent verified at 5.7:1.
- [x] **F-02** All glyph buttons are now real icon buttons with labels.
- [x] **F-03** `minTouchTarget` / `hitSlop` applied throughout.
- [x] **F-04** Reduced motion honoured in `BreathingCircle`, `Toast` and `Skeleton` — was documented as a rule but implemented nowhere.

**Design additions:**

- [ ] Add a real typeface via `expo-font`. **Recommended: Figtree** (from the ui-ux-pro-max healthcare pairing — medical/accessible/trustworthy, full weight range). Keep the existing type scale as-is.
- [x] One header rule, no exceptions. Dark-teal header bars deleted from Medication, Mindfulness and Notification Settings.
- [x] Stop nesting cards. Medication Tracking was the worst offender (card → colour bar → badge → ring, inside a banner and a tab strip); it's flat rows now.
- [ ] Animate the `RiskMeter` arc 0 → value with the number counting alongside.
- [x] Empty states on every previously-blank screen.

**New kit components added this phase:**
- `Toast` / `ToastProvider` — transient confirmations, reduced-motion aware, mounted in `app/_layout.tsx`
- `Skeleton` / `SkeletonRows` — loading placeholders shaped like the real content
- `Scale` — the anchored 1–n rating used by both symptom severity and mood, so the app repeats one pattern instead of two near-identical ones

---

## Phase 04 — Build the two features the app is pretending to have

- [x] **C-01** Real reminders *(critical)* ✅ *2026-08-16*
  - New `lib/notifications/scheduler.ts`. Three reminders now actually schedule with the OS:
    - **Daily check-in** at a time the user picks (default 20:00, not the advertised-but-never-scheduled 08:00 — the prompt asks how the day has been, which nobody can answer at breakfast).
    - **Period due**, two days before a date predicted from logged cycles.
    - **Weekly reading**, Sunday morning.
  - All **local** — no server needed, works offline, and works in Expo Go (which dropped remote push on Android in SDK 53).
  - Settings now reports *what actually happened*, not what was asked: denied OS permission is surfaced explicitly, and the cycle reminder says "needs two logged cycles" rather than appearing armed when it can't predict.
  - Cycle prediction **shares the tracker screen's rules** (same 10–120 day gap filter, same average), so a notification can never claim a date the screen contradicts. Verified across 7 histories including duplicates and a 400-day gap.
  - Re-scheduled on every cycle save, since the prediction moves with each entry.
  - Unified the Android channel — push registration was creating a second `pmos-reminders` channel with different settings, so the OS listed two entries for one app.
  - **`communityActivity` removed.** It required the server to send a push and nothing in the backend can. A switch that silently does nothing is the exact failure C-01 is about; it returns when there's something behind it.
  - Also corrected the menu's "Doses, schedules and reminders" — there are no medication reminders.
- [x] **E-04** A real cycle tracker ✅ *2026-08-16*
  - New `components/ui/MonthCalendar.tsx`. Logging is tap-a-day — pick the start, pick the end, confirm — with the draft range shading live before it's committed.
  - Logged days are **filled**, predicted days are a **dashed outline**. Different in shape as well as hue, so "this happened" vs "this might" survives greyscale and colour-blindness. That distinction is the entire point of the view.
  - New `lib/cycle/analysis.ts` is now the **single source of truth**: average, variation, period duration, next expected, days late, and a regularity verdict with a plain-language reason.
  - The scheduler's duplicate prediction is **deleted** — it had its own copy of the gap filter and averaging, one edit away from a notification claiming a date the calendar contradicts. Screen, reminder and assessment now read the same module.
  - **Assessment step 2 pre-fills from the logs.** Regularity, cycle length and period duration come from tracked dates rather than memory, with the derivation shown ("Your cycles range from 24 to 41 days — a 17-day spread. Based on 3 cycles you've tracked"). The user can override, and the moment they do the provenance card disappears rather than continuing to claim the assessment used their data. With no logs the step behaves exactly as before.
  - **20 tests**, dependency-free via Node type stripping: `npm run test:logic`. Covers all four regularity verdicts, averaging, lateness, calendar keys, and the garbage cases — duplicate dates, a 400-day gap, a malformed date, a reversed end date, and a year-long entry that would otherwise loop unbounded. Also pins local-date keys so an 11:30pm log doesn't land on the wrong day.

---

## Phase 05 — Onboarding, consent, and the offline story ✅ *2026-08-16*

- [x] **E-05** Onboarding with a real consent gate ✅
  - Three screens: what the app does · **what the score is and isn't** · where the data goes. The second exists so expectations are set *before* anyone sees a number — the result screen already says it isn't a diagnosis, but saying so only afterwards is too late.
  - Consent is an explicit tick that gates the button, not "by continuing you agree" — the latter is a notice dressed as consent.
  - New `lib/consent` stores it **versioned**: consent to one set of terms isn't consent to a later one, so bumping `CONSENT_VERSION` re-asks everyone. A corrupt or unreadable record counts as *not* consented.
  - Auth gate routes first-run users here rather than to the login form.
- [x] **G-06** Privacy screen, export, and account deletion ✅
  - New `app/(menu)/privacy.tsx` describing what's held and how — every claim checkable against the source.
  - `GET /users/export` returns everything as JSON with notes **decrypted**, shared via the OS share sheet (no storage permission needed).
  - `DELETE /users/account` **really deletes** — every table cleared, user row dropped, not a flag. Requires the current password, so a borrowed unlocked phone can't wipe someone's medical history.
- [x] **E-06** Sync status surfaced ✅
  - New `SyncBanner` on Home reports **what's actually queued** rather than guessing at network state: "3 entries haven't synced yet — saved on this phone, they'll upload automatically", with a retry. Hidden when the queue is empty.
  - Chose this over adding a connectivity library: "you're offline" is wrong when the phone has signal and the server is down, and it says nothing about whether the data is safe.
- [x] **B-07** Root error boundary ✅
  - New `components/AppErrorBoundary.tsx`, mounted inside `ThemeProvider` (so the fallback is themed) but outside every other provider. Shows the error message rather than a generic apology — "it crashed" is not a report anyone can act on — plus a retry, and the component stack in dev.
  - `onError` is the hook a crash reporter plugs into.
- [ ] **G-08** Sentry — **not done.** Needs a DSN from your Sentry account. The boundary's `onError` is the wiring point; it's ~10 minutes once you have one.

### 🔴 Bug found and fixed during this phase — not in the original audit

**Account deletion was not durable.** `authMiddleware` verified the JWT signature but never checked the account still existed, so a token stayed valid for its full lifetime after deletion. Because every write is an upsert keyed on the user id, a client that kept posting **recreated rows for the deleted user** — verified: a POST after deletion returned `{"synced":true}` and the row persisted.

Fixed by adding an existence check to the middleware (one indexed primary-key lookup per request — the ordinary price of being able to revoke access). A database failure returns 503 rather than 401, so a transient outage doesn't sign everyone out. Re-verified: every call with a deleted account's token now returns `401 Account no longer exists`, and zero orphan rows remain.

---

## Phase 06 — Make it shippable

- [x] **B-03** Real icon and splash assets *(critical)* ✅ *2026-08-16*
  - Generated `assets/images/` from `logo1.png`: `icon.png` (1024², opaque white — iOS composites alpha onto black), `adaptive-icon.png` (1024², transparent, mark at 55% for the Android launcher safe zone), `splash-icon.png`, `favicon.png`, `notification-icon.png`.
  - **Cropped to the lotus symbol only.** The source is a full lockup — tagline, lotus, "PMOS Wellness" wordmark — and both text bands are illegible at 48dp. Cropping also means the icon needn't be re-cut when C-09 naming is settled.
  - Splash grounds changed from `#ffffff`/`#000000` to the app's own `#fbfcfc`/`#0b1413`, so launch doesn't flash a different white than the app itself.
  - Also set: `expo-notifications` plugin with a proper silhouette icon and brand colour; `name` → "PCOS Screening"; removed the dead `facebookAppId` placeholder.
- [ ] **G-02** `eas.json` with development / preview / production profiles *(critical)*
  - No build config exists, so no installable artefact has ever been produced. Push has never run for real (Expo Go dropped remote push in SDK 53).
- [ ] **G-03** Fix the API base URL *(critical)*
  - `lib/api/client.ts:5-23` hardcodes `10.0.2.2` (emulator-only) and reads `process.env.API_PORT`, which Expo never inlines without an `EXPO_PUBLIC_` prefix — so it is always `undefined`. Everything is `http://`.
  - Move to `EXPO_PUBLIC_API_URL` with per-profile values. Deploy the backend behind TLS. Keep the emulator fallback for dev only.
- [ ] **G-04** The five tests that matter
  - [ ] `computeLocalScore` (`result.tsx:44`)
  - [ ] `levelFromScore` (`RiskMeter.tsx:43`)
  - [ ] BMI calculation (`assessmentContext.tsx:126`)
  - [ ] **Contract test over `mapSymptomsToMLInput`** — assert every enum the app can send maps to a distinct feature value *(would have caught D-01)*
  - [ ] Render test for the assessment flow
- [ ] **G-05** Strip PII from auth logs
  - `authController.js:17-35` appends email + full name to `logs/auth.log` and stdout on every auth event. Log user IDs instead.
- [ ] **B-10** Lint to zero, then add lint + typecheck as a pre-commit hook and in CI.
- [ ] **B-08** Delete the phantom `<Tabs.Screen name="assessment" href={null} />` (`app/(tabs)/_layout.tsx:78`).
- [ ] **B-09** Delete the orphan `App.js` and rewrite the root `README.md` — it still documents a bare RN CLI project with `frontend/` and `backend/` folders that don't exist.
- [ ] Preview build on a physical phone.

---

## Backlog — additions beyond the register

Not defects. Things the app doesn't do that it plausibly should, given what it already collects.

| # | Addition | Why | Earliest |
|---|---|---|---|
| 1 | Symptoms plotted against risk score | Once symptoms sync (A-02), Trends can show which symptoms move with the score. The insight the app implicitly promises. Strong dissertation result. | After phase 01 |
| 2 | Export a clinician summary (PDF) | The result screen already says "take this to them". One page: score, trend, symptoms, cycle history, medications. Clearest evidence of real-world utility. | Phase 04 |
| 3 | Compare against your last assessment | You store history and show a delta. Showing which *answers* changed is far more actionable than a score moving six points. | Phase 04 |
| 4 | Streaks and gentle nudges | Longitudinal data is what makes the model useful. Logging has to become a habit. | Phase 04 |
| 5 | Forum moderation — report, block, delete | Anonymous health community with no report button and no delete UI, despite the API supporting deletion. | Phase 05 |
| 6 | In-app education replacing dead links | 3–4 short pieces (insulin resistance, cycle irregularity, what a screening result means). Works offline; gives the Home "Reading" card something real. | Phase 05 |
| 7 | Biometric app lock | Menstrual + medication history on a shared handset. `expo-local-authentication`, one Settings toggle. | Phase 06 |
| 8 | Lab result tracking (LH / FSH / testosterone) | Root README lists it as a feature; no screen implements it. The reports upload endpoint already exists. Build it or drop the claim. | Optional |

---

## Findings index

Full evidence and per-finding fixes: https://claude.ai/code/artifact/98cb9b54-cd15-4724-8d82-c6b8df9b68ae

### A — Session & data integrity
| ID | Severity | Finding | Phase |
|---|---|---|---|
| A-01 | Critical | Auth tokens never persisted — nobody stays logged in | 01 |
| A-02 | Critical | Symptom/cycle/mood/medication logs never leave the device | 01 |
| A-03 | Major | Assessment answers lost on backgrounding | 01 |
| A-04 | Major | `topFeatures` computed, shown once, discarded | 01 |
| A-05 | Minor | Column casing patched in UI, not at the boundary | 01 |

### B — Crashes & broken paths
| ID | Severity | Finding | Phase |
|---|---|---|---|
| B-01 | Critical | `useRouter()` at module scope crashes Mental Wellbeing | 00 |
| B-02 | Critical | Edit Profile dismisses keyboard every keystroke | 01 |
| B-03 | Critical | `app.json` points at image assets that don't exist | 06 |
| B-04 | Major | Google sign-in "succeeds" then every request 401s | 02 |
| B-05 | Major | Facebook login wired to a placeholder | 02 |
| B-06 | Major | "Forgot Password?" has no handler and no backend route | 02 |
| B-07 | Major | No error boundary anywhere | 05 |
| B-08 | Minor | Phantom `assessment` tab route | 06 |
| B-09 | Minor | Orphan `App.js`; README documents a project that doesn't exist | 06 |
| B-10 | Minor | 6 lint errors, 16 warnings (TS is clean) | 06 |

### C — Truthfulness & content
| ID | Severity | Finding | Phase |
|---|---|---|---|
| C-01 | Critical | Notification toggles schedule nothing | 04 |
| C-02 | Major | Fabricated forum counters | 02 |
| C-03 | Major | Fictional fallback identity on Profile | 02 |
| C-04 | Major | Invented clinical statistics stated as fact | 02 |
| C-05 | Major | Named drugs at specific doses as one-tap presets | 02 |
| C-06 | Major | Adherence % wrong for anything non-daily | 02 |
| C-07 | Minor | All Wellness Library links point to example.com | 05 |
| C-08 | Minor | Internal FR-IDs printed in screen headers | 02 |
| C-09 | Minor | Four product names inside one binary | 02 |
| C-10 | Minor | Timezone note factually wrong, describes absent logic | 02 |
| C-11 | Major | Mindfulness history showed 3 fabricated sessions ✅ | 03 |
| C-12 | Major | Breathing sessions never persisted at all ✅ | 03 |
| C-13 | Minor | Completion screen asserted "Improved Relaxation" as achieved ✅ | 03 |

> C-11 to C-13 were found during the phase-03 migration, not in the original audit. Totals above count the original 54.

### D — Model input pipeline
| ID | Severity | Finding | Phase |
|---|---|---|---|
| D-01 | Critical | `fast_food` always 0 for every user | 01 |
| D-02 | Major | Four model features are constants | 01 |
| D-03 | Minor | `avgPeriodDuration` collected, never used | 01 |

### E — Design system, interaction, IA
| ID | Severity | Finding | Phase |
|---|---|---|---|
| E-01 | Major | Redesign reached 5 of 24 screens | 03 |
| E-02 | Major | Dark mode broken (not absent) on 19 screens | 03 |
| E-03 | Major | Emoji doing the job of an icon set | 03 |
| E-04 | Major | Cycle tracker has no calendar, prediction or analysis | 04 |
| E-05 | Major | No onboarding, no consent, no data explanation | 05 |
| E-06 | Major | No offline behaviour — silent catches or modal alerts | 05 |
| E-07 | Minor | Notification settings exist twice, in two designs | 03 |
| E-08 | Minor | Profile reachable three ways, Settings two | 03 |
| E-09 | Minor | Three pushed screens have no back affordance | 03 |
| E-10 | Minor | Native `Picker` unthemeable, no dark mode | 03 |
| E-11 | Minor | `Alert.alert` for success confirmations | 03 |
| E-12 | Minor | No pull-to-refresh, skeletons or optimistic updates | 03 |
| E-13 | Minor | Water counter can't be corrected | 03 |

### F — Accessibility
| ID | Severity | Finding | Phase |
|---|---|---|---|
| F-01 | Major | `textTertiary` fails contrast at the sizes it's used | 03 |
| F-02 | Major | Glyph-only buttons announce the glyph, not the purpose | 03 |
| F-03 | Minor | Several touch targets under the platform minimum | 03 |
| F-04 | Minor | Reduced motion documented as a rule, never implemented | 03 |
| F-05 | Minor | Dynamic Type never tested | 03 |

### G — Release readiness
| ID | Severity | Finding | Phase |
|---|---|---|---|
| G-01 | Critical | Repo initialised, nothing ever committed | 00 |
| G-02 | Critical | No build config — no installable artefact exists | 06 |
| G-03 | Critical | API URL unreachable off-emulator, cleartext HTTP | 06 |
| G-04 | Major | No tests of any kind | 06 |
| G-05 | Major | Names and emails written to a plaintext auth log | 06 |
| G-06 | Major | No privacy policy, consent, export or account deletion | 05 |
| G-07 | Minor | `.env` not gitignored | 00 |
| G-08 | Minor | No crash reporting | 05 |

---

## What's already good — don't break it

Protect these while working through the above.

- `theme/tokens.ts` — a disciplined system with a stated direction ("clinical calm"). Keep the type scale, keep the 12px floor.
- `components/ui/*` — the kit is accessible by construction: split 44pt/48dp touch targets, real pressed states, `Field` refuses placeholder-only labels, `RiskMeter` announces its whole result as one sentence.
- `features/assessment/steps/result.tsx` — refuses to show SHAP attributions for a fallback estimate, and says plainly which one the user is looking at. The provenance card is the most distinctive thing in the app.
- `components/ui/TrendChart.tsx` — refuses to draw a trend from a single point.
- `features/assessment/components/StepLayout.tsx` — progress derived from `step`, so it can't drift.
- `lib/storage/index.ts` — correctly documents why the `pmos_` key prefix must not be renamed.

---

## Decision log

Record anything decided differently from the plan, with the date and the reason.

| Date | Finding | Decision | Reason |
|---|---|---|---|
| 2026-08-16 | B-04 / B-05 | Removed both social sign-in buttons rather than fixing them now | Neither could ever have worked. Facebook is wired to the literal `"YOUR_FACEBOOK_APP_ID"`; Google stores its own `id_token` as our bearer token, which `authMiddleware` can never verify, so the user appears signed in while every request 401s. Hiding is reversible; a login that silently fails is not. **Re-add Google once `/api/auth/google` exists.** |
| 2026-08-16 | B-06 | Removed "Forgot password" rather than leaving it | No handler, no backend route. A dead control costs more trust than an absent one. Re-add with the reset flow. |
| 2026-08-16 | Palette | Kept the existing `#1f7a7a` teal; did **not** adopt the skill's `#0891B2` cyan recommendation | The project's own system takes precedence, and the existing teal is darker — it clears 4.5:1 where the recommended cyan on `#ECFEFF` would not. |
| 2026-08-16 | E-01e | Migrated Cycle Tracker now and added derived stats, rather than waiting for the phase-04 rebuild | The screen had no header and no back button at all. Basic migration was needed regardless, and average/variation/next-expected is cheap once the data is already there. The month calendar is still phase 04. |
| 2026-08-16 | C-07 | Wrote the four library articles now, ahead of phase 05 | Migrating the screen without them would have produced prettier dead links to `example.com`. |

---

## Session log

Running notes — what changed, what broke, what's next.

### 2026-08-16 — audit
- 54 findings recorded. No code changed.

### 2026-08-16 — UI migration (phases 02 + 03)
**Closed 25 of 54 findings.** `tsc` clean, `expo lint` clean (was 6 errors / 16 warnings), 20/20 screens on the design system, 0 hardcoded colours, 0 emoji-as-icons.

Beyond the register, three problems were found and fixed during the work:

1. **Mindfulness history showed three fabricated sessions.** `history.tsx` held "Box Breathing · Today", "4-7-8 Relaxation · Yesterday" and "Calm Breathing · 2 Days Ago" in `useState` as literals, dated relative to today so they always looked current. A user who had never opened a session saw three they'd supposedly completed, and the empty state below was unreachable. **This belongs with C-02/C-03 as a fabrication, not a styling issue.**
2. **Breathing sessions were never persisted at all** — which is why the history screen had nothing real to show. Added `BreathingSession` storage; sessions now record on completion *and* when stopped partway.
3. **The breathing timer re-created a `setTimeout` on every tick** from a six-value dependency array, and navigated on completion from an uncleaned `setTimeout` — leaving the screen mid-countdown pushed a route onto an unmounted stack. Now a single interval with proper cleanup.

Also deleted `CountdownTimer`, `ExerciseCard` and `ProgressBar` from `features/mindfulness/` — nothing imported them, and they held the last 13 hardcoded colours in the app.

### 2026-08-16 — correctness (phase 01)
**Closed 7 more findings — 32 of 54.** `tsc` and `expo lint` both clean; backend files pass `node --check`.

- **A-01 done.** Tokens persist to the OS keychain. This was the biggest single bug in the app — nobody had ever stayed signed in, and the backend's entire refresh-rotation system had never executed once because the refresh token was gone before it could be used.
- **D-01 done and verified.** `fast_food` was 0 for every user who has ever been assessed. Checked all four values the app can send now map correctly.
- **D-02 done.** Waist/hip collected optionally; `pregnant`/`num_abortions`/`years_married` remain constants but are stripped from SHAP attributions, so the app can no longer explain a score using a number the user never gave.
- **A-03, A-04, A-05, G-03 done.**

**One correction to my own work:** I initially added `period_duration` to the ML feature vector as the D-03 fix, then checked `feature_names.pkl` — the model takes 16 features and that isn't one of them. The ML service ignores unknown keys, so it would have *looked* fixed while changing nothing. Removed, and D-03 is recorded as still open with the real constraint.

### 2026-08-16 — A-02, server sync
**Phase 01 complete (bar D-03, which needs a model retrain). 34 of 54 closed.**

Built the daily-log sync end to end: 3 tables, a controller, routes at `/api/logs`, a client write-ahead queue, and the three screens rewired. Health-log data now survives a reinstall.

Verified against a live server rather than assumed — including the cases that actually bite:
- replaying an operation 3× leaves **1 row** with the edit applied (idempotent upsert)
- a malformed op in a batch is `rejected` and dropped while its neighbours commit, so one bad row can't wedge the queue
- **user B cannot delete user A's row** by guessing the id
- notes are ciphertext in the database and plaintext to the owner
- production **refuses to boot** without `FIELD_ENCRYPTION_KEY` rather than silently storing health data in the clear

Two things worth flagging:
- I added `FIELD_ENCRYPTION_KEY` to the backend `.env`. **That file is still not gitignored** (G-07) — it now holds a real secret, so this matters more than it did an hour ago.
- A first encryption test appeared to fail; the cause was `pkill` not stopping the old server on Windows, so the test hit a stale process started before the key existed. Encryption was correct.

### 2026-08-16 — device setup + C-01 reminders
**37 of 54 closed. 8 of 10 criticals.**

Device testing set up ([DEVICE-TESTING.md](DEVICE-TESTING.md)) — `.env` for both projects, `npm run dev:ip` to survive DHCP changes, `.env.example` templates, and **G-07** and **B-03** closed along the way. The icon was cropped to the lotus alone; the source lockup's tagline and "PMOS Wellness" wordmark are illegible at 48dp.

**C-01 done.** Reminders are real now — three of them, all local, verified against 7 synthetic cycle histories. The prediction deliberately reuses the tracker screen's own rules so the two can never disagree.

The honest call on this one: **I deleted the "Community replies" toggle** rather than leaving it. It needs the server to send a push and nothing in the backend can — so it was a switch that could never do anything, which is precisely the failure C-01 describes. Same reasoning behind Settings now reporting denied OS permission and "needs two logged cycles" instead of just showing a switch in the on position.

### 2026-08-16 — E-04, cycle calendar
**Phase 04 complete. 38 of 54 closed.**

Built the month calendar and, more importantly, `lib/cycle/analysis.ts` — one module the tracker screen, the notification scheduler and assessment step 2 all read. The scheduler's duplicate copy of the prediction rules is deleted; two copies of a rule was one edit away from a reminder contradicting the calendar.

The assessment now pre-fills regularity from tracked dates rather than asking the user to describe it from memory — and shows the derivation, so it's evidence rather than an unexplained default. Override is one tap, and doing so removes the provenance card rather than leaving it claiming the logs were used.

**20 tests added** (`npm run test:logic`), dependency-free. The garbage cases are the ones that matter: a year-long entry would previously have looped unbounded building calendar keys, and `toISOString` would have put an 11:30pm log on the wrong day.

### 2026-08-16 — Groq reliability (correction)

**I called the Groq integration "verified end-to-end" on the basis of three successful
generations. That was wrong.** It was working roughly **half the time** and silently
falling back the rest — which is exactly the failure mode the fallback was designed to
hide. Caught by the user seeing `[GROQ] Response failed validation` in their logs.

Measured over repeated runs, the real failure modes were:

| Cause | Notes |
|---|---|
| HTTP 429 | Free tier is tight on `gpt-oss-120b`; most common failure |
| HTTP 400 | Model intermittently fails strict JSON mode |
| Validation | One bad suggestion discarded **all four** |

Three fixes:

1. **Retry with backoff** — two attempts on the primary model, then one on
   `gpt-oss-20b`, which is far less rate-limited. Honours `Retry-After`.
2. **Salvage partial batches** — individual suggestions are dropped, not the whole
   response, provided two survive. A single mention of a supplement was throwing away
   three perfectly good suggestions.
3. **Loosened two over-broad rules** that were rejecting harmless output: `"treat your"`
   matched *"treat yourself to an early night"*, and the numeric rule killed any
   frequency or duration — so *"walk on three days a week"* was banned. Percentages and
   outcome timeframes (*"within 3 months"*) are still blocked, as are doses, via
   tighter patterns.

**Re-measured, not assumed:** 9/10 through the real endpoint back-to-back, **5/5** at
realistic spacing (one call per assessment). Safety suite expanded to **21 tests** —
still blocks every drug, dose, percentage and diagnosis case.

**Also fixed a gap this surfaced:** the guidance call sat *inside* the `try`, after
`setSource("model")`. So an unreachable ML service cost the user their personalised
suggestions as well as their real score — even though the guidance derives from their
**answers**, not the score. It now runs on both paths, which is when it matters most.

### 2026-08-16 — profile picture upload

The backend endpoint (`PUT /users/profile/picture`), the multer config, the
`profilePicture` column and the static `/avatars` route **all already existed**.
Nothing in the app ever called any of it — `setAvatarUri` in `authContext` only set
local React state, so a picture appeared to change and then vanished on next launch.

- Installed `expo-image-picker`; new `lib/media/pickImage.ts` handles permissions
  (distinguishing *denied* from *permanently blocked*, since the OS ignores repeat
  prompts for the latter), square cropping, and compression to stay under the
  server's 5MB cap rather than discovering it as a failed upload.
- New `components/ui/Avatar.tsx` — photo → initials → glyph, with a camera badge when
  editable. Shared by the profile screen and the menu card, which each had their own
  circle before.
- `uploadAvatar` in `authContext` does an optimistic local swap, uploads, then
  refreshes from the server, **rolling back the preview on failure** so nobody is left
  looking at a picture that was never saved.
- iOS gets a native action sheet (camera / library), Android an equivalent `Alert`.
- Declared `photosPermission` / `cameraPermission` in `app.json` — iOS rejects builds
  that use the picker without them.

**Cache-busting was necessary, and I verified why rather than assuming.** The server
names every upload `avatar-<userId>.<ext>`, so a replaced picture returns an
*identical URL*. Tested: two different images, same path, 82 → 88 bytes on disk. The
file genuinely changes; only the client cache would show the old one. Hence
`avatarVersion` in the auth context feeding `resolveAssetUrl`.

**Verified end-to-end against the running backend:** null before upload → path
returned → profile reflects it → servable at that path (HTTP 200, correct
`image/png`) → non-image rejected → 401 without auth.

### 2026-08-16 — result-screen flash + Groq guidance

**🔴 The result screen showed a wrong score before the real one.** `result.tsx` computed
`modelResult?.score ?? localScore`, so the moment the screen mounted it rendered the
**local fallback** figure — a number, a filled arc, a colour and a risk band — captioned
"Calculating…", then silently swapped to the model's answer. Someone reading "68, high
risk" and then seeing "34, moderate" has been told two different things about their
health, and the first is the one that sticks.

`RiskMeter` now takes `pending`, and while pending draws **no figure, no arc and no
level badge** — a spinner and "Working out your result…" instead. Nothing is claimed
until there is something true to claim.

**Groq-generated guidance.** New `src/services/groqService.js` + `POST
/api/predictions/recommendations`.

- **Server-side only.** A key in a mobile bundle is a published key, `EXPO_PUBLIC_`
  prefix or not.
- **Fired after the score is on screen**, never before — the result must not wait on a
  language model. If it fails, the built-in suggestions are already rendered.
- **The guardrails are the feature.** This project has spent a lot of effort removing
  invented health claims; an LLM is the easiest way to reintroduce them at scale. The
  model is instructed never to state a statistic, name a medication or supplement, give
  a dose, or diagnose — and the output is then **checked** for all of it, because an
  instruction is not an enforcement mechanism. Anything failing validation is discarded
  whole and the built-ins are used. **16 validator tests**, all passing.
- Generated content is **labelled as generated** in the UI.
- **Model chosen by testing, not assumption.** `llama-3.3-70b-versatile` (my first
  guess) 404s on this account. `openai/gpt-oss-20b` and `qwen/qwen3.6-27b` both fail
  strict JSON mode. `openai/gpt-oss-120b` returns valid, rule-respecting JSON in ~2s.
- Verified end-to-end across three answer profiles; suggestions correctly adapt
  (sedentary → short walks, fast food → swap a meal, already active → keep it up).

⚠️ **A real `GROQ_API_KEY` was briefly pasted into `.env.example`, which is committed
by design.** It is now only in the gitignored `.env`, and since the repo has **zero
commits** it never left this machine. Rotating it at
[console.groq.com/keys](https://console.groq.com/keys) is still the cautious move.

### 2026-08-16 — Neon migration + keyboard audit

**Neon PostgreSQL** — see [NEON-MIGRATION.md](NEON-MIGRATION.md). The backend already
spoke both engines, but would not have survived the switch:

- **TLS was keyed on `NODE_ENV === "production"`.** Neon requires it on every
  connection, so any non-production run would have failed with a misleading
  "server does not support SSL" error. Now decided by the connection string.
- **Column casing — the one that would have hurt.** Postgres folds unquoted
  identifiers to lower case, so `row.fullName` becomes `undefined`. SQLite
  preserves case, which is why it never showed. ~30 identifiers read by six
  controllers would have broken **quietly** — blank names, missing timestamps,
  notification toggles all false. Fixed centrally with `restoreCase` in
  `config/database.js` rather than editing six controllers.
- Pool tuned for Neon's scale-to-zero, plus a `pool.on("error")` handler — without
  one, a routine idle-connection reset is an uncaught exception that kills the process.
- New `scripts/verify-db.js`: creates a throwaway user, exercises all 10 tables,
  checks 12 columns for casing, tests the sync queue's upsert, cleans up. **33/33 on
  SQLite** — I have no Neon credentials, so run it after pasting your `DATABASE_URL`.

**Keyboard audit — all screens.** `Screen` wrapped everything in a
`KeyboardAvoidingView` with `behavior="padding"`, which is the wrong tool around a
ScrollView: it stops the keyboard covering the *view* but never scrolls the focused
field into sight, so on signup or edit-profile you still type blind. Replaced with
`automaticallyAdjustKeyboardInsets` (iOS) — which insets *and* scrolls the field in —
with Android covered by the manifest's `adjustResize`. KAV is now used only for
non-scrolling screens, where it is correct.

- **The forum had no keyboard handling at all** — it manages its own `FlatList` and
  never went through `Screen`, so the per-post reply box sat directly under the
  keyboard. That was the worst case in the app.
- Medication's add-sheet gets `edges={[]}` so the Modal's safe area isn't applied twice.
- Verified: every screen with an input is now covered.

**Auth screens — a second pass.** `Screen`'s fix makes fields *reachable*, but login and signup vertically centre their content around a ~200pt brand block. With the keyboard up there is roughly 340pt of usable height and signup has **four** fields, so "Confirm password" ended up behind the keyboard — scrollable, but nobody should have to scroll a signup form.

- New `lib/hooks/useKeyboard` (iOS `keyboardWillShow` so the layout moves *with* the animation, not after it).
- Both screens **collapse the logo and subtitle while typing** and switch from centred to top-aligned. The brand is decoration on a screen the user has already committed to; the password field is not.
- **`Field` now forwards its ref.** Without that `returnKeyType="next"` was decorative — the keyboard showed a "Next" key that did nothing, because there was no handle to call `.focus()` on. Login chains email → password → submit; signup chains name → email → password → confirm → submit, with `blurOnSubmit={false}` so the keyboard stays up between fields.
- Not done: the same focus chaining would help `edit-profile` (4 fields) and the assessment steps. Say the word.

### 2026-08-16 — Phase 05
**42 of 54 closed.** `tsc`, `expo lint`, backend `node --check` and the 20 cycle tests all clean.

Onboarding with a real consent gate, a privacy screen, working data export, working account deletion, a sync-status banner and a root error boundary.

**The important part of this phase was a bug my own test found.** Account deletion was not durable: `authMiddleware` checked the JWT signature but never that the account still existed, so a deleted user's token kept working — and since every write is an upsert keyed on user id, a client that kept posting **recreated rows for the deleted account**. Confirmed with a POST returning `{"synced":true}` after deletion. Fixed in the middleware and re-verified end to end: 401 on every call, zero orphan rows.

That one mattered more than anything else in the phase. A delete-my-data feature that doesn't actually delete is worse than not having one.

**G-08 (Sentry) is the only Phase 05 item left** — it needs a DSN from your account. The error boundary's `onError` is the wiring point.

- **Next:** Phase 06 — `eas.json` (**G-02**, the last non-git critical), TLS, the remaining G-04 tests, and stripping PII from the auth logs (**G-05**).
- ⚠️ **Git still uncommitted** (deferred by request). ~55 files changed across app and backend.
