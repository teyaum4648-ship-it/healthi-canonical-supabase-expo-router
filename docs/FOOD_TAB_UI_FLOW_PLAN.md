# Food Tab UI Flow Plan

## 1. Purpose

The Food tab should become Healthi's nourishment command center. It should help users understand how logged meals, nutrient coverage, food quality, and post-meal responses may be supporting the day without feeling like a calorie tracker or diet app.

The Food tab should support:

- Today.
- Log Meal.
- Response Log.
- Food Pattern Test.
- Insights.

The product goal is to connect manual meal logging, nutrient summary, food quality signal, food response signal, post-meal response learning, Food Pattern Profile, adaptive recommendations, and dashboard nutrition readiness into one calm flow.

## 2. Product Boundaries

V1 should not include:

- Barcode scanning.
- Camera or label capture.
- OCR.
- External food APIs.
- AI-generated meal plans.
- Calendar sync.
- Subscriptions or paywall logic.
- Native permissions.

Food should be framed as general wellness guidance. Missing logs lower confidence instead of lowering the user. Healthi should describe food in terms of fit, timing, response, source, and confidence.

## 3. Food Tab Structure

The Food tab should contain five internal sections:

1. `Today`
2. `Log Meal`
3. `Response Log`
4. `Food Pattern Test`
5. `Insights`

Recommended hierarchy:

- `Today` is the default first screen.
- `Log Meal` and `Response Log` are high-frequency actions.
- `Food Pattern Test` is a setup and recalibration flow.
- `Insights` summarizes learned signals and can remain mostly calibrating in V1.

## 4. Navigation Recommendation

Use a hybrid model:

- Keep one Expo Router `food` tab route.
- Use internal segmented controls for `Today`, `Log Meal`, `Response Log`, `Food Pattern Test`, and `Insights`.
- Use modal/sheet-style panels later for quick `Log Meal` and `Response Log` if the form feels too long inside the tab.

Why this fits Healthi now:

- It avoids adding route complexity before the Food system is stable.
- It keeps Food as one coherent product area.
- It allows the Dashboard to route to `/food` without needing nested destination logic.
- It can work in local demo mode and Supabase mode with the same screen state.

Avoid building separate nested routes for each Food area in V1 unless the forms become hard to manage.

## 5. Today Section Design

Purpose: daily nutrition command center.

Top card: `Today's Fueling`

Should show:

- Meal count.
- Calories progress.
- Protein progress.
- Carbs, fat, and fiber compact metrics.
- Food quality signal.
- Food response signal.
- Nutrition readiness support.
- Confidence/source label.
- Next suggested food action.

Recommended layout:

- Hero summary card with one primary signal: `Fueling readiness`.
- Three compact metric tiles: `Calories`, `Protein`, `Meals`.
- Small nutrient row: `Carbs`, `Fat`, `Fiber`.
- Two signal rows: `Food quality` and `Food response`.
- CTA row: `Log meal` and `Add response`.

Today should use existing engines:

- `calculateNutrientSummary`
- `calculateFoodQuality`
- `calculateFoodResponse`
- `generateNutritionReadinessSignal`

Missing data state:

- Show `Food response is still calibrating.`
- Show `Log a meal to improve today's fueling signal.`
- Do not show a poor score when no meals exist.

## 6. Log Meal Section Design

Purpose: manual meal logging that allows sparse logs.

Fields:

- Meal name.
- Meal type: breakfast, lunch, dinner, snack, unknown.
- Logged time.
- Calories.
- Protein.
- Carbs.
- Fat.
- Fiber.
- Sugar.
- Sodium.
- Quality flags.
- Optional user response.

Form behavior:

- Meal name and time are the only required user-facing fields in V1.
- Nutrients can be partial.
- Empty nutrient fields save as null.
- Sparse logs should save with low or medium confidence depending on coverage.
- Quality flags should be optional and phrased as neutral observations.

Suggested field groups:

- `Meal details`: name, type, time.
- `Nutrients`: calories, protein, carbs, fat, fiber.
- `Additional context`: sugar, sodium, quality flags.
- `Optional response`: digestion, energy, appetite, cravings.

Future scanner adapter:

- The existing scanner product adapter can feed `MealLog` later.
- V1 UI should not imply scanning is active.

## 7. Response Log Section Design

Purpose: capture how the user felt after eating.

Fields:

- Linked meal if available.
- Overall 1-10 response score.
- Minutes after meal.
- Digestion.
- Energy.
- Appetite.
- Focus.
- Cravings.
- Notes.

Recommended interaction:

- Start with a simple 1-10 score.
- Then show optional chips for digestion, energy, appetite, focus, and cravings.
- Notes should be optional and quiet.

Response logs should feed:

- `savePostMealResponseLog`
- `scoreFoodPatternMealResponse`
- `updateFoodPatternProfileFromResponse`
- Later adaptive Food Pattern Profile updates.

Copy should make it clear:

- One response is a data point, not a verdict.
- Repeated responses improve confidence.
- The user can skip anything they are unsure about.

## 8. Food Pattern Test Section Design

Purpose: Food-section test used after onboarding to form an initial Food Pattern Profile.

Flow:

1. Intro card.
2. 16-question test.
3. Result profile.
4. Confidence and reason highlights.
5. Retake/update action.

Intro card should explain:

- `Your Food Pattern Profile is based on your answers and will keep adapting with meal responses.`
- The test is optional but useful.
- The result is an estimate, not a fixed identity.

Result screen should show:

- Profile title from `getFoodPatternResultCopy`.
- Summary.
- Confidence note.
- Three reason highlights from reason codes.
- Macro tendency.
- Meal timing tendency.
- Response tendencies.
- CTA: `Save profile`.
- Secondary action: `Retake`.

Persistence:

- Use `calculateFoodPatternProfile`.
- Use `replaceActiveFoodPatternProfile` when saving.
- Use `getActiveFoodPatternProfile` to show current profile.

## 9. Insights Section Design

Purpose: summarize learned food response patterns.

V1 can be mostly calibrating.

Should eventually show:

- Current Food Pattern Profile.
- Best-supported meal timing.
- Protein, carb, and fat tendency.
- Recent post-meal response trend.
- Food quality trend.
- Readiness support trend.
- Confidence/source labels.

V1 cards:

- `Food Response Profile`: current active profile or calibrating.
- `Recent Responses`: count of recent response logs and latest trend.
- `Fueling Fit`: simple explanation based on today's nutrition signal.
- `Still Calibrating`: shown when meal or response data is sparse.

Do not build historical charts in the first slice.

## 10. Data Flow

### Today

1. Fetch today's meal logs with `getMealLogsForDate`.
2. Fetch active nutrition target with `getActiveNutritionTarget`.
3. Run `calculateNutrientSummary`.
4. Run `calculateFoodQuality`.
5. Run `calculateFoodResponse`.
6. Run `generateNutritionReadinessSignal`.
7. Render metric cards, confidence, source, and next action.

### Log Meal

1. Map form state into `MealLog`.
2. Save with `saveMealLog` when Supabase is configured.
3. Store in local demo state when Supabase is missing.
4. Recompute Today engine outputs after save.

### Response Log

1. Map form state into `PostMealResponseLogInput`.
2. Save with `savePostMealResponseLog`.
3. Score response with `scoreFoodPatternMealResponse`.
4. If an active profile exists, update with `updateFoodPatternProfileFromResponse`.
5. Save adaptive profile through `replaceActiveFoodPatternProfile` only after the product rules decide when adaptive updates should be durable.

### Food Pattern Test

1. Collect answers by stable question id.
2. Run `calculateFoodPatternProfile`.
3. Render result copy with `getFoodPatternResultCopy`.
4. Save with `replaceActiveFoodPatternProfile`.
5. Refresh active profile.

### Insights

1. Fetch active profile with `getActiveFoodPatternProfile`.
2. Fetch recent responses with `getRecentPostMealResponseLogs`.
3. Fetch recent meals with `getRecentMealLogs`.
4. Render broad trends only when confidence is sufficient.

## 11. Empty, Demo, And Calibrating States

No meals logged:

- Title: `Food response is still calibrating.`
- Body: `Log a meal to improve today's fueling signal.`
- CTA: `Log meal`

No response logs:

- Title: `No meal responses yet.`
- Body: `Rate how you felt after eating so Healthi can learn what supports steadier energy.`
- CTA: `Add response`

No Food Pattern Profile:

- Title: `Set up your Food Pattern Profile.`
- Body: `Answer a short test so Healthi can estimate your starting fueling style.`
- CTA: `Start Food Pattern Test`

Demo mode:

- Show `Demo food data` or `Demo signal`.
- Do not imply real scanner, wearable, or external lookup sources are active.

Partial data:

- Use `Confidence: low`.
- Prefer `needs more context` or `calibrating`.
- Never show a failure state solely because the user skipped nutrients.

## 12. Visual Direction

Use current Healthi dark-luxury direction:

- Near-black plum background.
- Dark glass cards.
- Gold accents for primary readiness/fueling signal.
- Lavender and soft blue for secondary signals.
- Compact metric cards.
- Quiet, premium typography.
- Rounded panels, but avoid nested card clutter.
- Calm progress bars and rings.

Food-specific visual language:

- Gold: primary fueling/readiness support.
- Lavender: food response and digestion signal.
- Soft blue: nutrient coverage and timing.
- Muted ivory: body text.
- Avoid red warning states unless there is a true destructive action.

## 13. Copy Examples

Food tab header:

- `Food`
- `Fueling, response, and readiness support.`

Today summary:

- `Today's Fueling`
- `Based on logged meals, Healthi is estimating how food is supporting your day.`
- `Fueling is still calibrating.`

Empty/calibrating state:

- `Log a meal to improve today's fueling signal.`
- `Food response is still calibrating.`
- `More meal responses will improve confidence.`

Log Meal form:

- `Add what you know. Sparse logs are okay.`
- `Nutrients can be estimated or left blank.`
- `Missing fields lower confidence, not your score.`

Response Log form:

- `Rate how you felt after eating.`
- `This helps Healthi learn your food response over time.`
- `One response is just one signal.`

Food Pattern Test intro:

- `Find your starting fueling style.`
- `Healthi uses your answers to estimate a Food Pattern Profile.`
- `Your profile can adapt as you log meals and responses.`

Food Pattern Test result:

- `Your Food Pattern Profile is based on your answers and will keep adapting with meal responses.`
- `Confidence: medium`
- `Based on your answers.`

Insights empty state:

- `Insights are still calibrating.`
- `Log a few meals and responses to reveal food response patterns.`

Nutrition readiness support:

- `Food is supporting today's readiness.`
- `Today's food signal needs more context.`
- `A simple next meal may support steadier energy.`

## 14. First V1 Implementation Slice

Build the smallest useful Food tab:

1. Replace the placeholder Food tab with internal segmented controls.
2. Implement `Today` with demo/local meal data and engine recalculation.
3. Add a manual `Log Meal` card/form with sparse nutrient support.
4. Add a `Response Log` card/form.
5. Add a `Food Pattern Test` setup card and result state.
6. Use local demo fallback when Supabase is not configured.
7. Use persistence helpers only when Supabase is configured.

Do not build all Insights behavior in the first slice.

Do not add scanner UI yet.

Do not add external data sources.

## 15. Testing Plan

Implementation tests should cover:

- Manual meal form mapping to `MealLog`.
- Sparse nutrient handling.
- Response log form mapping to `PostMealResponseLogInput`.
- Food Pattern Test answer mapping to `FoodPatternAnswers`.
- Segment state helper if extracted.
- Local demo fallback state.
- Supabase-configured persistence branches if they can be mocked.
- Serialization of UI-to-engine payloads.
- Safety-language scan for user-facing Food copy.

Avoid brittle snapshot tests. Prefer focused tests for mapping helpers and deterministic copy.

## 16. Safety-Language Rules

User-facing copy should use:

- `food pattern`
- `food response`
- `fueling style`
- `digestion signal`
- `energy response`
- `appetite stability`
- `readiness support`
- `estimated`
- `likely`
- `based on your answers`
- `based on logged meals`
- `confidence`
- `calibrating`
- `general wellness guidance`

User-facing copy should avoid:

- Medical or fixed-condition claims.
- Treatment, cure, prescription, or clinical framing.
- Hormone or stress-axis explanations.
- Detox, cleanse, toxic, or toxin framing.
- Diet-culture language.
- Proprietary framework names or labels.
- Any claim that a user can never eat a food or cannot tolerate a macro.

Food should remain non-moralizing. Say a meal is `supportive`, `steady`, `needs more context`, or `may affect timing`; do not call foods good or bad.

## 17. Open Questions

- Should `Log Meal` and `Response Log` open as sheets on mobile after the first V1?
- Should Food Pattern Test saving immediately replace the active profile, or ask for confirmation first?
- When should adaptive post-meal response updates become durable profile replacements?
- Should Insights show Food Pattern Profile as a label, or only show the next practical suggestion?
- Should nutrition targets be editable from Food V1 or remain hidden/default until later?
- Should Dashboard nutrition actions deep-link into a specific Food segment?
- What is the first safe visual representation of food quality that does not feel judgmental?
- Should notes be searchable later, or remain private context only?
