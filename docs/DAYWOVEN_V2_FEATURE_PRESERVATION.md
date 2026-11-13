# Daywoven V2 redesign: feature-preservation contract

## Status
Design work branch only. This plan documents the existing routes/components inspected on the launch codebase and the required regression checks. It does not certify native TestFlight behavior.

## Approved UX direction
**Track → Understand → Plan.** Low-friction logging and one obvious daily direction by default; interactive explanations and full analytics available progressively. Design reference: user-approved Daywoven interactive prototype (charcoal #0C0E13, elevated #151920, blue #9FCCFF, lavender #B6B2FA, peach #FFC6A6). No decorative forest imagery or universal lime theme.

## Preservation inventory (no feature deletion)

| Area | Existing route / implementation | Must remain available after redesign |
| --- | --- | --- |
| Home readiness | `app/(app)/(tabs)/index.tsx`, `features/dashboard/ReadinessNowCard.tsx`, `premium/ReadinessHub.tsx`, `engines/readiness` | Account/demo modes, confidence, current estimate and explanations, safe guidance, check-ins |
| Home daily direction | `features/dailyProtocol`, `features/morningBriefing`, `/protocol`, `/plan` | Primary action, rationale, complete protocol, schedule/calendar |
| Quick logging | `features/dashboard/LoggingPromptsPanel.tsx`, `features/navigation/navigationModel.ts`, `features/nutrition/quickWater.ts` | Food, water with undo, workout, sleep, check-in; existing storage and routes |
| Biomarkers | `premium/BiomarkerTimeline.tsx`, `premium/BiomarkerEntrySheet.tsx`, `premium/BiomarkerBreakdown.tsx` | Trend, history, manual entry, score breakdown |
| Weekly summaries | `features/dashboard/WeekFlipCard.tsx`, `WeeklyRecap.tsx`, `app/(app)/(tabs)/progress.tsx` | Sleep/diet/movement/mood cards, recap, trends |
| Sleep | `app/(app)/(tabs)/rhythm.tsx`, `features/sleepRhythm/SleepEnergyChart.tsx`, `engines/circadian` | Sleep data, sleep/energy curves, chronotype, timing guidance, habit logs |
| Nutrition | `app/(app)/(tabs)/food.tsx`, `features/nutrition/productLookup/`, `FoodQualityReviewPanel.tsx`, `MealDiarySections.tsx`, `HydrationCard.tsx` | Meal/diary/log editing, barcode/lookup, product quality and reasoning, macro/micronutrients, water |
| Movement | `app/(app)/(tabs)/movement.tsx`, `features/movement/`, `engines/movement` | Training load, session logging, recommendations, mobility, workout history |
| Mood / mind | `app/(app)/(tabs)/mood.tsx`, `features/practice/` | Mood check-ins, breathing practice, stress load, reflection and historical data |
| Onboarding | `app/(onboarding)/index.tsx`, `features/onboarding/` | Anonymous questionnaire, personalized results and score engines, account-save handoff |
| Accounts / subscription | `app/(auth)/`, `app/paywall.tsx`, `app/app-preview.tsx`, `features/subscriptions/` | Auth, paywall, verified access, restore purchases, informational preview |
| Security and privacy | Auth provider, Supabase persistence, account deletion, Apple Health permissions | No data model changes, no additional data sharing, no weakened paywall checks |

## Implementation guardrails
- Protect `main`: all redesign commits are scoped to `design/daywoven-v2-ux-preserve-features`.
- Keep each calculator, data source, save/restore path, and route unchanged unless a verified bug demands a specific fix.
- Don't conceal safety notices inside an optional expansion.
- Never fake readiness numbers or infer causal health claims from missing data.
- Support new users with no observations: show a log-first CTA rather than a made-up score.
- Add responsive and accessible controls; use semantic labels and useful touch sizes.
- Leave premium gating and server-side entitlement verification untouched.

## Phase 1: Home layout (initial slice)
1. Keep existing readiness, metrics, biomarker management, focus check, weekly recap, and protocol components.
2. Promote one actionable daily direction, backed by the existing `primaryAction`/protocol.
3. Put existing five Quick Log actions before analytics.
4. Present deeper readiness and physiological metrics behind an explicit "Explore your analysis" disclosure, including the full original controls; show safety notices above it.
5. Provide clear entry points to energy rhythm, food intelligence, movement guidance, and weekly trends.

## Verification checklist
- Both demo and logged-in Home render without crashes.
- A first-time user can initiate the correct sleep, food, water, workout, and check-in action.
- Water undo still works and failed saves remain visible.
- Readiness explanation/details and manual biomarker sheets remain accessible.
- Complete weekly data and recap remain navigable.
- Safety warning is always visible when safety status requires it.
- Disabled/restricted accounts do not bypass the paywall.
- Run TypeScript, unit tests, lint, Expo checks in CI. Real iOS testing is still required.

## Future phases
Sleep/energy interaction → food quality/scan → movement decisions and workout form correctness → mind/logging → onboarding/results/paywall. Each phase must reconcile this inventory before merging.
