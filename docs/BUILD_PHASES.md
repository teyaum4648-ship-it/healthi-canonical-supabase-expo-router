# Healthi Build Phases

This is the recommended implementation order for Codex or any coding agent. Build one layer at a time. Do not ask the agent to build the entire product at once.

## Phase 1: Foundation

Implement:

- Expo app.
- TypeScript.
- Expo Router.
- Supabase client.
- Environment variables.
- Auth screens: signup, login, logout.
- Protected navigation.
- Tabs: Dashboard, Movement, Food, Progress, Settings.
- Reusable components: Screen, Card, Button, TextInput, SectionHeader.
- Profiles, settings, consent tables.
- RLS policies.

Do not implement:

- Readiness scoring.
- Workouts.
- Food logging.
- AI.
- Payments.
- Wearables.

## Phase 2: Onboarding

Implement:

- One-question-per-screen flow.
- Progress bar.
- Save draft locally.
- Submit answers to Supabase.
- Create baseline profile.
- Goal selection.
- Sleep/circadian questions.
- Stress/life load questions.
- Digestion questions.
- Food constraints.
- Hydration/stimulants.
- Training history.
- Injuries/limitations.
- Movement assessment.
- Posture self-screen.
- Equipment/schedule.

Tests:

- Baseline profile generation.
- Resume incomplete onboarding.
- Allergy persistence.
- Calibration status.

## Phase 3: Metrics and scoring

Implement:

- Metric observation model.
- Sleep logs.
- Hydration logs.
- Daily check-ins.
- Stress assessments.
- Foundation scores.
- Readiness scores.
- Allostatic load scores.
- Reason code system.
- Confidence system.

Tests:

- High sleep debt -> restore.
- Good recovery -> build.
- Pain flag -> correct.
- Under-fueled -> maintain.
- Missing HRV -> lower confidence, no score penalty.

## Phase 4: Morning Briefing and Dashboard

Implement:

- Morning Briefing generation.
- Daily priority.
- Day mode.
- Daily protocol.
- Circadian curve.
- Readiness display.
- Foundation score cards.
- Today's movement plan summary.
- Food strategy summary.
- Hydration card.
- Sleep debt card.

Tests:

- Briefing uses latest metrics.
- Briefing stores reason codes.
- Briefing handles missing data.

## Phase 5: Movement and training

Implement:

- Exercise library schema.
- Movement pattern permissions.
- Training plans.
- Training sessions.
- Exercise set logging.
- Progression gate.
- Progression target generator.
- Session outcome classifier.
- Restore/Rebalancing sessions.

Tests:

- Block loaded exercise on blocked pattern.
- Permit one progression target when ready.
- Do not count progression if pain/form/range worsened.
- Replace workout with restore session on high allostatic load.

## Phase 6: Food response

Implement:

- Food items.
- Food logs.
- Food response logs.
- Pattern confidence.
- Food Fit Score.
- Personal power foods.
- Foods to reduce.

Tests:

- 1 log -> single response.
- 3 logs -> early signal.
- 5 logs -> emerging pattern.
- 8 logs -> consistent pattern.
- Personal response can override product quality.
- Allergies override everything.

## Phase 7: Shopping and recipes

Implement:

- Meal plans.
- Recipes.
- Shopping lists.
- Shopping assistant engine.
- Costco-style prompt support.
- Store context.
- Budget mode.
- Recovery mode.
- Performance mode.

Tests:

- Uses high-response foods.
- Avoids low-response foods.
- Avoids new foods on restore days.
- Builds recipes and prep plan.

## Phase 8: Barcode and product evaluation

Implement:

- Camera scanner.
- Backend food database lookup.
- Ingredient parser.
- Product quality score.
- Product fit score.
- Scan-to-log.
- Scan-to-shopping-list.

Tests:

- Product without personal history uses medium confidence.
- Product with poor personal response is not recommended today.
- Allergy blocks product.

## Phase 9: AI practitioner

Implement:

- AI consent.
- Chat UI.
- AI context snapshots.
- Backend AI function.
- Safety constraints.
- Explain morning briefing.
- Explain workout change.
- Build shopping list.
- Generate recipes.

Tests:

- AI cannot override safety.
- AI cannot invent data.
- AI respects allergies.
- AI uses structured context.

## Phase 10: Wearables and subscriptions

Implement:

- HealthKit.
- Health Connect.
- Metric source priorities.
- Wearable sync.
- RevenueCat entitlements.
- Trial/paywall.
- Subscription status.

Tests:

- Wearable data overrides manual baseline where permitted.
- Disconnect wearable stops sync.
- Entitlement gates premium features.
