-- Healthi initial schema
-- This schema favors flexible JSONB fields and event-style logs for an adaptive coaching product.
-- Run after creating a Supabase project.

create extension if not exists pgcrypto;

-- Timestamp helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  date_of_birth date,
  sex text check (sex is null or sex in ('female','male','intersex','prefer_not_to_say')),
  height_cm numeric,
  weight_kg numeric,
  timezone text not null default 'UTC',
  primary_goal text,
  secondary_goal text,
  training_experience text check (training_experience is null or training_experience in ('never_trained','beginner','intermediate','advanced')),
  onboarding_status text not null default 'not_started',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "profiles_delete_own" on public.profiles
for delete using (auth.uid() = id);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Optional automatic profile creation
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, timezone)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), 'UTC')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Identity and privacy
create table if not exists public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  units_weight text not null default 'lb',
  units_distance text not null default 'mi',
  units_volume text not null default 'oz',
  notification_preferences jsonb not null default '{}'::jsonb,
  quiet_hours jsonb not null default '{}'::jsonb,
  app_theme text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  consent_type text not null,
  granted boolean not null,
  version text,
  granted_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.privacy_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.data_export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  file_url text,
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.data_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending',
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.subscription_status (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  revenuecat_customer_id text,
  entitlement text,
  status text not null default 'free',
  current_period_end timestamptz,
  trial_end timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Onboarding and assessments
create table if not exists public.assessment_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_type text not null,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.assessment_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assessment_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_key text not null,
  answer jsonb not null,
  answered_at timestamptz not null default now()
);

create table if not exists public.baseline_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sleep_need_minutes_estimate int not null default 480,
  preferred_bedtime time,
  preferred_waketime time,
  hydration_target_ml int,
  food_constraints jsonb not null default '[]'::jsonb,
  training_capacity jsonb not null default '{}'::jsonb,
  movement_flags jsonb not null default '[]'::jsonb,
  posture_flags jsonb not null default '[]'::jsonb,
  stress_tendencies jsonb not null default '[]'::jsonb,
  digestion_tendencies jsonb not null default '[]'::jsonb,
  primary_goal text,
  initial_foundation_scores jsonb not null default '{}'::jsonb,
  calibration_status text not null default 'calibrating',
  generated_at timestamptz not null default now()
);

create table if not exists public.movement_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text
);

create table if not exists public.movement_screen_results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.movement_assessments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pattern text not null,
  comfort text not null,
  range_quality text,
  stability text,
  compensation_notes text,
  body_map_locations jsonb not null default '[]'::jsonb,
  user_notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.posture_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'self_report',
  posture_flags jsonb not null default '[]'::jsonb,
  confidence text not null default 'low',
  notes text,
  assessed_at timestamptz not null default now()
);

create table if not exists public.breathing_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'self_report',
  breathing_flags jsonb not null default '[]'::jsonb,
  confidence text not null default 'low',
  notes text,
  assessed_at timestamptz not null default now()
);

create table if not exists public.food_constraints (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  constraint_type text not null,
  constraint_value text not null,
  severity text not null default 'preference',
  notes text,
  created_at timestamptz not null default now()
);

-- Metrics and scores
create table if not exists public.metric_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  source_type text not null,
  external_source_id text,
  connected boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.metric_observations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  metric_type text not null,
  value numeric not null,
  unit text not null,
  source text not null,
  source_confidence text not null default 'medium',
  observed_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists metric_observations_user_metric_time_idx on public.metric_observations(user_id, metric_type, observed_at desc);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  sleep_start timestamptz,
  sleep_end timestamptz,
  duration_minutes int,
  quality_score numeric,
  source text not null default 'manual',
  confidence text not null default 'medium',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.sleep_debt_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score_date date not null,
  sleep_need_minutes int not null,
  actual_sleep_minutes int,
  nightly_debt_minutes int,
  seven_day_debt_minutes int,
  confidence text not null default 'medium',
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique(user_id, score_date)
);

create table if not exists public.circadian_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  average_wake_time time,
  average_bedtime time,
  timezone text not null default 'UTC',
  confidence text not null default 'low',
  updated_at timestamptz not null default now()
);

create table if not exists public.circadian_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  current_phase text,
  energy_curve jsonb not null default '[]'::jsonb,
  best_training_windows jsonb not null default '[]'::jsonb,
  best_walk_windows jsonb not null default '[]'::jsonb,
  caffeine_cutoff timestamptz,
  wind_down_start timestamptz,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.hydration_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_ml int not null,
  logged_at timestamptz not null default now(),
  source text not null default 'manual'
);

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  checkin_date date not null default current_date,
  body_feel text,
  soreness_map jsonb not null default '{}'::jsonb,
  digestion text,
  motivation text,
  available_minutes int,
  notes text,
  created_at timestamptz not null default now(),
  unique(user_id, checkin_date)
);

create table if not exists public.stress_assessments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_date date not null default current_date,
  rhr_bpm numeric,
  rhr_deviation_bpm numeric,
  physical_signals jsonb not null default '{}'::jsonb,
  behavioral_signals jsonb not null default '{}'::jsonb,
  performance_signals jsonb not null default '{}'::jsonb,
  flags_count int not null default 0,
  stress_level text,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.foundation_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score_date date not null,
  recovery_rhythm jsonb not null default '{}'::jsonb,
  nourishment jsonb not null default '{}'::jsonb,
  movement_capacity jsonb not null default '{}'::jsonb,
  mind_life_load jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, score_date)
);

create table if not exists public.readiness_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score_date date not null,
  readiness_score numeric not null,
  system_load_score numeric not null,
  vitality_score numeric not null,
  zone text not null,
  day_mode text not null,
  daily_priority text not null,
  confidence text not null,
  reason_codes text[] not null default '{}',
  input_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, score_date)
);

create table if not exists public.allostatic_load_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score_date date not null,
  score numeric not null,
  confidence text not null default 'low',
  reason_codes text[] not null default '{}',
  input_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(user_id, score_date)
);

-- Training and movement
create table if not exists public.exercise_library (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  patterns text[] not null default '{}',
  primary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  difficulty text,
  loading_type text,
  spinal_loading text,
  shoulder_demand text,
  hip_demand text,
  knee_demand text,
  prerequisites jsonb not null default '[]'::jsonb,
  contraindication_flags text[] not null default '{}',
  regression_ids uuid[] not null default '{}',
  progression_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.exercise_library enable row level security;
create policy "exercise_library_read_authenticated" on public.exercise_library for select to authenticated using (true);

create table if not exists public.movement_pattern_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  pattern text not null,
  permission text not null,
  reasons text[] not null default '{}',
  retest_after date,
  updated_at timestamptz not null default now(),
  unique(user_id, pattern)
);

create table if not exists public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal text not null,
  status text not null default 'active',
  plan jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  training_plan_id uuid references public.training_plans(id) on delete set null,
  session_type text not null,
  training_state text,
  title text not null,
  planned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  readiness_score_id uuid references public.readiness_scores(id) on delete set null,
  outcome text,
  reason_codes text[] not null default '{}',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id) on delete set null,
  exercise_name text,
  set_number int,
  load numeric,
  load_unit text,
  reps int,
  rpe numeric,
  rir numeric,
  tempo text,
  rest_seconds int,
  pain_score numeric,
  pain_locations jsonb not null default '[]'::jsonb,
  form_quality text,
  range_quality text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.progression_targets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid references public.exercise_library(id) on delete set null,
  exercise_name text,
  target_type text not null,
  previous_reference jsonb not null default '{}'::jsonb,
  target jsonb not null default '{}'::jsonb,
  achieved boolean,
  achieved_reason text,
  blocked_reasons text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.session_outcomes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.training_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  outcome text not null,
  reason_codes text[] not null default '{}',
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.rebalancing_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  duration_minutes int,
  components jsonb not null default '[]'::jsonb,
  primary_reason text,
  secondary_reasons text[] not null default '{}',
  evening_followup jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Food and shopping
create table if not exists public.food_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  brand text,
  barcode text,
  source text not null default 'manual',
  nutrition jsonb not null default '{}'::jsonb,
  ingredients text,
  ingredient_tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.food_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_item_id uuid references public.food_items(id) on delete set null,
  meal_id uuid,
  serving_description text,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  eaten_at timestamptz not null,
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.food_response_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_log_id uuid not null references public.food_logs(id) on delete cascade,
  response_score int check (response_score between 1 and 10),
  energy_after text,
  digestion text,
  mental_clarity text,
  mood text,
  cravings_after text,
  satiety text,
  notes text,
  logged_at timestamptz not null default now()
);

create table if not exists public.food_patterns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  food_item_id uuid references public.food_items(id) on delete cascade,
  avg_response_score numeric,
  log_count int not null default 0,
  confidence_label text not null default 'single_response',
  common_positive_effects jsonb not null default '[]'::jsonb,
  common_negative_effects jsonb not null default '[]'::jsonb,
  recommended_use text,
  updated_at timestamptz not null default now(),
  unique(user_id, food_item_id)
);

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  start_date date,
  end_date date,
  goal text,
  day_mode_context text,
  strategy_summary text,
  generated_by text not null default 'engine',
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day_index int,
  meal_label text,
  item jsonb not null default '{}'::jsonb,
  reason_codes text[] not null default '{}'
);

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  mode text not null default 'simple',
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  nutrition_estimate jsonb not null default '{}'::jsonb,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  store_context text,
  days int,
  servings int,
  strategy_summary text,
  explanation jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text,
  item_name text not null,
  quantity text,
  reason_codes text[] not null default '{}',
  notes text
);

create table if not exists public.pantry_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_name text not null,
  quantity text,
  expires_at date,
  created_at timestamptz not null default now()
);

create table if not exists public.barcode_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  barcode text not null,
  product_snapshot jsonb not null default '{}'::jsonb,
  evaluation_snapshot jsonb not null default '{}'::jsonb,
  scanned_at timestamptz not null default now()
);

-- AI
create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_chat_sessions(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null,
  content text not null,
  safety_flags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.ai_context_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid references public.ai_chat_sessions(id) on delete cascade,
  context jsonb not null default '{}'::jsonb,
  consent_id uuid references public.user_consents(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_safety_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null,
  severity text,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- Wearables
create table if not exists public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  connected boolean not null default true,
  permissions jsonb not null default '{}'::jsonb,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.wearable_data_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null,
  data_type text not null,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz,
  synced_at timestamptz not null default now()
);

-- Enable RLS and create own-data policies for user-owned tables.
do $$
declare
  t text;
begin
  foreach t in array array[
    'user_settings','user_consents','privacy_events','data_export_requests','data_deletion_requests','subscription_status',
    'assessment_sessions','assessment_answers','baseline_profiles','movement_assessments','movement_screen_results','posture_assessments','breathing_assessments','food_constraints',
    'metric_sources','metric_observations','sleep_logs','sleep_debt_history','circadian_profiles','circadian_logs','hydration_logs','daily_checkins','stress_assessments','foundation_scores','readiness_scores','allostatic_load_scores',
    'movement_pattern_permissions','training_plans','training_sessions','exercise_sets','progression_targets','session_outcomes','rebalancing_sessions',
    'food_logs','food_response_logs','food_patterns','meal_plans','meal_plan_items','recipes','shopping_lists','shopping_list_items','pantry_items','barcode_scans',
    'ai_chat_sessions','ai_messages','ai_context_snapshots','ai_safety_events','wearable_connections','wearable_data_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_select_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_update_own', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete_own', t);
    execute format('create policy %I on public.%I for select using (auth.uid() = user_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert with check (auth.uid() = user_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete using (auth.uid() = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- food_items can be user-owned or global. Users can read global records or their own records.
alter table public.food_items enable row level security;
create policy "food_items_select_global_or_own" on public.food_items for select using (user_id is null or auth.uid() = user_id);
create policy "food_items_insert_own" on public.food_items for insert with check (auth.uid() = user_id);
create policy "food_items_update_own" on public.food_items for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "food_items_delete_own" on public.food_items for delete using (auth.uid() = user_id);

-- Helpful indexes
create index if not exists readiness_scores_user_date_idx on public.readiness_scores(user_id, score_date desc);
create index if not exists foundation_scores_user_date_idx on public.foundation_scores(user_id, score_date desc);
create index if not exists training_sessions_user_time_idx on public.training_sessions(user_id, planned_at desc, completed_at desc);
create index if not exists food_logs_user_time_idx on public.food_logs(user_id, eaten_at desc);
create index if not exists food_response_logs_user_time_idx on public.food_response_logs(user_id, logged_at desc);
create index if not exists movement_pattern_permissions_user_pattern_idx on public.movement_pattern_permissions(user_id, pattern);
create index if not exists shopping_lists_user_time_idx on public.shopping_lists(user_id, created_at desc);
