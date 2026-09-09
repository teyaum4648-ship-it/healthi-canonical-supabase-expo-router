# Healthi Data Model

## Principles

- Use `auth.users` as the auth source.
- Use `public.profiles` for app-level profile data.
- Enable RLS on every table in `public`.
- Every user-owned row must have `user_id`.
- Store metric observations as events when possible.
- Store engine outputs with reason codes for auditability.
- Do not store raw AI prompts forever unless the user consents and retention rules are clear.

## Core entity groups

### Identity and settings

- profiles
- user_settings
- user_consents
- privacy_events
- data_export_requests
- data_deletion_requests
- subscription_status

### Onboarding and assessments

- assessment_sessions
- assessment_answers
- baseline_profiles
- movement_assessments
- movement_screen_results
- posture_assessments
- breathing_assessments
- food_constraints

### Metrics and scores

- metric_sources
- metric_observations
- sleep_logs
- sleep_debt_history
- circadian_profiles
- circadian_logs
- hydration_logs
- daily_checkins
- stress_assessments
- foundation_scores
- readiness_scores
- allostatic_load_scores

### Movement and training

- exercise_library
- exercise_prerequisites
- movement_pattern_permissions
- training_plans
- training_sessions
- exercise_sets
- progression_targets
- session_outcomes
- warmup_logs
- stretch_logs
- corrective_protocols
- rebalancing_sessions
- recovery_interventions

### Food and meal planning

- food_items
- food_ingredients
- barcode_scans
- food_logs
- meal_logs
- food_response_logs
- food_patterns
- meal_plans
- meal_plan_items
- recipes
- recipe_history
- shopping_lists
- shopping_list_items
- pantry_items

### AI

- ai_chat_sessions
- ai_messages
- ai_context_snapshots
- ai_safety_events

### Wearables

- wearable_connections
- wearable_data_logs

## Important JSON fields

Use JSONB for flexible engine output, but keep primary query fields as columns.

Examples:

- `reason_codes text[]`
- `metadata jsonb`
- `answers jsonb`
- `score_breakdown jsonb`
- `context_snapshot jsonb`

## Metric observations

Use `metric_observations` for general measurable events.

Example metric types:

- sleep_duration_minutes
- sleep_quality_score
- resting_heart_rate
- hrv_rmssd
- hydration_ml
- caffeine_mg
- energy_score
- soreness_score
- digestion_score
- motivation_score
- body_weight_kg
- steps

## Source confidence

All metrics should store:

- source: healthkit, health_connect, manual, estimated, food_api, ai_generated.
- confidence: low, medium, high.

## RLS policy pattern

For every user-owned table:

```sql
create policy "select own rows" on table_name
for select using (auth.uid() = user_id);

create policy "insert own rows" on table_name
for insert with check (auth.uid() = user_id);

create policy "update own rows" on table_name
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "delete own rows" on table_name
for delete using (auth.uid() = user_id);
```

## Public library tables

Exercise library may be publicly readable to authenticated users but writable only by service role/admin operations.

Food items may be global, user-owned, or mixed. Use `owner_user_id` nullable plus `is_public` boolean.
