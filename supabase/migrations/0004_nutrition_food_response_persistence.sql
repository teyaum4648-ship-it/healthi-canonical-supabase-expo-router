-- Nutrition + Food Response source-of-truth persistence.
-- Daily summaries, quality scores, response signals, and readiness context remain recomputable.

create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null,
  meal_date date not null,
  meal_type text not null default 'unknown',
  name text not null,
  source text not null,
  source_confidence text not null,
  calories integer,
  protein_g numeric(8,2),
  carbs_g numeric(8,2),
  fat_g numeric(8,2),
  fiber_g numeric(8,2),
  sugar_g numeric(8,2),
  sodium_mg numeric(10,2),
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
  updated_at timestamptz not null default now(),
  constraint meal_logs_name_not_empty
    check (length(trim(name)) > 0),
  constraint meal_logs_calories_valid
    check (calories is null or calories >= 0),
  constraint meal_logs_protein_g_valid
    check (protein_g is null or protein_g >= 0),
  constraint meal_logs_carbs_g_valid
    check (carbs_g is null or carbs_g >= 0),
  constraint meal_logs_fat_g_valid
    check (fat_g is null or fat_g >= 0),
  constraint meal_logs_fiber_g_valid
    check (fiber_g is null or fiber_g >= 0),
  constraint meal_logs_sugar_g_valid
    check (sugar_g is null or sugar_g >= 0),
  constraint meal_logs_sodium_mg_valid
    check (sodium_mg is null or sodium_mg >= 0),
  constraint meal_logs_meal_type_valid
    check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'unknown')),
  constraint meal_logs_source_valid
    check (
      source in (
        'manual',
        'demo',
        'barcode_pending',
        'ocr_pending',
        'food_api_pending',
        'user_corrected',
        'estimated_default'
      )
    ),
  constraint meal_logs_source_confidence_valid
    check (source_confidence in ('low', 'medium', 'high')),
  constraint meal_logs_quality_flags_valid
    check (
      quality_flags <@ array[
        'added_sugar',
        'high_sodium',
        'low_fiber',
        'protein_low',
        'ultra_processed_indicator',
        'balanced_meal',
        'whole_food_emphasis',
        'late_heavy_meal',
        'timing_supportive'
      ]::text[]
    )
);

create index if not exists meal_logs_user_date_idx
on public.meal_logs(user_id, meal_date desc);

create index if not exists meal_logs_user_logged_at_idx
on public.meal_logs(user_id, logged_at desc);

create index if not exists meal_logs_user_source_idx
on public.meal_logs(user_id, source);

create index if not exists meal_logs_correction_idx
on public.meal_logs(correction_of_meal_id);

drop trigger if exists set_meal_logs_updated_at on public.meal_logs;
create trigger set_meal_logs_updated_at
before update on public.meal_logs
for each row execute function public.set_updated_at();

alter table public.meal_logs enable row level security;

drop policy if exists "meal_logs_select_own" on public.meal_logs;
create policy "meal_logs_select_own"
on public.meal_logs
for select using (auth.uid() = user_id);

drop policy if exists "meal_logs_insert_own" on public.meal_logs;
create policy "meal_logs_insert_own"
on public.meal_logs
for insert with check (auth.uid() = user_id);

drop policy if exists "meal_logs_update_own" on public.meal_logs;
create policy "meal_logs_update_own"
on public.meal_logs
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_logs_delete_own" on public.meal_logs;
create policy "meal_logs_delete_own"
on public.meal_logs
for delete using (auth.uid() = user_id);

create table if not exists public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calories_target integer,
  protein_g_target numeric(8,2),
  carbs_g_target numeric(8,2),
  fat_g_target numeric(8,2),
  fiber_g_target numeric(8,2),
  sodium_mg_limit numeric(10,2),
  confidence text not null,
  basis text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_targets_calories_target_valid
    check (calories_target is null or calories_target > 0),
  constraint nutrition_targets_protein_g_target_valid
    check (protein_g_target is null or protein_g_target >= 0),
  constraint nutrition_targets_carbs_g_target_valid
    check (carbs_g_target is null or carbs_g_target >= 0),
  constraint nutrition_targets_fat_g_target_valid
    check (fat_g_target is null or fat_g_target >= 0),
  constraint nutrition_targets_fiber_g_target_valid
    check (fiber_g_target is null or fiber_g_target >= 0),
  constraint nutrition_targets_sodium_mg_limit_valid
    check (sodium_mg_limit is null or sodium_mg_limit >= 0),
  constraint nutrition_targets_confidence_valid
    check (confidence in ('low', 'medium', 'high')),
  constraint nutrition_targets_basis_valid
    check (
      basis <@ array[
        'onboarding',
        'default',
        'manual_adjustment',
        'nutrition_history'
      ]::text[]
    )
);

create index if not exists nutrition_targets_user_active_idx
on public.nutrition_targets(user_id, is_active, created_at desc);

create unique index if not exists nutrition_targets_one_active_per_user_idx
on public.nutrition_targets(user_id)
where is_active = true;

drop trigger if exists set_nutrition_targets_updated_at on public.nutrition_targets;
create trigger set_nutrition_targets_updated_at
before update on public.nutrition_targets
for each row execute function public.set_updated_at();

alter table public.nutrition_targets enable row level security;

drop policy if exists "nutrition_targets_select_own" on public.nutrition_targets;
create policy "nutrition_targets_select_own"
on public.nutrition_targets
for select using (auth.uid() = user_id);

drop policy if exists "nutrition_targets_insert_own" on public.nutrition_targets;
create policy "nutrition_targets_insert_own"
on public.nutrition_targets
for insert with check (auth.uid() = user_id);

drop policy if exists "nutrition_targets_update_own" on public.nutrition_targets;
create policy "nutrition_targets_update_own"
on public.nutrition_targets
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "nutrition_targets_delete_own" on public.nutrition_targets;
create policy "nutrition_targets_delete_own"
on public.nutrition_targets
for delete using (auth.uid() = user_id);
