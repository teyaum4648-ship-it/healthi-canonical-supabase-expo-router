
# Healthi Agent Operating Rules

Healthi is a holistic adaptive wellness coaching app.

The product is inspired by whole-person health principles: recovery, nourishment, movement, stress, lifestyle load, personal response, and daily adaptation all interact.

Healthi is not a medical device.

Healthi is not a diagnosis app.

Healthi is not a calorie app, not merely a workout app, not merely a sleep dashboard, and not a barcode scanner with extra ambition.

Healthi’s purpose is to help a user understand what their body likely needs today: restore, nourish, correct, move, or perform, and why.

## Canonical project paths

Active development folder:

`/Users/korranish/Projects/healthi-canonical-supabase-expo-router`

USB archive/canonical backup folder:

`/Volumes/MARCY/Healthi/supabase-expo-router-app`

Rules:

* Use the internal active development folder for npm, Expo, typecheck, tests, and coding.
* Do not run npm install, Expo, tests, or active development commands from the USB drive.
* Do not modify `fresh-expo-app`.
* Do not use `fresh-expo-app` as the app source.
* `fresh-expo-app` may only be used as an asset reference if explicitly approved.

## Expo version rule

This project currently uses Expo SDK 55.

Do not assume Expo SDK 56 behavior unless the project is intentionally upgraded.

Do not upgrade Expo unless the user explicitly approves an upgrade task.

Do not change package versions unless a concrete install, typecheck, or runtime error requires it.

## Build discipline

Do not build the whole PRD in one pass.

Work one approved task at a time.

The normal loop is:

1. Read `CURRENT_PHASE.md`.
2. Read `TASK_QUEUE.md`.
3. Identify the next incomplete approved task.
4. Inspect relevant files.
5. State the intended plan.
6. Edit only allowed files.
7. Run verification.
8. Summarize changes.
9. Stop.

Never continue into the next task automatically unless the user explicitly asks.

## Before editing files

Before modifying any files:

1. Run `pwd`.

2. Confirm the working directory is:

   `/Users/korranish/Projects/healthi-canonical-supabase-expo-router`

3. Run `git status --short`.

4. If Git status is not clean, summarize existing changes and ask before proceeding.

5. Read the relevant existing files.

6. State:

   * the task,
   * the files expected to change,
   * the files that will not be touched,
   * the verification commands that will be run.

7. Wait for approval unless the user explicitly says to proceed.

## After editing files

After modifying files:

1. Run `npm run typecheck` when relevant.
2. Run `npm run test` when relevant.
3. Fix only errors related to the current task.
4. Do not fix unrelated issues unless asked.
5. Show changed files.
6. Summarize what changed.
7. Summarize verification results.
8. Summarize risks or follow-ups.
9. Stop.

## Git rules

Use Git as a checkpoint system.

Before a task:

* Confirm clean status.

After a successful task:

* Show changed files.
* Suggest a commit message.
* Do not commit unless explicitly approved.

Never force push.

Never reset hard unless explicitly approved.

Never delete files unless explicitly approved.

## Product philosophy

Healthi should evaluate the user as a whole system.

Use original Healthi language:

* Recovery + Rhythm
* Nourishment
* Movement Capacity
* Mind + Life Load
* Foundation Scores
* Daily Priority
* Day Mode
* Rebalancing Session
* Restore Session
* Daily Protocol
* Morning Briefing

Do not copy, reproduce, or imitate proprietary questionnaires, diagrams, exercise instructions, course language, trademarks, or branded methodology from Paul Chek, C.H.E.K Institute, HLC, How to Eat, Move and Be Healthy, 4 Doctors, Primal Pattern, WHOOP, Oura, Rise, Yuka, Bobby Approved, or any other source.

Do not use consumer-facing terms like:

* CHEK
* C.H.E.K
* HLC
* 4 Doctors
* Primal Pattern
* Work-In

unless the user explicitly says licensing has been handled.

Use original abstractions and original wording.

## Safety and language rules

Healthi is a general wellness product.

Do not use diagnosis, treatment, cure, prescription, or clinical certainty language.

Do not claim Healthi measures hormones, cortisol, adrenal function, disease states, clinical conditions, or medical conditions unless actual lab data and licensed clinical scope exist.

Do not encourage training through pain.

Do not override allergies, safety flags, professional guidance states, blocked movement patterns, or user consent settings.

Avoid these words or phrases in consumer-facing text:

* diagnose
* treatment
* cure
* prescribe
* adrenal fatigue
* HPA fatigue
* cortisol reset
* hormone repair
* hormone balancing protocol
* clinical assessment
* medical decision
* guaranteed
* detox disease claim

Use safer wellness language:

* suggests
* may indicate
* estimated
* general guidance
* wellness guidance
* flag
* screen
* calibration
* confidence
* consider consulting a qualified professional

## Engine rules

Deterministic engines are the source of truth.

AI is not the source of truth.

AI may explain structured outputs, but must not override:

* safety flags
* allergies
* professional guidance states
* movement blocks
* pattern permissions
* score confidence
* reason codes
* user consent settings

Every score must include:

* score
* confidence
* reasons or reason_codes
* limiting factors where relevant

Every recommendation must include:

* reason codes,
* user-facing explanation,
* confidence or uncertainty when data is incomplete.

Missing data must lower confidence.

Missing data must not automatically lower the user’s score.

The app must remain deterministic and testable.

## Onboarding rules

Onboarding creates an initial baseline.

Onboarding must not create a diagnosis.

Onboarding must not create full readiness scoring unless explicitly approved.

Onboarding output should remain conservative.

The first 7 to 14 days should be treated as calibration.

Baseline output should include:

* `calibration_status: "calibrating"`
* sleep need estimate
* hydration target
* food constraints
* training capacity
* movement flags
* posture flags where available
* stress tendencies
* digestion tendencies
* primary goal
* initial foundation scores
* confidence
* reason codes

Onboarding should collect enough data for the next engine phase without pretending to know everything.

## Onboarding safety cleanup rules

Rename unsafe or medical-sounding internal tags before they spread further.

Use these replacements:

* `hpaFatigue` -> `highStressLoad`
* `bloodSugarDysregulation` -> `energyStabilitySignal`
* `gutHealer` -> `digestionSupport`
* `hormone_rhythm_support` -> `recovery_rhythm_support`
* `supplementFocus` -> `supportFocus`

For v1, do not recommend supplement protocols or supplement dosing.

If supplement-related wording exists, replace it with general lifestyle support, food-first support, hydration, sleep, movement, or professional-review language.

## Database rules

Every user-owned table must include `user_id`.

RLS must be enabled on every public user-owned table.

Users may only read/write their own rows.

Do not add migrations without explaining:

1. why the table or column is needed,
2. what writes to it,
3. what reads from it,
4. what RLS policy protects it.

Do not create tables casually.

Do not change existing migrations unless the task specifically requires it.

Prefer additive migrations over destructive schema changes.

## Supabase onboarding write rules

When reviewing or changing onboarding submission, verify:

* `assessment_sessions` insert works.
* `assessment_answers` insert works.
* `baseline_profiles` insert works.
* `food_constraints` insert works if food constraints exist.
* `onboarding_plan_results` insert works if that table exists.
* `profiles.onboarding_status` updates to `completed`.
* All writes are scoped to the authenticated user.
* RLS policies allow only the owner to read/write their own rows.
* Partial failure states are handled clearly.

## UI rules

Healthi UI should feel:

* calm,
* premium,
* readable,
* low-noise,
* non-guilt-based,
* non-alarmist.

Avoid:

* noisy gamification,
* shame language,
* aggressive red alerts except safety,
* fake medical certainty,
* cluttered screens.

Prefer:

* one primary action per screen,
* clear hierarchy,
* readable type,
* warm but direct language.

## Testing rules

Do not treat a task as done until relevant tests pass or a clear blocker is reported.

When adding engine logic, add tests.

For onboarding/baseline logic, tests should cover:

* calibration status,
* confidence handling,
* missing data behavior,
* food allergies/constraints,
* training experience,
* movement limitations,
* sleep signals,
* stress signals,
* digestion signals,
* reason codes,
* absence of diagnosis-like language.

## Dependency rules

Do not upgrade Expo.

Do not change package versions unless required by a concrete install or compile error.

Do not add dependencies when a small local function would work.

Ask before adding native modules.

If a script exists but the package is missing:

* If `npm run typecheck` fails because `tsc` is missing, propose adding `typescript` as a dev dependency.
* If `npm run test` fails because `vitest` is missing, propose adding `vitest` as a dev dependency.

Do not install dependencies from the USB path.

## Response format after every task

Use this format:

### Task completed

Summary:

Files changed:

Verification:

* Typecheck:
* Tests:

Risks:

Next recommended task:

Stop here.

