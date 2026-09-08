# Food Pattern Test Design

## 1. Purpose

The Food Pattern Test gives Healthi an early, conservative food-response hypothesis before enough logged meals and post-meal responses exist.

The test should help Healthi estimate:

- Which fueling style may support steadier energy.
- Which meal size and spacing may fit the user.
- Whether late or heavy meals may create a wind-down conflict.
- Whether training days may need more deliberate fueling.
- Which food-response questions are worth asking again later.

The result is not a fixed identity. It is an initial Food Pattern Profile that can be refined by user corrections, meal logs, and Post-Meal Response Logs.

## 2. Product Boundaries

The Food Pattern Test lives inside the Food / Nutrition section, not the original app onboarding.

V1 is design-only and should not include:

- Meal logging UI.
- Supabase migrations.
- Barcode scanning.
- Camera or label capture.
- OCR.
- External food APIs.
- AI-generated plans.
- Calendar sync.
- Native permissions.

Healthi should describe food in terms of response, fit, timing, confidence, and general wellness guidance. Do not frame the result as a permanent food type or medical conclusion.

Preferred product language:

- `Food Pattern Test`
- `Fueling Style`
- `Food Response Profile`
- `Meal Response Score`
- `Fueling Fit`
- `Post-Meal Response Log`
- `Food Pattern Profile`

## 3. Food Pattern Profile Labels

The Food Pattern Test should return one of six labels.

### `steady_balanced`

The user's answers suggest they do reasonably well with moderate meals, mixed macros, and normal spacing. This is the default when signals are supportive but not strongly tilted toward another pattern.

Planning tendency:

- Moderate protein, carbs, and fat.
- Flexible meal spacing.
- Standard meal timing guidance.

### `protein_forward`

The user's answers suggest steadier energy or appetite when meals include a stronger protein anchor.

Planning tendency:

- Higher protein emphasis.
- Moderate carbs and fats.
- Breakfast or first meal may be more helpful.
- Avoid implying the user should avoid carbs.

### `carb_supported`

The user's answers suggest carbohydrates may be useful around training, high-output work, or appetite stability.

Planning tendency:

- Moderate-to-higher carbs around activity.
- Protein remains moderate.
- Meal timing should support training and deep-work windows.
- Avoid implying the user needs high carbs all day.

### `lighter_frequent`

The user's answers suggest smaller or more frequent meals may feel easier than large meals.

Planning tendency:

- Smaller meals or planned snacks.
- Moderate protein per eating window.
- Avoid long gaps when the user reports dips or cravings.

### `evening_sensitive`

The user's answers suggest late, large, or heavier dinners may conflict with sleep quality or next-morning energy.

Planning tendency:

- Earlier dinner timing when possible.
- Lighter dinner style near wind-down.
- Larger meal earlier in the day if needed.

### `calibrating`

There is not enough clear signal yet, or answers are sparse or inconsistent.

Planning tendency:

- Use balanced default suggestions.
- Ask for Post-Meal Response Logs.
- Keep confidence low until repeated meal responses exist.

## 4. Question Set

The V1 test should use 16 questions. Questions may be one per screen or grouped in short sections.

Each question includes answer contributions to the deterministic scoring model:

- `steady_balanced`
- `protein_forward`
- `carb_supported`
- `lighter_frequent`
- `evening_sensitive`

`calibrating` is not directly scored. It is selected when confidence is too low or signals conflict.

### Q1: `protein_meal_energy`

Question: `After a meal with a clear protein anchor, how do you usually feel?`

Options:

- `steady`: Steady and satisfied for a while.
  - Scores: `protein_forward +3`, `steady_balanced +1`
  - Reason codes: `protein_forward_signal`
  - Confidence: +1
- `heavy`: A little heavy or slowed down.
  - Scores: `lighter_frequent +2`, `digestion_sensitivity +1`
  - Reason codes: `large_meal_heaviness`, `digestion_sensitivity`
  - Confidence: +1
- `neutral`: No clear difference.
  - Scores: `steady_balanced +1`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +0
- `not_sure`: Not sure yet.
  - Scores: none
  - Reason codes: `food_pattern_calibrating`
  - Confidence: -1

Safety notes: Keep examples simple, such as eggs, fish, tofu, chicken, yogurt, beans, or a protein smoothie.

### Q2: `carb_meal_energy`

Question: `After a meal built around rice, pasta, bread, potatoes, oats, or fruit, how do you usually feel?`

Options:

- `steady`: Steady or energized.
  - Scores: `carb_supported +3`, `steady_balanced +1`
  - Reason codes: `carb_supported_signal`
  - Confidence: +1
- `dip`: I tend to get tired or want more food soon after.
  - Scores: `protein_forward +2`, `lighter_frequent +1`
  - Reason codes: `afternoon_energy_dip`, `appetite_instability`
  - Confidence: +1
- `depends`: It depends on the meal.
  - Scores: `steady_balanced +1`
  - Reason codes: `food_pattern_inconsistent`
  - Confidence: +0
- `not_sure`: Not sure yet.
  - Scores: none
  - Reason codes: `food_pattern_calibrating`
  - Confidence: -1

Safety notes: Do not say carbs are bad or universally supportive.

### Q3: `hunger_frequency`

Question: `How often do you usually get hungry again after a normal meal?`

Options:

- `under_2_hours`: Within 1 to 2 hours.
  - Scores: `lighter_frequent +3`, `protein_forward +1`
  - Reason codes: `lighter_frequent_signal`, `appetite_instability`
  - Confidence: +1
- `three_to_four_hours`: Around 3 to 4 hours.
  - Scores: `steady_balanced +3`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `five_plus_hours`: I can go 5+ hours comfortably.
  - Scores: `steady_balanced +1`, `protein_forward +1`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `varies`: It varies a lot.
  - Scores: `lighter_frequent +1`
  - Reason codes: `food_pattern_inconsistent`
  - Confidence: +0

### Q4: `cravings_pattern`

Question: `When cravings show up, when do they usually happen?`

Options:

- `afternoon`: Mostly afternoon.
  - Scores: `lighter_frequent +2`, `protein_forward +1`
  - Reason codes: `afternoon_energy_dip`, `appetite_instability`
  - Confidence: +1
- `evening`: Mostly evening.
  - Scores: `evening_sensitive +2`, `lighter_frequent +1`
  - Reason codes: `evening_sensitive_signal`, `appetite_instability`
  - Confidence: +1
- `after_sweets`: Mostly after sweeter foods.
  - Scores: `protein_forward +2`
  - Reason codes: `appetite_instability`
  - Confidence: +1
- `rare`: Rarely.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1

### Q5: `large_meal_digestion`

Question: `How do larger meals usually sit with you?`

Options:

- `fine`: Fine, as long as the meal is balanced.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `heavy`: I feel heavy or slowed down.
  - Scores: `lighter_frequent +3`, `evening_sensitive +1`
  - Reason codes: `large_meal_heaviness`, `digestion_sensitivity`
  - Confidence: +1
- `sleepy`: I often feel sleepy after.
  - Scores: `lighter_frequent +2`, `protein_forward +1`
  - Reason codes: `large_meal_heaviness`, `afternoon_energy_dip`
  - Confidence: +1
- `not_sure`: Not sure.
  - Scores: none
  - Reason codes: `food_pattern_calibrating`
  - Confidence: -1

### Q6: `higher_fat_meal_response`

Question: `After a richer meal with more oils, cheese, nuts, avocado, or fattier meats, how do you usually feel?`

Options:

- `satisfied`: Satisfied and steady.
  - Scores: `protein_forward +2`, `steady_balanced +1`
  - Reason codes: `protein_forward_signal`
  - Confidence: +1
- `heavy`: Heavy or slower digestion.
  - Scores: `lighter_frequent +2`, `evening_sensitive +1`
  - Reason codes: `digestion_sensitivity`, `large_meal_heaviness`
  - Confidence: +1
- `neutral`: No clear difference.
  - Scores: `steady_balanced +1`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +0
- `depends_on_timing`: Fine earlier, less ideal late.
  - Scores: `evening_sensitive +3`
  - Reason codes: `evening_sensitive_signal`, `late_meal_sensitivity`
  - Confidence: +1

### Q7: `breakfast_skip_response`

Question: `If you delay or skip breakfast, what usually happens?`

Options:

- `fine`: I feel fine and stable.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `crash`: I get low energy, cravings, or feel off.
  - Scores: `protein_forward +2`, `lighter_frequent +2`
  - Reason codes: `breakfast_helpful`, `appetite_instability`
  - Confidence: +1
- `overeat_later`: I tend to overdo it later.
  - Scores: `lighter_frequent +2`, `evening_sensitive +1`
  - Reason codes: `breakfast_helpful`, `appetite_instability`
  - Confidence: +1
- `not_applicable`: I do not usually skip it.
  - Scores: `steady_balanced +1`
  - Reason codes: `breakfast_helpful`
  - Confidence: +0

### Q8: `afternoon_energy`

Question: `What is your afternoon energy usually like?`

Options:

- `steady`: Pretty steady.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `dip`: Noticeable dip.
  - Scores: `lighter_frequent +2`, `protein_forward +1`
  - Reason codes: `afternoon_energy_dip`
  - Confidence: +1
- `depends_lunch`: Depends heavily on lunch.
  - Scores: `protein_forward +1`, `carb_supported +1`, `lighter_frequent +1`
  - Reason codes: `food_pattern_inconsistent`
  - Confidence: +0
- `training_days_only`: Mostly on training days.
  - Scores: `carb_supported +2`
  - Reason codes: `training_fuel_needed`
  - Confidence: +1

### Q9: `late_dinner_response`

Question: `If dinner happens late, how do you usually feel later that night?`

Options:

- `fine`: Fine.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `restless`: Less settled before bed.
  - Scores: `evening_sensitive +3`
  - Reason codes: `late_meal_sensitivity`, `evening_sensitive_signal`
  - Confidence: +1
- `heavy`: Too full or heavy.
  - Scores: `evening_sensitive +3`, `lighter_frequent +1`
  - Reason codes: `late_meal_sensitivity`, `large_meal_heaviness`
  - Confidence: +1
- `not_sure`: Not sure.
  - Scores: none
  - Reason codes: `food_pattern_calibrating`
  - Confidence: -1

### Q10: `heavy_dinner_sleep`

Question: `After a heavier dinner, how is your sleep or next-morning energy?`

Options:

- `unchanged`: Usually unchanged.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `worse_sleep`: Sleep feels lighter or more interrupted.
  - Scores: `evening_sensitive +3`
  - Reason codes: `late_meal_sensitivity`, `evening_sensitive_signal`
  - Confidence: +1
- `slow_morning`: I feel slower the next morning.
  - Scores: `evening_sensitive +2`, `lighter_frequent +1`
  - Reason codes: `late_meal_sensitivity`
  - Confidence: +1
- `not_sure`: Not sure.
  - Scores: none
  - Reason codes: `food_pattern_calibrating`
  - Confidence: -1

Safety notes: Use cautious copy such as `may support wind-down`; do not overstate cause.

### Q11: `training_fuel_need`

Question: `On training or very active days, what tends to support you best?`

Options:

- `extra_carbs`: More carbs before or after activity.
  - Scores: `carb_supported +3`
  - Reason codes: `carb_supported_signal`, `training_fuel_needed`
  - Confidence: +1
- `extra_protein`: More protein-focused meals.
  - Scores: `protein_forward +3`
  - Reason codes: `protein_forward_signal`, `training_fuel_needed`
  - Confidence: +1
- `normal_meals`: Normal balanced meals are enough.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `not_active`: I am not training right now.
  - Scores: none
  - Reason codes: `food_pattern_calibrating`
  - Confidence: +0

### Q12: `appetite_stability`

Question: `Across a normal day, how predictable is your appetite?`

Options:

- `predictable`: Pretty predictable.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `swings`: It swings a lot.
  - Scores: `lighter_frequent +2`, `protein_forward +1`
  - Reason codes: `appetite_instability`
  - Confidence: +1
- `low_then_high`: Low early, stronger later.
  - Scores: `evening_sensitive +2`, `lighter_frequent +1`
  - Reason codes: `evening_sensitive_signal`, `appetite_instability`
  - Confidence: +1
- `not_sure`: Not sure.
  - Scores: none
  - Reason codes: `food_pattern_calibrating`
  - Confidence: -1

### Q13: `meal_size_preference`

Question: `Which meal style usually feels best?`

Options:

- `three_balanced`: Three balanced meals.
  - Scores: `steady_balanced +3`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `smaller_more_often`: Smaller meals or snacks.
  - Scores: `lighter_frequent +3`
  - Reason codes: `lighter_frequent_signal`
  - Confidence: +1
- `larger_fewer`: Larger meals with longer gaps.
  - Scores: `protein_forward +1`, `steady_balanced +1`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `changes_daily`: It changes day to day.
  - Scores: `steady_balanced +1`
  - Reason codes: `food_pattern_inconsistent`
  - Confidence: +0

### Q14: `caffeine_food_sensitivity`

Question: `If you have caffeine without enough food, what tends to happen?`

Options:

- `fine`: I feel fine.
  - Scores: `steady_balanced +1`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +0
- `wired_or_crash`: I feel wired, shaky, or crash later.
  - Scores: `protein_forward +1`, `lighter_frequent +2`
  - Reason codes: `appetite_instability`, `breakfast_helpful`
  - Confidence: +1
- `need_food_first`: I do better with food first.
  - Scores: `protein_forward +2`, `lighter_frequent +1`
  - Reason codes: `breakfast_helpful`
  - Confidence: +1
- `rare_caffeine`: I rarely use caffeine.
  - Scores: none
  - Reason codes: `food_pattern_calibrating`
  - Confidence: +0

Safety notes: Keep this about food timing and subjective energy, not medical sensitivity.

### Q15: `stress_life_load_eating`

Question: `On high-demand days, what happens to your eating pattern?`

Options:

- `steady`: I still eat normally.
  - Scores: `steady_balanced +2`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +1
- `forget_food`: I forget to eat, then feel behind.
  - Scores: `lighter_frequent +2`, `protein_forward +1`
  - Reason codes: `appetite_instability`, `breakfast_helpful`
  - Confidence: +1
- `snack_more`: I snack more.
  - Scores: `lighter_frequent +2`
  - Reason codes: `lighter_frequent_signal`, `appetite_instability`
  - Confidence: +1
- `dinner_heavier`: Dinner gets much heavier.
  - Scores: `evening_sensitive +2`
  - Reason codes: `evening_sensitive_signal`, `late_meal_sensitivity`
  - Confidence: +1

Safety notes: Avoid shame or diet-culture language. This question is about planning support.

### Q16: `morning_fueling_pattern`

Question: `What first meal usually sets up your day best?`

Options:

- `protein_breakfast`: Protein-forward breakfast.
  - Scores: `protein_forward +3`
  - Reason codes: `protein_forward_signal`, `breakfast_helpful`
  - Confidence: +1
- `carb_breakfast`: Oats, fruit, toast, rice, or another carb-based meal.
  - Scores: `carb_supported +2`, `steady_balanced +1`
  - Reason codes: `carb_supported_signal`
  - Confidence: +1
- `light_start`: Something light first, more later.
  - Scores: `lighter_frequent +2`
  - Reason codes: `lighter_frequent_signal`
  - Confidence: +1
- `no_breakfast`: No breakfast usually feels best.
  - Scores: `steady_balanced +1`
  - Reason codes: `steady_balanced_signal`
  - Confidence: +0

## 5. Scoring Rules

Use a deterministic `FoodPatternScores` model:

```ts
type FoodPatternScores = {
  steady_balanced: number;
  protein_forward: number;
  carb_supported: number;
  lighter_frequent: number;
  evening_sensitive: number;
};
```

Rules:

- Initialize all scores at `0`.
- Apply each selected answer's weighted points.
- Collect all answer reason codes in insertion order, then de-duplicate.
- Track `answered_count`, `skipped_count`, and `confidence_points`.
- `calibrating` is selected when the model has insufficient or inconsistent signal.
- The highest score determines the profile label when confidence is sufficient.
- If the top two scores are within `2` points and `steady_balanced` is one of them, select `steady_balanced`.
- If the top two non-balanced scores are within `2` points, select `calibrating` unless there are at least three matching reason codes for the top label.
- If `answered_count < 10`, select `calibrating`.
- If `skipped_count >= 5`, select `calibrating`.
- If all non-zero scores are below `6`, select `calibrating`.
- Never output an extreme recommendation from the questionnaire alone.

Tie handling:

- `steady_balanced` is the safe tie-breaker when answers show flexibility.
- `calibrating` is the safe tie-breaker when answers conflict.
- `evening_sensitive` can coexist with another profile as a response tendency even when it is not the main label.

Macro tendency mapping:

| Label | Protein | Carbs | Fat |
| --- | --- | --- | --- |
| `steady_balanced` | moderate | moderate | moderate |
| `protein_forward` | higher | moderate | moderate |
| `carb_supported` | moderate | higher | moderate |
| `lighter_frequent` | moderate | moderate | moderate |
| `evening_sensitive` | moderate | moderate | moderate |
| `calibrating` | moderate | moderate | moderate |

Meal timing tendency mapping:

| Label | Breakfast | Meal spacing | Late meal sensitivity |
| --- | --- | --- | --- |
| `steady_balanced` | optional | moderate | low |
| `protein_forward` | helpful | moderate | medium |
| `carb_supported` | helpful | moderate | low |
| `lighter_frequent` | helpful | shorter | medium |
| `evening_sensitive` | helpful | moderate | high |
| `calibrating` | optional | moderate | unknown |

Response tendency mapping:

| Signal | Digestion | Energy | Appetite |
| --- | --- | --- | --- |
| High `digestion_sensitivity` / `large_meal_heaviness` reasons | sensitive | unknown | unknown |
| High `afternoon_energy_dip` reasons | unknown | dip_prone | unknown |
| High `appetite_instability` reasons | unknown | unknown | hungry_soon |
| No clear watch signals | steady | steady | stable |

## 6. Confidence Rules

The Food Pattern Test can only create `low` or `medium` confidence by itself.

Confidence rules:

- `low`: fewer than 10 answered questions, 5+ skipped or not-sure answers, conflicting top scores, or sparse reason codes.
- `medium`: 10+ answered questions, clear top score, and at least three reason codes supporting the selected label.
- `high`: not available from the test alone. High confidence requires repeated Post-Meal Response Logs or user-confirmed corrections later.

Confidence should be lowered by:

- Many `not_sure` answers.
- Close top scores without a clear reason-code pattern.
- Strong signals for two competing labels.
- Missing training or breakfast context when those questions are skipped.

Confidence should be raised later by:

- Repeated post-meal responses matching the profile.
- User corrections confirming a suggested pattern.
- Multiple logged meals with similar energy, digestion, and appetite responses.

Missing data lowers confidence, not the user's score.

## 7. Output Profile Type

Suggested future type:

```ts
type FoodPatternLabel =
  | 'steady_balanced'
  | 'protein_forward'
  | 'carb_supported'
  | 'lighter_frequent'
  | 'evening_sensitive'
  | 'calibrating';

type FoodPatternReasonCode =
  | 'protein_forward_signal'
  | 'carb_supported_signal'
  | 'lighter_frequent_signal'
  | 'evening_sensitive_signal'
  | 'steady_balanced_signal'
  | 'breakfast_helpful'
  | 'late_meal_sensitivity'
  | 'large_meal_heaviness'
  | 'afternoon_energy_dip'
  | 'training_fuel_needed'
  | 'appetite_instability'
  | 'digestion_sensitivity'
  | 'food_pattern_calibrating'
  | 'food_pattern_inconsistent';

type FoodPatternProfile = {
  source: 'food_pattern_test' | 'manual_adjustment' | 'adaptive_update';
  confidence: 'low' | 'medium' | 'high';
  pattern_label: FoodPatternLabel;
  scores: FoodPatternScores;
  answered_count: number;
  skipped_count: number;
  macro_tendency: {
    protein: 'lower' | 'moderate' | 'higher';
    carbs: 'lower' | 'moderate' | 'higher';
    fat: 'lower' | 'moderate' | 'higher';
  };
  meal_timing_tendency: {
    breakfast: 'optional' | 'helpful' | 'important';
    meal_spacing: 'shorter' | 'moderate' | 'longer';
    late_meal_sensitivity: 'low' | 'medium' | 'high' | 'unknown';
  };
  response_tendencies: {
    digestion: 'steady' | 'sensitive' | 'unknown';
    energy: 'steady' | 'dip_prone' | 'unknown';
    appetite: 'stable' | 'hungry_soon' | 'unknown';
  };
  reason_codes: FoodPatternReasonCode[];
  result_copy: {
    title: string;
    summary: string;
    next_step: string;
  };
};
```

## 8. Reason Codes

Stable reason codes:

- `protein_forward_signal`
- `carb_supported_signal`
- `lighter_frequent_signal`
- `evening_sensitive_signal`
- `steady_balanced_signal`
- `breakfast_helpful`
- `late_meal_sensitivity`
- `large_meal_heaviness`
- `afternoon_energy_dip`
- `training_fuel_needed`
- `appetite_instability`
- `digestion_sensitivity`
- `food_pattern_calibrating`
- `food_pattern_inconsistent`

Reason code rules:

- Reason codes are machine-readable, not final user copy.
- Keep reason codes stable once persisted.
- De-duplicate reason codes.
- Translate reason codes into calm explanations in UI.
- Do not expose internal score weights to the user.

## 9. Result Copy

All result copy must be tentative and reversible.

### `steady_balanced`

Title: `Balanced pattern`

Summary: `Based on your answers, a balanced meal rhythm may support steady energy for you. Healthi will keep learning from your meal logs and response check-ins.`

Next step: `Log a few meals and note how you feel afterward so Healthi can calibrate your Food Response Profile.`

### `protein_forward`

Title: `Protein-forward pattern`

Summary: `Based on your answers, meals with a clear protein anchor may support steadier appetite and energy. This is an early estimate, not a fixed rule.`

Next step: `Try adding a protein anchor to your first meal and log your energy response later.`

### `carb_supported`

Title: `Carb-supported pattern`

Summary: `Based on your answers, well-timed carbs may support training, focus, or appetite stability. Healthi will refine this with logged meals.`

Next step: `On active days, log how you feel after meals that include carbs around movement or training.`

### `lighter_frequent`

Title: `Lighter, steadier rhythm`

Summary: `Based on your answers, smaller meals or planned snacks may feel easier than larger meals. Healthi will watch for energy and appetite patterns over time.`

Next step: `Try logging a lighter meal or snack and add a quick response afterward.`

### `evening_sensitive`

Title: `Evening-sensitive pattern`

Summary: `Based on your answers, earlier or lighter dinners may better support your wind-down window. Healthi will compare this with future sleep and meal responses.`

Next step: `Log dinner timing and note how settled you feel before bed.`

### `calibrating`

Title: `Food pattern calibrating`

Summary: `Healthi does not have a clear enough food pattern yet. That is okay. A few meal logs and response check-ins will make this more useful.`

Next step: `Start with balanced meals and add Post-Meal Response Logs when something feels noticeably steady, heavy, energizing, or tiring.`

## 10. How Post-Meal Responses Refine The Profile

The Food Pattern Test is lower-priority evidence than repeated real-world responses.

Evidence priority:

1. User corrections and manual adjustments.
2. Repeated Post-Meal Response Logs.
3. Recent Post-Meal Response Logs.
4. Logged nutrients and meal timing.
5. Food Pattern Test baseline.
6. Demo or estimated defaults.

Refinement rules:

- One response is a data point, not a pattern.
- Three similar responses can create an early signal.
- Five similar responses can increase confidence to medium if they match the profile.
- Eight or more similar responses can increase confidence to high for a specific tendency.
- Conflicting responses lower confidence and may return the profile to `calibrating`.
- Recent responses should weigh more than older responses.
- User corrections should be retained as stronger evidence than inferred patterns.

Examples:

- If a `protein_forward` result is followed by repeated steady responses after balanced carb-supported meals, Healthi should soften the profile toward `steady_balanced` or `carb_supported`.
- If a `steady_balanced` result is followed by repeated late-dinner heaviness and weaker next-morning energy, Healthi should add or raise `evening_sensitive` as a response tendency.
- If a `lighter_frequent` result is followed by stable energy with three balanced meals, Healthi should reduce shorter meal-spacing confidence.

## 11. Food Section UI Placement

Recommended Food tab structure:

1. Today.
2. Log Meal.
3. Response Log.
4. Food Pattern Test.
5. Insights.

Placement rules:

- The Food Pattern Test should be discoverable from Food -> Insights or a setup card.
- It should not block meal logging.
- The result should appear as a small `Food Response Profile` or `Fueling Style` card.
- The card should show label, confidence, one-sentence summary, and a `Retake or adjust` action.
- If confidence is low, the UI should ask for Post-Meal Response Logs rather than asking the user to retake the whole test.

Suggested Food Pattern card:

- Title: `Food Response Profile`
- Value: selected result title.
- Metadata: `Confidence: low` or `Confidence: medium`.
- Source: `Based on your Food Pattern Test`.
- Action: `Add meal response`.

## 12. Future Implementation Steps

Implementation sequence:

1. Add pure types and scoring function under a future `src/engines/foodPattern/` folder.
2. Add unit tests for each label, tie handling, skipped answers, and confidence thresholds.
3. Add result-copy tests to ensure outputs are deterministic.
4. Add safety-language tests for user-facing strings.
5. Add persistence only after schema approval.
6. Add Food tab UI entry point.
7. Add Post-Meal Response Log connection.
8. Add adaptive update logic after enough real response data exists.

V1 implementation must remain:

- Deterministic.
- Serializable.
- Testable without network calls.
- Conservative in confidence.
- Separate from the existing Nutrition + Food Response Engine until the interface is approved.

## 13. Safety-Language Rules

User-facing strings should use:

- `estimated`
- `likely`
- `based on your answers`
- `based on available data`
- `food pattern`
- `food response`
- `fueling style`
- `digestion signal`
- `energy response`
- `appetite stability`
- `readiness support`
- `confidence`
- `calibrating`
- `general wellness guidance`

User-facing strings and result explanations should avoid:

- Medical claims or fixed-condition language.
- Treatment, cure, prescription, or clinical framing.
- Hormone or stress-axis explanations.
- Detox, cleanse, toxic, or toxin framing.
- Moralizing food language such as bad food, cheat meal, or guilt-free.
- Named external frameworks or their proprietary labels.
- The phrases `metabolic type` and `metabolic typing`.

Implementation note:

- Reason codes may describe observable signals, such as `late_meal_sensitivity` or `digestion_sensitivity`.
- UI copy should translate those codes into soft language, such as `Dinner timing may affect your wind-down window.`
- If the app cannot support a claim from data, show `calibrating`.

## 14. Open Questions

- Should Food Pattern Test answers be stored as raw answers, final profile only, or both?
- Should the user be able to manually choose or override their profile label?
- Should `evening_sensitive` be a primary label, a secondary flag, or both?
- Should breakfast guidance differ by sleep/rhythm profile once those engines are connected?
- What threshold should move confidence from medium to high after Post-Meal Response Logs?
- Should a future Food tab show the user's primary label publicly, or only show the current practical suggestion?
- Should training-day questions be skipped for users who report no training, or kept for future planning?
- Should the result copy mention examples of meals, or keep examples out until meal logging exists?
