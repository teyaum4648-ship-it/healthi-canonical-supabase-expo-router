# Healthi Nutrition + Food Response Engine Spec

## 1. Purpose

The Nutrition + Food Response Engine helps Healthi understand nourishment as more than calories.

The engine combines nutrient tracking, food quality analysis, user food response, meal timing, and source confidence into a conservative nourishment signal. It should help Healthi answer:

- Was the user likely fueled enough today?
- Was protein likely adequate for the user's goal and activity?
- Were meals balanced enough to support stable energy?
- Did the logged food pattern support recovery and rhythm?
- Did the user report digestion discomfort, heaviness, cravings, or an energy dip?
- Did late or heavy food timing create a possible wind-down conflict?
- Is there enough food data to trust the output?
- What is the simplest next nourishment action?

This engine is a general wellness planning engine. It should use cautious wording, expose confidence, and make missing data lower confidence instead of lowering the user's score.

## 2. Product Boundaries

Healthi's food system is category-inspired by food quality and product analysis tools, but it must remain Healthi-original.

V1 does not include:

- Barcode scanning.
- Camera or label capture.
- Photo analysis.
- External food databases.
- Generated meal plans.
- Shopping assistant logic.
- Personalized learning from long-term history.
- Native permissions.

The engine should not moralize food. It should not call food good or bad. It should describe food in terms of fit, balance, response, confidence, and timing.

User-facing language should prefer:

- `based on logged meals`
- `estimated`
- `likely`
- `food response`
- `digestion signal`
- `fueling readiness`
- `confidence`
- `calibrating`

## 3. Engine Architecture

Keep the nourishment stack separated into clear layers:

```txt
Meal Log
  -> what the user ate, when, source, and confidence

Nutrient Tracking
  -> calories, protein, carbs, fat, fiber, sugar, sodium, meal count

Food Quality Analysis
  -> whole-food emphasis, processing level, balance, sugar, sodium, fiber, protein, ingredient complexity

Food Response
  -> digestion comfort, energy response, appetite stability, cravings, heaviness, notes

Nutrition Readiness Signal
  -> fueling readiness, protein adequacy, digestion load, timing alignment, confidence

Dashboard
  -> summarized food readiness, progress, confidence, and next action

Daily Check-In later
  -> asks only subjective signals the engine cannot infer
```

Do not merge these into one vague food score. A meal can have strong nutrient support and uncertain food response. A product can have supportive ingredient quality and still be a poor fit for the user on a given day once personal response history exists.

## 4. Nutrient Tracking Model

`NutrientSummary` should aggregate logged meals for a day.

V1 nutrients:

- Calories.
- Protein grams.
- Carbohydrate grams.
- Fat grams.
- Fiber grams.
- Sugar grams.
- Sodium milligrams.
- Meal count.

Later nutrients:

- Water or hydration.
- Key micronutrient coverage.
- Caffeine.
- Alcohol.
- Meal plan adherence.

Suggested V1 targets:

- Use onboarding and goal context for conservative target estimates where available.
- Use default targets only when needed for demo or calibration states.
- Mark target basis clearly: `onboarding`, `default`, `manual`, or `future_plan`.
- Avoid hard judgments when target data is missing.

Nutrient summary output should include:

- totals
- targets
- percent-to-target values
- source coverage
- confidence
- reason codes
- data gaps

Missing calorie or macro data should not create a score penalty by itself. It should reduce confidence and surface `food_data_missing` or `nutrition_calibrating`.

## 5. Food Quality Model

`FoodQualityAnalysis` should describe the likely quality and balance of a meal or product without moral language.

Inputs V1 can support:

- Manual meal name.
- Manual nutrient fields.
- Optional ingredients if the user enters them.
- Meal type.
- Logged time.
- User-added flags.

Inputs later:

- Search result from a selected food database.
- Barcode result.
- Label capture.
- Ingredient parser.
- User corrections.

Food quality factors:

- Whole or minimally processed emphasis.
- Added sugar load.
- Fiber density.
- Protein density.
- Sodium load.
- Ingredient complexity.
- Ultra-processed indicators where available.
- Additive flags where available.
- Meal balance.
- Meal timing.

Suggested scoring approach:

```txt
food_quality_score =
  whole_food_support
  + protein_density_support
  + fiber_density_support
  + meal_balance_support
  + timing_support
  - added_sugar_load
  - sodium_load
  - processing_load
  - ingredient_complexity_load
```

The output should include a score, confidence, quality flags, and reason codes. The user-facing label should be calm:

- `supportive`
- `steady`
- `watch timing`
- `needs more context`
- `calibrating`

## 6. Food Response Model

`FoodResponseSignal` captures how the user felt after food.

V1 response fields:

- Digestion comfort: `good`, `neutral`, `heavy`, `uncomfortable`, `not_sure`.
- Energy response: `better`, `steady`, `dip`, `not_sure`.
- Appetite stability: `stable`, `hungry_soon`, `overfull`, `not_sure`.
- Cravings: `none`, `mild`, `strong`, `not_sure`.
- Optional note.

Later response fields:

- Bowel regularity.
- Sleep impact.
- Training response next day.
- Repeated food pattern confidence.

Food response should be independent from general food quality. A user can log a balanced meal and still report heaviness. A user can log a simple meal and report steady energy. The engine should preserve both signals.

Suggested output:

```txt
food_response_signal =
  digestion_signal
  + energy_response
  + appetite_stability
  + craving_signal
```

Confidence should depend on:

- Whether feedback was entered.
- How soon after the meal it was entered.
- Whether the same food or meal pattern has repeated.
- Whether there are conflicting responses.

Pattern confidence later:

| Response logs | Confidence label |
|---|---|
| 1 | `single_response` |
| 3 | `early_signal` |
| 5 | `emerging_pattern` |
| 8+ | `consistent_pattern` |

## 7. Readiness Integration

Nutrition should influence readiness conservatively.

V1 suggested contribution:

- Nutrition + Food Response: 10-20% of readiness.
- Sleep + Rhythm: higher priority.
- Recovery and Training Load: higher priority.

Why conservative:

- Food logs are often incomplete.
- Manual nutrients may be estimated.
- User food response needs repeated data.
- Sleep and recovery signals usually have stronger immediate effects on day mode.

Nutrition readiness should include these components:

- Fueling readiness.
- Protein adequacy.
- Digestion load.
- Hydration and fiber support.
- Food response confidence.
- Timing alignment with rhythm.

Example readiness rules:

- If protein is low and training load is high, reduce training confidence slightly and add `protein_low`.
- If the user reports digestion discomfort, bias the day toward maintain or restore style recommendations and add `digestion_discomfort_reported`.
- If food data is missing, lower confidence and add `food_data_missing`, but do not lower the score.
- If food quality and fueling are supportive, allow a small positive readiness contribution and add `food_quality_supportive`.
- If a late heavy meal may affect wind-down, add `meal_timing_late`; do not overstate certainty.

The Nutrition Readiness Signal should not decide workouts alone. It supplies nourishment context to the future readiness engine.

## 8. Reason Codes

Suggested nutrition reason codes:

```ts
type NutritionReasonCode =
  | 'protein_low'
  | 'protein_supportive'
  | 'fiber_low'
  | 'fiber_supportive'
  | 'under_fueled'
  | 'over_fueled'
  | 'meal_timing_late'
  | 'meal_timing_supportive'
  | 'added_sugar_high'
  | 'sodium_high'
  | 'processing_level_high'
  | 'digestion_discomfort_reported'
  | 'energy_dip_reported'
  | 'appetite_unstable_reported'
  | 'cravings_reported'
  | 'food_quality_supportive'
  | 'balanced_meal'
  | 'whole_food_emphasis'
  | 'food_data_missing'
  | 'nutrition_calibrating'
  | 'demo_food_data'
  | 'manual_food_log'
  | 'source_low_confidence';
```

Reason codes should be machine-readable and stable. User-facing copy should translate them into calm explanations.

## 9. Confidence Handling

Every output must include confidence.

Confidence values:

- `low`: sparse logs, estimated values, missing response, demo-only, or conflicting data.
- `medium`: manual logs with enough nutrients and at least basic response fields.
- `high`: later, consistent source quality, repeated user responses, and reliable nutrient data.

Rules:

- Missing logs lower confidence, not score.
- Demo data must be labeled demo.
- Manual logs are usually medium confidence when core fields are present.
- User corrections can improve confidence for a specific meal.
- Future barcode, selected database, and label capture sources may improve confidence if source quality is known.
- Conflicting food response should lower confidence.

## 10. Data Source Model

Source priority:

1. User-corrected meal or response.
2. Manually confirmed meal with nutrient fields.
3. Selected database result, if added later.
4. Barcode result, if added later.
5. Label capture result, if added later.
6. Demo data.
7. Estimated default.

Each source should include:

- source type
- source confidence
- captured time
- user correction state
- reason codes

No V1 output should imply that barcode, label capture, or external lookup is active.

## 11. Suggested TypeScript Types

```ts
type DataConfidence = 'low' | 'medium' | 'high';

type MealDataSource =
  | 'manual'
  | 'demo'
  | 'barcode_pending'
  | 'ocr_pending'
  | 'food_api_pending'
  | 'user_corrected'
  | 'estimated_default';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'unknown';

type FoodQualityFlag =
  | 'added_sugar'
  | 'high_sodium'
  | 'low_fiber'
  | 'protein_low'
  | 'ultra_processed_indicator'
  | 'balanced_meal'
  | 'whole_food_emphasis'
  | 'late_heavy_meal'
  | 'timing_supportive';

type FoodResponseInput = {
  digestion?: 'good' | 'neutral' | 'heavy' | 'uncomfortable' | 'not_sure' | null;
  energy?: 'better' | 'steady' | 'dip' | 'not_sure' | null;
  appetite?: 'stable' | 'hungry_soon' | 'overfull' | 'not_sure' | null;
  cravings?: 'none' | 'mild' | 'strong' | 'not_sure' | null;
  notes?: string | null;
};

type MealLog = {
  id?: string;
  user_id?: string;
  logged_at: string;
  meal_type: MealType;
  name: string;
  source: MealDataSource;
  source_confidence: DataConfidence;
  calories?: number | null;
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
  ingredients?: string[] | null;
  quality_flags: FoodQualityFlag[];
  user_response?: FoodResponseInput | null;
  corrected_by_user?: boolean;
  reason_codes: NutritionReasonCode[];
  created_at: string;
};

type NutrientTargetBasis = 'onboarding' | 'manual' | 'default' | 'future_plan';

type NutrientAmount = {
  current: number | null;
  target: number | null;
  percent_of_target: number | null;
  target_basis: NutrientTargetBasis;
};

type NutrientSummary = {
  date: string;
  calories: NutrientAmount;
  protein_g: NutrientAmount;
  carbs_g: NutrientAmount;
  fat_g: NutrientAmount;
  fiber_g: NutrientAmount;
  sugar_g: NutrientAmount;
  sodium_mg: NutrientAmount;
  meal_count: {
    current: number;
    target: number | null;
  };
  source_confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

type FoodQualityAnalysis = {
  score: number | null;
  label: 'supportive' | 'steady' | 'watch_timing' | 'needs_more_context' | 'calibrating';
  flags: FoodQualityFlag[];
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

type FoodResponseSignal = {
  digestion_signal: 'supportive' | 'neutral' | 'heavier_load' | 'unknown';
  energy_response: 'supportive' | 'steady' | 'dip_reported' | 'unknown';
  appetite_stability: 'stable' | 'unstable' | 'unknown';
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
};

type NutritionReadinessSignal = {
  date: string;
  score: number | null;
  contribution_weight: number;
  fueling_readiness: number | null;
  protein_adequacy: number | null;
  digestion_load: number | null;
  timing_alignment: number | null;
  confidence: DataConfidence;
  reason_codes: NutritionReasonCode[];
  summary: string;
};

type DailyNutritionBriefing = {
  date: string;
  nutrient_summary: NutrientSummary;
  food_quality: FoodQualityAnalysis;
  food_response: FoodResponseSignal;
  readiness_signal: NutritionReadinessSignal;
  next_action: {
    label: string;
    reason_codes: NutritionReasonCode[];
    confidence: DataConfidence;
  } | null;
};
```

## 12. Persistence Plan

Persist V1:

- Meal logs.
- Logged nutrient fields.
- Meal type and logged time.
- Optional ingredients if user-entered.
- Quality flags.
- User food response fields.
- Source and confidence.
- User correction state.
- Reason codes.
- Created and updated timestamps.

Recompute V1:

- Daily nutrient summary.
- Food quality score.
- Food response signal.
- Nutrition readiness signal.
- Dashboard summary.

Cache later:

- Daily nutrition summaries.
- Product analyses.
- Repeated food pattern summaries.
- Personalized response profile.
- Meal plan fit summaries.

Persistence principles:

- Keep raw meal logs as the durable source.
- Recompute deterministic outputs from logs where practical.
- Store reason codes for auditability.
- Use RLS for every user-owned row.
- Do not persist external provider payloads beyond what is needed and consented.

## 13. Dashboard Integration

The Dashboard Nutrition / Food Response card should eventually show:

- Calories progress.
- Protein progress.
- Meal count.
- Food quality signal.
- Food response flag.
- Readiness impact.
- Confidence.
- Source label.

Example copy:

- `Fueling is still calibrating.`
- `Protein is behind your target.`
- `Food response looks steady today.`
- `Dinner timing may affect wind-down.`
- `Based on logged meals.`
- `Demo food data is active.`

Dashboard rules:

- Never imply active barcode, label capture, or external lookup unless that source exists.
- Display confidence near the signal.
- Keep next action simple: log a meal, add protein, add fiber, hydrate, or keep dinner earlier.
- If no meals are logged, show a calibration state rather than a poor score.

## 14. V1/V2/V3/V4 Rollout

### V1: Manual Meal + Response Foundation

Build:

- Manual meal logging.
- Calories, protein, carbs, fat, fiber, sugar, sodium.
- Meal count.
- Basic food quality flags.
- Digestion and energy response.
- Deterministic nutrition readiness signal.
- Dashboard summary.

Do not build:

- Barcode scanning.
- Label capture.
- External APIs.
- Generated meal plans.
- Shopping assistant.
- AI.

### V2: Search and Selected Food Source

Build:

- Food search using a selected data source.
- User correction of selected foods.
- Better nutrient confidence.
- Optional barcode lookup only if approved later.

### V3: Label and Ingredient Detail

Build:

- Label capture only if approved later.
- Ingredient parsing.
- Detailed food quality analysis.
- Product-level quality flags.
- One-tap log from product evaluation.

### V4: Personalized Response Learning

Build:

- Food response pattern confidence.
- Personal high-response foods.
- Foods to limit on certain day modes.
- Links between meal timing, energy, digestion, sleep, rhythm, and training response.
- Meal planning and shopping support using personal response history.

## 15. Tests Required for Future Implementation

Unit tests:

- Missing meal data lowers confidence but does not lower score.
- Manual meal with nutrients produces medium confidence.
- Demo meal data is labeled demo.
- Protein below target emits `protein_low`.
- Protein near target emits `protein_supportive`.
- Fiber below target emits `fiber_low`.
- Late heavy meal emits `meal_timing_late`.
- Reported discomfort emits `digestion_discomfort_reported`.
- Reported energy dip emits `energy_dip_reported`.
- Supportive food quality emits `food_quality_supportive`.
- Nutrition readiness contribution stays within the configured weight.

Integration tests:

- Dashboard shows calibration when no meals are logged.
- Dashboard shows source and confidence for logged meals.
- Future readiness uses nutrition as a secondary signal.
- Food data missing lowers readiness confidence, not readiness score.
- Strong sleep plus weak nutrition does not fully block the day by itself.
- Supportive nutrition can improve readiness only slightly.

Safety tests:

- User-facing copy avoids blocked medical and moralizing language.
- Allergy constraints override future food recommendations.
- No V1 output claims barcode, label capture, or external lookup is active.

## 16. Safety-Language Rules

Healthi food language should stay calm, practical, and non-moralizing.

Use:

- `estimated`
- `likely`
- `based on logged meals`
- `food response`
- `digestion signal`
- `fueling readiness`
- `confidence`
- `general wellness guidance`

Avoid:

- Medical certainty.
- Food fear language.
- Claims that a food is universally harmful or universally ideal.
- Branded method language.
- Shame-based food labels.
- Claims based on sources Healthi does not actually have.

Examples:

Good:

```txt
Protein looks behind your target based on logged meals.
```

Good:

```txt
Dinner timing may make wind-down harder tonight.
```

Good:

```txt
Food response is still calibrating.
```

Avoid:

```txt
This food is bad for you.
```

Avoid:

```txt
This ingredient is harmful for everyone.
```

## 17. Open Questions

- Should V1 ask for exact calories/macros, rough portion presets, or both?
- Should the first manual meal form prioritize speed or nutrient completeness?
- How should Healthi estimate protein targets before full body metrics exist?
- Should hydration live inside this engine or remain a separate nourishment sub-engine?
- What is the minimum meal data required before showing a nutrition readiness score?
- Should user response be asked immediately after meal logging or later in a Daily Check-In?
- How should late dinner timing interact with the Sleep + Rhythm Engine in V1?
- What food source should Healthi evaluate for V2, if any?
- Which quality flags should users be allowed to correct manually?
- Should dashboard nutrition display exact scores or qualitative labels during calibration?
