# Nutrition + Food Response Persistence Plan

## 1. Recommendation Summary

Implement persistence for durable Nutrition + Food Response source data first:

- `meal_logs`
- `nutrition_targets`

Delay persistence for generated nutrition outputs until the app has enough real meal history or a user-facing surface that needs stable daily snapshots:

- `daily_nutrition_summaries`
- `food_items`
- `product_analyses`
- `food_response_profiles`

The V1 engine should recompute daily nutrient totals, food quality analysis, food response signal, and conservative readiness contribution from stored meal logs plus the active nutrition target. This keeps Healthi's database focused on durable user-entered data, avoids stale generated summaries, and leaves room for engine tuning.

The initial schema already contains broader tables named `food_items`, `food_logs`, `food_response_logs`, `food_patterns`, `meal_plans`, and `barcode_scans`. Those tables were scaffolded before the current Nutrition + Food Response spec. Before implementing a migration, confirm whether they contain production data. If no production data exists, prefer an engine-aligned migration that introduces `meal_logs` and `nutrition_targets`, then supersedes the older food tables rather than expanding them.

## 2. Store vs Recompute Decision

Store source-of-truth data:

- Manually logged meals.
- Demo meals used for local preview.
- Future user-corrected meals.
- Future selected database, barcode, OCR, or API-derived meal entries only after those sources are approved.
- User-entered nutrient fields.
- Optional user-entered ingredients.
- Food quality flags when captured or corrected by the user.
- User food response fields.
- Source, confidence, correction, and reason-code metadata.
- User-specific nutrition targets and target basis.

Recompute when practical:

- Daily nutrient totals.
- Percent-to-target values.
- Meal count.
- Food quality score.
- Food response signal.
- Nutrition readiness signal.
- Dashboard nutrition summary.
- Daily Check-In missing nutrition questions.

Maybe cache later:

- Daily nutrition summary once Morning Briefing, historical charts, or notifications need an immutable daily snapshot.
- Product analysis snapshots once barcode, OCR, or external food lookup exists.
- Repeated response patterns once enough meal-response history exists.
- Readiness input snapshots once the readiness engine needs auditability for what was shown to the user.

Do not store in V1:

- Raw barcode scan payloads.
- Raw OCR/camera payloads.
- External food API responses.
- Product-level food databases.
- Personalized food response profiles.
- Generated meal plans.
- AI-generated food recommendations.

## 3. Table Recommendations

Implement now:

### `meal_logs`

Purpose: durable source-of-truth meal entries from manual, demo, correction, and future approved sources.

This table should become the canonical replacement for the older `food_logs` plus `food_response_logs` shape. The engine needs one durable meal record that can carry nutrients, meal timing, food quality flags, user response, source confidence, and correction lineage together.

### `nutrition_targets`

Purpose: user-specific targets used by nutrient summaries, dashboard progress, and future readiness context.

Implement now because the dashboard nutrition card already has calories, protein, and meal target fields. Without a target table, V1 either hardcodes demo targets or stores targets inside generated summaries. Targets are slower-changing source data, so they should be durable.

Delay:

### `daily_nutrition_summaries`

Purpose: cache daily totals, quality signal, food response signal, and conservative readiness contribution.

Delay because these values are derived from meal logs and targets. Recompute them until Morning Briefing, trend views, or notifications require stable historical snapshots.

### `food_items` / `product_analyses`

Purpose: reusable foods, products, barcode/API/OCR results, ingredient detail, and product-level quality analysis.

Delay until search, barcode, OCR, or external food APIs are intentionally approved.

### `food_response_profiles`

Purpose: learned user-specific response patterns.

Delay until enough meal-response history exists to distinguish a real pattern from one-off feedback.

## 4. Proposed `meal_logs` Schema

Suggested columns:

```sql
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null,
  meal_date date not null,
  meal_type text not null default 'unknown',
  name text not null,
  source text not null,
  source_confidence text not null,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  ingredients text[],
  quality_flags text[] not null default '{}',
  user_response jsonb,
  corrected_by_user boolean not null default false,
  confirmed_by_user boolean not null default false,
  correction_of_meal_id uuid references public.meal_logs(id) on delete set null,
  original_source_id text,
  raw_source_payload jsonb,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Recommended checks:

- `meal_type in ('breakfast','lunch','dinner','snack','unknown')`
- `source in ('manual','demo','barcode_pending','ocr_pending','food_api_pending','user_corrected','estimated_default')`
- `source_confidence in ('low','medium','high')`
- Nutrient fields are null or `>= 0`
- `name` is non-empty after trimming

Recommended `quality_flags` values:

- `added_sugar`
- `high_sodium`
- `low_fiber`
- `protein_low`
- `ultra_processed_indicator`
- `balanced_meal`
- `whole_food_emphasis`
- `late_heavy_meal`
- `timing_supportive`

Recommended `user_response` shape:

```json
{
  "digestion": "good | neutral | heavy | uncomfortable | not_sure",
  "energy": "better | steady | dip | not_sure",
  "appetite": "stable | hungry_soon | overfull | not_sure",
  "cravings": "none | mild | strong | not_sure",
  "notes": "optional user note"
}
```

Recommended indexes:

- `(user_id, meal_date desc)`
- `(user_id, logged_at desc)`
- `(user_id, source, meal_date desc)`
- `(correction_of_meal_id)` where not null

Recommended uniqueness:

- Do not force one row per user, date, or meal type.
- Users may log multiple snacks, split meals, duplicate candidates, or correction lineage.

Notes on `raw_source_payload`:

- Keep null for manual/demo V1.
- Only store future provider payloads with explicit approval, consent, and a clear debugging or audit reason.
- Prefer narrow columns and normalized metadata over raw payload storage.

## 5. Proposed `nutrition_targets` Schema

Suggested columns:

```sql
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calories_target numeric,
  protein_g_target numeric,
  carbs_g_target numeric,
  fat_g_target numeric,
  fiber_g_target numeric,
  sodium_mg_limit numeric,
  confidence text not null,
  basis text[] not null default '{}',
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  replaced_at timestamptz,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Recommended checks:

- `confidence in ('low','medium','high')`
- `basis <@ array['onboarding','manual','default','future_plan']::text[]`
- Target fields are null or `> 0`
- `sodium_mg_limit` is null or `> 0`
- `replaced_at is null` when `is_active = true`

Recommended indexes:

- `(user_id, is_active)`
- `(user_id, effective_at desc)`

Recommended uniqueness:

```sql
create unique index nutrition_targets_one_active_per_user_idx
on public.nutrition_targets(user_id)
where is_active = true;
```

Why historical rows:

- Targets change with goals, body composition, activity, and user corrections.
- Future readiness or dashboard summaries may need to know which target was active when older meals were logged.
- A new active row can replace prior targets without mutating historical context.

## 6. Delay `daily_nutrition_summaries`

Do not implement this table in the first persistence migration.

Reason:

- Daily nutrition summary is derived from `meal_logs` and active `nutrition_targets`.
- Engine tuning would make cached scores stale unless versioned carefully.
- V1 does not yet have a Morning Briefing or nutrition history UI that needs an immutable daily snapshot.
- Dashboard can recompute current-day totals from recent logs.

Add later when:

- Morning Briefing is implemented.
- Nutrition trend charts need fast historical access.
- Notifications need stable timing or meal guidance decisions.
- Readiness needs an audit trail of which nutrition signal was used on a given day.

When added, include:

- `engine_version`
- `summary_date`
- `generated_at`
- `input_snapshot jsonb`
- `nutrient_summary jsonb`
- `food_quality jsonb`
- `food_response jsonb`
- `readiness_signal jsonb`
- `confidence`
- `reason_codes`
- `source_summary jsonb`

## 7. Future `food_items` and `product_analyses`

Do not implement new product tables in V1.

Future sources may include:

- Selected database result.
- Barcode result.
- OCR or label capture result.
- Ingredient parser result.
- User-corrected product facts.

V1 should not imply these sources are active. Source values such as `barcode_pending`, `ocr_pending`, and `food_api_pending` are placeholders for schema compatibility and product copy only, not active integrations.

If added later, product-level tables should separate:

- The reusable product or food item.
- The user's logged serving.
- The product analysis snapshot shown to the user.
- Any raw provider payload retained with consent.

## 8. Future `food_response_profiles`

Do not implement a profile table in V1.

Reason:

- One meal response is not a pattern.
- Food response is personal, contextual, and sensitive to timing, stress, sleep, and training load.
- Storing learned profile rows too early risks overfitting and confusing the dashboard.

Add later when:

- A user has enough repeated logs for the same food, meal type, or ingredient pattern.
- The engine can label confidence as `early_signal`, `emerging_pattern`, or `consistent_pattern`.
- The product has UI for explaining and correcting learned response patterns.

## 9. Meal Correction Flow

Recommended behavior:

1. User edits meal name, time, meal type, nutrients, ingredients, flags, or response.
2. App inserts a new `meal_logs` row with `source = 'user_corrected'`.
3. New row sets `corrected_by_user = true` and `confirmed_by_user = true`.
4. New row points `correction_of_meal_id` to the original row.
5. Original row remains for lineage unless the user explicitly deletes it.
6. Engine source priority selects the corrected row over the original source.

This supports future learning:

- Compare original estimate to corrected nutrition.
- Track repeated nutrient or response corrections.
- Improve source confidence slowly.
- Avoid overfitting to one unusual meal.

## 10. Nutrient Field Storage

Use first-class numeric columns for V1 nutrients:

- `calories`
- `protein_g`
- `carbs_g`
- `fat_g`
- `fiber_g`
- `sugar_g`
- `sodium_mg`

Why columns instead of only JSON:

- Dashboard and summaries need fast daily totals.
- Readiness integration needs simple protein, fiber, fueling, and timing checks.
- Columns make migration checks and constraints clearer.

Use nullable fields:

- Manual entries may not include every nutrient.
- Missing nutrients should lower confidence, not punish the user.
- Recomputed summaries should surface `food_data_missing` or `nutrition_calibrating`.

Use `raw_source_payload` only for future provider-specific fields after approval and consent.

## 11. Food Quality Flags

Store `quality_flags text[]` on the meal log when flags are user-entered, engine-derived from entered data, or source-derived.

Reason:

- Flags are lightweight and useful for explaining summaries.
- Flags support deterministic reason codes.
- Flags avoid storing a full derived food quality score too early.

Do not store a daily food quality score in V1. Recompute it from nutrients, ingredients, flags, timing, and response.

## 12. User Food Response Storage

Store user response on `meal_logs.user_response`.

Reason:

- In V1, response belongs to the logged meal.
- Keeping response with the meal simplifies correction lineage and Daily Check-In skip logic.
- A separate `food_response_logs` table can wait until multiple delayed responses per meal, reminders, or repeated pattern learning are built.

If delayed responses become important later, add a separate `meal_response_events` table rather than overloading `meal_logs`.

## 13. Source and Confidence

Use Healthi-original meal source values:

```ts
type MealDataSource =
  | 'manual'
  | 'demo'
  | 'barcode_pending'
  | 'ocr_pending'
  | 'food_api_pending'
  | 'user_corrected'
  | 'estimated_default';
```

Future implemented values may be added only when those features exist:

- `barcode`
- `ocr`
- `food_api`

Source priority:

1. User-corrected meal or response.
2. Manually confirmed meal with nutrient fields.
3. Selected database result, later.
4. Barcode result, later.
5. Label capture result, later.
6. Demo data.
7. Estimated default.

Every stored meal and target should include confidence and reason codes. Missing data should lower confidence and add reason codes, not lower the score by itself.

## 14. Dashboard Support

The current dashboard composer already expects:

- Calories progress.
- Protein progress.
- Meal count.
- Food response copy.
- CTA.
- Source label.

V1 dashboard can query today's `meal_logs` and active `nutrition_targets`, then recompute:

- `nutrition.calories.current`
- `nutrition.calories.target`
- `nutrition.protein.current`
- `nutrition.protein.target`
- `nutrition.mealsLogged.current`
- `nutrition.mealsLogged.target`
- `nutrition.foodResponse`
- `nutrition.source`

Recommended dashboard copy:

- `Fueling is still calibrating.`
- `Protein is behind your target.`
- `Food response looks steady today.`
- `Dinner timing may affect wind-down.`
- `Based on logged meals.`
- `Demo food data is active.`

If no meals are logged, show calibration rather than a poor score.

## 15. Readiness Support

Nutrition should influence readiness conservatively.

Store only the meal and target inputs needed to recompute the nutrition signal. Do not store nutrition readiness scores in V1.

Future readiness can derive:

- Fueling readiness from calorie coverage.
- Protein adequacy from protein target progress.
- Fiber support from fiber totals.
- Digestion load from user response.
- Food response confidence from response completeness.
- Timing alignment from `logged_at`, meal type, and rhythm windows.

Rules:

- Food data missing lowers readiness confidence, not readiness score.
- Supportive nutrition can improve readiness only slightly.
- Reported digestion discomfort can bias recommendations toward simpler next actions.
- Nutrition should not overpower sleep, recovery, or training load.

## 16. Daily Check-In Support

Daily Check-In should query current-day `meal_logs` and the active `nutrition_targets`, then ask only what cannot be inferred.

Examples:

- If no meals are logged, ask for a simple meal log.
- If nutrients are missing, ask for rough protein or meal size only if useful.
- If food response is missing, ask one short digestion or energy question.
- If a meal was corrected and confirmed, skip duplicate questions.

Daily Check-In should not ask about barcode, OCR, or external lookup sources in V1.

## 17. RLS Policy Plan

For every user-owned Nutrition + Food Response table:

- `user_id` is required.
- Row Level Security is enabled.
- Authenticated users can select only their own rows.
- Authenticated users can insert only their own rows.
- Authenticated users can update only their own rows.
- Authenticated users can delete only their own rows unless a future audit or retention requirement narrows deletion.

Policy pattern should match the project style:

```sql
alter table public.meal_logs enable row level security;

create policy "meal_logs_select_own"
on public.meal_logs
for select using (auth.uid() = user_id);

create policy "meal_logs_insert_own"
on public.meal_logs
for insert with check (auth.uid() = user_id);

create policy "meal_logs_update_own"
on public.meal_logs
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "meal_logs_delete_own"
on public.meal_logs
for delete using (auth.uid() = user_id);
```

Do not rely on service-role access in mobile code.

## 18. Privacy and Consent Notes

V1:

- Store manual/demo meals only.
- Do not request camera permissions.
- Do not add barcode scanning.
- Do not add OCR.
- Do not add external food APIs.
- Do not store raw provider payloads.
- Keep source and confidence visible.

Future integrations:

- Require explicit approval before barcode, OCR, or external food lookup.
- Store consent records when provider data or camera capture is introduced.
- Keep user corrections as durable records.
- Allow users to delete food logs and response data.

## 19. Step-by-Step Implementation Plan

1. Confirm whether existing `food_items`, `food_logs`, `food_response_logs`, `food_patterns`, `meal_plans`, and `barcode_scans` have production data.
2. If no production data exists, create a migration that introduces `meal_logs` and `nutrition_targets`, then deprecates or supersedes the older food tables before they are wired into the app.
3. If production data exists, create `meal_logs`, backfill from `food_logs` and `food_response_logs`, and leave old tables read-only/legacy until removal is safe.
4. Add enum-style check constraints for source, confidence, meal type, and target basis.
5. Add non-negative checks for nutrient and target fields.
6. Add `updated_at` triggers using existing `public.set_updated_at()`.
7. Add RLS and own-row policies.
8. Add indexes for user/date, user/logged time, active target lookup, and correction lineage.
9. Wire onboarding completion to create the initial active `nutrition_targets` row only after target logic is approved.
10. Wire manual/demo meal entry to insert `meal_logs`.
11. Keep daily nutrient summaries, food quality, food response signal, and readiness contribution recomputed in app code for now.
12. Add focused persistence helper tests once code wiring exists.

## 20. Acceptance Criteria for Eventual Migration Task

The eventual migration is accepted when:

- `meal_logs` exists with engine-aligned fields.
- `nutrition_targets` exists with one active target per user.
- Both tables have `user_id`, RLS enabled, and own-row policies.
- Source values match the V1 `MealDataSource`.
- Confidence values match `DataConfidence`.
- Nutrient fields are nullable numeric columns.
- User response is stored without requiring a separate V1 response table.
- Quality flags and reason codes are stored as `text[]`.
- Correction lineage is supported through `correction_of_meal_id`.
- Raw provider payload storage is nullable and unused by V1.
- No barcode scanning, camera/OCR, external food APIs, Scout Health integration, subscriptions, AI, or package changes are added.
- No `daily_nutrition_summaries`, `product_analyses`, or `food_response_profiles` table is added without a separate approved task.
- The app can recompute dashboard nutrition progress and conservative readiness context from stored meals and active targets.
- The migration does not require service-role access from mobile code.
- Existing tests and typecheck pass after wiring.
