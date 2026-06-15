# Food Personalization + Day Planning Spec

## 1. Purpose

Healthi's nutrition system should evolve from basic meal tracking into a calm, adaptive planning layer that understands how food, rhythm, readiness, training, and the user's actual day fit together.

This spec designs two connected future systems:

- Food Personalization / Food Pattern System.
- Day Planning / Calendar-Aware Recommendation System.

The goal is not to prescribe a diet or create rigid meal plans. The goal is to help Healthi form a cautious food hypothesis, learn from logged meals and post-meal responses, and suggest meal timing or meal style that fits the user's day.

These systems should eventually help Healthi answer:

- What fueling style seems to support this user best?
- Which meal patterns tend to support steadier energy, digestion, and appetite?
- What kind of meal fits the next schedule window?
- When should the user eat around training, deep work, and wind-down?
- What should Daily Check-In ask because the engine cannot infer it yet?
- How confident is Healthi in the suggestion?

This is design/spec only. No Meal Logging UI, migrations, calendar sync, AI, barcode, OCR, external APIs, or native permissions are included here.

## 2. Product Boundary

The Food Pattern Test may use broad internal category inspiration from meal-response and fueling-style frameworks, but Healthi must use original language, original labels, and conservative wellness claims.

Preferred public names:

- Food Pattern Test.
- Food Response Profile.
- Fueling Style.
- Meal Response Score.
- Fueling Fit.
- Post-Meal Response Log.
- Day Plan.
- Rhythm-Aware Schedule.
- Energy Windows.

Avoid public names and claims that imply a proprietary framework, diagnosis, treatment, or fixed identity. Do not say the user has a permanent food type. Healthi should say it is forming a hypothesis and improving confidence over time.

Good copy:

- `Your recent meal responses suggest steadier energy with a protein-forward breakfast.`
- `A lighter dinner may support tonight's wind-down window.`
- `Training later today may call for a more supportive pre-session meal.`
- `Healthi is still calibrating your food response.`

Bad copy:

- `This is your metabolic type.`
- `You cannot tolerate carbs.`
- `This will fix your hormones.`
- `Treatment diet.`
- `Detox meal.`

## 3. Food Pattern Test

The Food Pattern Test should live inside the Food section, not original onboarding.

Purpose:

- Create a baseline food preference and response hypothesis.
- Give Healthi a starting point before enough meal logs exist.
- Make future recommendations feel personalized without pretending certainty.

Recommended Food section placement:

- Food tab -> Insights or Setup area -> Food Pattern Test.
- The test can be re-run or manually adjusted later.
- It should not block core app use.

Question areas:

- Preferred meal size: lighter meals, moderate meals, larger meals.
- Energy after higher-carb meals.
- Energy after higher-protein/fat meals.
- Hunger frequency and meal spacing.
- Cravings pattern.
- Digestion comfort.
- Appetite stability.
- Response to skipping meals.
- Response to late meals.
- Training-day fueling needs.
- Sleep after heavier dinners.
- Caffeine sensitivity, when relevant.

Output principles:

- Return a hypothesis, not a verdict.
- Include confidence and reason codes.
- Use labels that are useful for planning, not identity labels.
- Allow adaptive updates from logged meals and post-meal responses.

Suggested type:

```ts
type FoodPatternProfile = {
  id?: string;
  user_id?: string;
  created_at: string;
  updated_at: string;
  source: 'food_pattern_test' | 'manual_adjustment' | 'adaptive_update';
  confidence: 'low' | 'medium' | 'high';
  pattern_label:
    | 'steady_balanced'
    | 'protein_forward'
    | 'carb_supported'
    | 'lighter_frequent'
    | 'evening_sensitive'
    | 'calibrating';
  macro_tendency: {
    protein: 'lower' | 'moderate' | 'higher';
    carbs: 'lower' | 'moderate' | 'higher';
    fat: 'lower' | 'moderate' | 'higher';
  };
  meal_timing_tendency: {
    breakfast: 'optional' | 'helpful' | 'important';
    meal_spacing: 'shorter' | 'moderate' | 'longer';
    late_meal_sensitivity: 'low' | 'medium' | 'high';
  };
  response_tendencies: {
    digestion: 'steady' | 'sensitive' | 'unknown';
    energy: 'steady' | 'dip_prone' | 'unknown';
    appetite: 'stable' | 'hungry_soon' | 'unknown';
  };
  reason_codes: string[];
};
```

Possible reason codes:

- `food_pattern_test_completed`
- `protein_forward_preference`
- `carb_supported_training`
- `higher_carb_energy_dip`
- `higher_protein_steady_energy`
- `shorter_meal_spacing_helpful`
- `late_meal_sensitivity_reported`
- `breakfast_supportive_reported`
- `digestion_sensitivity_reported`
- `food_pattern_calibrating`

## 4. Post-Meal Response Log

The Post-Meal Response Log captures how the user felt after a meal. It should be fast, subjective, and clearly framed as feedback.

Purpose:

- Learn which meals and meal timings tend to support the user.
- Add personal context to food quality and nutrient data.
- Help Daily Check-In avoid asking duplicate food-response questions.
- Improve recommendation confidence only after repeated signals.

Inputs:

- Overall response score from 1 to 10.
- Digestion comfort.
- Energy response.
- Appetite stability.
- Mood/focus if appropriate.
- Heaviness or bloating.
- Cravings.
- Timing after meal: immediate, 30 minutes, 60 minutes, 120 minutes, later.

Suggested type:

```ts
type PostMealResponseLog = {
  id?: string;
  user_id?: string;
  meal_log_id?: string | null;
  responded_at: string;
  minutes_after_meal?: number | null;
  response_timing: 'immediate' | '30_min' | '60_min' | '120_min' | 'later' | 'unknown';
  overall_score: number;
  digestion?: 'good' | 'neutral' | 'heavy' | 'uncomfortable' | null;
  energy?: 'better' | 'steady' | 'dip' | null;
  appetite?: 'stable' | 'hungry_soon' | 'overfull' | null;
  focus?: 'clear' | 'neutral' | 'foggy' | null;
  heaviness?: 'none' | 'mild' | 'strong' | null;
  cravings?: 'none' | 'mild' | 'strong' | null;
  notes?: string | null;
  confidence: 'low' | 'medium' | 'high';
  reason_codes: string[];
  created_at: string;
};
```

Rules:

- The 1 to 10 score is user feedback, not medical truth.
- One response is a single data point, not a pattern.
- A linked meal log is preferred, but unlinked responses may be useful if the user remembers the meal.
- Recent responses should weigh more than old responses.
- Conflicting responses should lower confidence.

## 5. Adaptive Food Recommendation Model

The adaptive recommendation model combines:

- Food Pattern Test baseline.
- Logged nutrients.
- Meal quality flags.
- Post-meal response logs.
- Sleep and rhythm.
- Readiness.
- Training load or planned movement.
- Schedule constraints.

Evidence priority:

1. User corrections and manual adjustments.
2. Repeated post-meal responses.
3. Recent post-meal responses.
4. Logged nutrients and quality flags.
5. Food Pattern Test baseline.
6. Demo/default signals.

Rules:

- The Food Pattern Test gives an initial hypothesis.
- Post-meal responses are stronger evidence over time.
- Repeated patterns matter more than one-off responses.
- Missing data lowers confidence, not score.
- Recommendations should remain moderate.
- Avoid extreme diet recommendations.
- Do not prescribe medical diets.
- Keep language calm, experimental, and reversible.

Suggested output type:

```ts
type FoodRecommendation = {
  date: string;
  meal_context:
    | 'breakfast'
    | 'lunch'
    | 'dinner'
    | 'snack'
    | 'pre_training'
    | 'post_training';
  recommendation_type:
    | 'macro_balance'
    | 'meal_timing'
    | 'portion_style'
    | 'digestion_support'
    | 'training_fuel'
    | 'wind_down_support';
  title: string;
  summary: string;
  suggested_pattern: {
    protein: 'lower' | 'moderate' | 'higher';
    carbs: 'lower' | 'moderate' | 'higher';
    fat: 'lower' | 'moderate' | 'higher';
    fiber: 'lower' | 'moderate' | 'higher';
  };
  confidence: 'low' | 'medium' | 'high';
  reason_codes: string[];
};
```

Example safe recommendation titles:

- `Protein-forward breakfast`
- `Lighter dinner window`
- `Supportive pre-session meal`
- `Steady afternoon snack`
- `Simple meal after a heavier response`

Example safe summaries:

- `Your recent meal responses suggest steadier energy with a protein-forward breakfast.`
- `A lighter dinner may support tonight's wind-down window.`
- `Training later today may call for a more supportive pre-session meal.`
- `Healthi is still calibrating your food response.`

## 6. Calendar / In-App Schedule Block Model

The planning system should work in two phases.

### V1: In-App Schedule Blocks

Users manually mark their day with simple blocks:

- Work.
- Class.
- Commute.
- Exercise.
- Meal.
- Sleep.
- Free time.
- Recovery.
- Social.
- Appointment.

Healthi uses these blocks plus readiness, rhythm, food response, and training context to suggest:

- When to eat.
- What kind of meal fits the window.
- When to exercise.
- When to do deep work.
- When to walk/reset.
- When to wind down.
- When to sleep for better next-day energy.

Suggested type:

```ts
type DayScheduleBlock = {
  id?: string;
  user_id?: string;
  date: string;
  start_at: string;
  end_at: string;
  block_type:
    | 'work'
    | 'class'
    | 'commute'
    | 'exercise'
    | 'meal'
    | 'sleep'
    | 'free_time'
    | 'recovery'
    | 'social'
    | 'appointment'
    | 'unknown';
  title?: string | null;
  source: 'manual' | 'demo' | 'calendar_pending' | 'calendar_import';
  source_confidence: 'low' | 'medium' | 'high';
  user_locked?: boolean;
  reason_codes: string[];
  created_at: string;
};
```

Rules:

- User-locked blocks should not be moved by Healthi.
- Blocks can overlap only when the product intentionally supports it.
- In-app blocks must work without external calendar sync.
- Calendar-import sources are future-only and require explicit permission.

### V2: External Calendar Sync

Later, users may connect Google Calendar, Apple Calendar, or device calendar if technically feasible.

Requirements before external sync:

- Explicit user permission.
- Clear explanation of what Healthi reads.
- User control over which calendars are connected.
- Minimal storage of private event details.
- Ability to disconnect and delete imported data.
- A fallback in-app schedule block system for users who never sync calendars.

Imported event handling:

- Prefer coarse event categories over raw event details when possible.
- Store start/end time, block type, source, confidence, and user edits.
- Avoid storing unnecessary private descriptions, invitees, locations, or notes.

## 7. Day Plan Recommendation Model

The Day Plan Engine combines:

- Schedule blocks.
- Sleep + Rhythm energy windows.
- Readiness.
- Training/movement capacity.
- Nutrition recommendations.
- Food response.
- User constraints.

Output should be a suggested day plan that fits into real time windows.

Examples:

- `Eat a protein-forward meal before your work block.`
- `Best training window: 11:00 AM - 12:30 PM.`
- `Use your afternoon dip for a walk or reset.`
- `Start wind-down around 9:30 PM.`
- `Keep dinner lighter if your wind-down window is close.`

Suggested type:

```ts
type DayPlanRecommendation = {
  id?: string;
  date: string;
  title: string;
  summary: string;
  recommendation_type:
    | 'meal_timing'
    | 'meal_style'
    | 'exercise_timing'
    | 'deep_work'
    | 'walk_reset'
    | 'wind_down'
    | 'sleep_timing';
  suggested_start_at?: string | null;
  suggested_end_at?: string | null;
  related_block_id?: string | null;
  confidence: 'low' | 'medium' | 'high';
  reason_codes: string[];
};
```

Planning rules:

- Use rhythm windows for timing suggestions.
- Use readiness to decide how strongly to recommend effortful blocks.
- Use nutrition recommendations for meal style and meal timing.
- Respect user-locked schedule blocks.
- Do not overwrite the user's actual commitments.
- If schedule data is sparse, suggest broad windows rather than exact times.
- If food/rhythm data is sparse, lower confidence and say Healthi is calibrating.

## 8. Architecture Layers

Keep these separate:

```txt
Food Pattern Test
  -> baseline hypothesis

Meal Log
  -> what the user ate

Post-Meal Response Log
  -> how the user felt

Food Response Engine
  -> learns repeated response patterns

Food Recommendation Engine
  -> suggests meal style and meal timing

Schedule Blocks
  -> user's day constraints

Day Plan Engine
  -> fits recommendations into the actual day

Dashboard
  -> summarizes today

Daily Check-In later
  -> asks only missing subjective signals
```

Do not merge these into one vague score.

## 9. Suggested TypeScript Types

The types above should live near the future engine they support, likely under:

- `src/engines/foodPersonalization/types.ts`
- `src/engines/dayPlanning/types.ts`

Shared type recommendations:

```ts
type DataConfidence = 'low' | 'medium' | 'high';

type RecommendationSource =
  | 'food_pattern_test'
  | 'meal_logs'
  | 'post_meal_response'
  | 'sleep_rhythm'
  | 'readiness'
  | 'schedule_blocks'
  | 'demo'
  | 'estimated_default';

type RecommendationEvidence = {
  source: RecommendationSource;
  confidence: DataConfidence;
  reason_codes: string[];
};
```

Implementation note:

- Reuse the existing shared `DataConfidence` type.
- Reuse `MealLog`, `NutritionTargets`, and `NutritionReasonCode` where practical.
- Keep recommendation outputs serializable.
- Keep user-facing summary strings separate from machine reason codes.

## 10. Persistence Recommendations

Implement first:

### `food_pattern_profiles`

Stores the latest Food Pattern Test output plus historical profile rows.

Durable source data:

- `user_id`
- `source`
- `confidence`
- `pattern_label`
- `macro_tendency jsonb`
- `meal_timing_tendency jsonb`
- `response_tendencies jsonb`
- `reason_codes text[]`
- `is_active`
- `created_at`
- `updated_at`

### `post_meal_response_logs`

Stores response events linked to `meal_logs` when possible.

Durable source data:

- `user_id`
- `meal_log_id`
- `responded_at`
- `minutes_after_meal`
- `response_timing`
- `overall_score`
- digestion, energy, appetite, focus, heaviness, cravings
- notes
- confidence
- reason_codes
- created_at

### `day_schedule_blocks`

Stores in-app schedule blocks and future imported calendar blocks.

Durable source data:

- `user_id`
- `date`
- `start_at`
- `end_at`
- `block_type`
- `title`
- `source`
- `source_confidence`
- `user_locked`
- `reason_codes`
- created_at
- updated_at

Delay:

- External calendar connection tables.
- Calendar provider tokens or permission records beyond existing consent infrastructure.
- `day_plan_recommendations` cached table.
- Personalized food response profile summaries if too early.
- Product/barcode/OCR/API tables.

Should `day_plan_recommendations` be cached?

- Recompute by default in V1.
- Cache later if Morning Briefing needs stable "what we showed today" history.
- If cached later, include `engine_version`, `generated_at`, `input_snapshot`, `confidence`, and `reason_codes`.

## 11. Dashboard Integration

The Dashboard should eventually summarize:

- Food response score.
- Fueling readiness.
- Next suggested meal timing.
- Next training window.
- Next wind-down action.
- Readiness explanation based on food, rhythm, and schedule.

Potential dashboard cards:

- `Fueling Fit`: current food response and meal timing state.
- `Next Best Window`: next meal/training/deep work window.
- `Day Plan`: two or three top recommendations.
- `Why This?`: reason-code explanations with confidence.

Dashboard rules:

- Do not imply external calendar sync is active unless connected.
- Do not imply barcode/OCR/API food data is active unless connected.
- Always show confidence when a suggestion depends on sparse data.
- If schedule blocks are missing, show a broad rhythm-aware suggestion.
- If food data is missing, show calibration rather than a poor score.

## 12. Food Section UI Structure

Future Food tab sections:

1. Today.
2. Log Meal.
3. Response Log.
4. Food Pattern Test.
5. Insights.

### Today

Shows:

- Meal count.
- Nutrient progress.
- Food response state.
- Next suggested meal timing.
- Confidence and source.

### Log Meal

Manual meal logging first:

- Meal name.
- Meal type.
- Logged time.
- Core nutrients if known.
- Optional ingredients.
- Optional quality flags.

### Response Log

Fast post-meal feedback:

- Overall response score.
- Digestion.
- Energy.
- Appetite.
- Cravings.
- Timing after meal.

### Food Pattern Test

Baseline hypothesis builder:

- Short guided test.
- Can be re-run.
- Shows confidence and "calibrating" when sparse.

### Insights

Explains repeated patterns:

- "Breakfast style that tends to support steady energy."
- "Dinner timing that may fit wind-down better."
- "Meal response is still calibrating."

## 13. V1/V2/V3 Rollout

### V1: Food Personalization Foundation

Build:

- Food Pattern Test.
- Post-Meal Response Log.
- Food Pattern Profile type and deterministic scoring.
- Day Schedule Blocks, manual only.
- Pure Day Plan recommendation function using manual blocks and existing rhythm outputs.

Do not build:

- External calendar sync.
- Barcode scanning.
- OCR.
- External food APIs.
- AI recommendations.
- Product analysis.

### V2: Adaptive Food Response

Build:

- Repeated response pattern detection.
- Food Recommendation Engine.
- Integration with logged nutrients and training day context.
- Dashboard summaries for next meal timing and food response.

Still avoid:

- Extreme food rules.
- Medical diet claims.
- Hidden calendar ingestion.

### V3: Calendar-Aware Day Planning

Build:

- Optional external calendar sync if approved.
- Calendar consent and privacy controls.
- Day Plan recommendations integrated into Dashboard or Morning Briefing.
- Stable cached Day Plan outputs only if needed for history.

Do not build without separate approval:

- Provider token storage.
- Calendar event imports.
- Push notifications.
- AI planning.

## 14. Safety-Language Rules

Use:

- `food pattern`
- `food response`
- `fueling style`
- `digestion signal`
- `energy response`
- `appetite stability`
- `readiness support`
- `rhythm-aware`
- `day plan`
- `schedule block`
- `estimated`
- `likely`
- `based on logged meals`
- `confidence`
- `calibrating`
- `general wellness guidance`

Avoid:

- diagnostic language
- treatment language
- prescription language
- detox/cleanse language
- guilt or morality language around food
- proprietary framework names
- fixed food identity labels
- claims that a user cannot eat a nutrient group

Reason codes should be machine-readable and calm. User-facing copy should translate reason codes without shame, certainty, or medical framing.

## 15. Open Questions

- Should Food Pattern Test results update the active `nutrition_targets`, or should they only influence recommendations?
- Should post-meal response live as a separate table immediately, or should V1 keep the embedded `meal_logs.user_response` field and add a separate table when delayed responses are built?
- What is the minimum number of repeated responses before Healthi can call something an "emerging pattern"?
- Should schedule blocks support recurring templates in V1, or should every block be date-specific at first?
- How much calendar event detail is necessary for useful planning?
- Should the Day Plan Engine belong under `src/engines/dayPlanning`, or should it be a broader readiness-planning engine later?
- Should Morning Briefing own the final daily plan, with Day Plan Engine as an input?
- What UI copy should explain confidence without making the app feel uncertain or weak?
