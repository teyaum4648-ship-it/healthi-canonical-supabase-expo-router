-- Food personalization source-of-truth persistence.
-- Food Pattern Profiles and Post-Meal Response Logs support later adaptive recommendations.

create table if not exists public.food_pattern_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null,
  confidence text not null,
  pattern_label text not null,
  scores jsonb not null,
  macro_tendency jsonb not null,
  meal_timing_tendency jsonb not null,
  response_tendencies jsonb not null,
  is_active boolean not null default true,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint food_pattern_profiles_source_valid
    check (source in ('food_pattern_test', 'manual_adjustment', 'adaptive_update')),
  constraint food_pattern_profiles_confidence_valid
    check (confidence in ('low', 'medium', 'high')),
  constraint food_pattern_profiles_pattern_label_valid
    check (
      pattern_label in (
        'steady_balanced',
        'protein_forward',
        'carb_supported',
        'lighter_frequent',
        'evening_sensitive',
        'calibrating'
      )
    )
);

create index if not exists food_pattern_profiles_user_active_idx
on public.food_pattern_profiles(user_id, is_active, created_at desc);

create unique index if not exists food_pattern_profiles_one_active_per_user_idx
on public.food_pattern_profiles(user_id)
where is_active = true;

drop trigger if exists set_food_pattern_profiles_updated_at on public.food_pattern_profiles;
create trigger set_food_pattern_profiles_updated_at
before update on public.food_pattern_profiles
for each row execute function public.set_updated_at();

alter table public.food_pattern_profiles enable row level security;

drop policy if exists "food_pattern_profiles_select_own" on public.food_pattern_profiles;
create policy "food_pattern_profiles_select_own"
on public.food_pattern_profiles
for select using (auth.uid() = user_id);

drop policy if exists "food_pattern_profiles_insert_own" on public.food_pattern_profiles;
create policy "food_pattern_profiles_insert_own"
on public.food_pattern_profiles
for insert with check (auth.uid() = user_id);

drop policy if exists "food_pattern_profiles_update_own" on public.food_pattern_profiles;
create policy "food_pattern_profiles_update_own"
on public.food_pattern_profiles
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "food_pattern_profiles_delete_own" on public.food_pattern_profiles;
create policy "food_pattern_profiles_delete_own"
on public.food_pattern_profiles
for delete using (auth.uid() = user_id);

create table if not exists public.post_meal_response_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_log_id uuid references public.meal_logs(id) on delete set null,
  responded_at timestamptz not null,
  minutes_after_meal integer,
  overall_score integer not null,
  digestion text,
  energy text,
  appetite text,
  focus text,
  cravings text,
  notes text,
  confidence text not null,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint post_meal_response_logs_overall_score_valid
    check (overall_score between 1 and 10),
  constraint post_meal_response_logs_minutes_after_meal_valid
    check (minutes_after_meal is null or minutes_after_meal >= 0),
  constraint post_meal_response_logs_digestion_valid
    check (digestion is null or digestion in ('good', 'neutral', 'heavy', 'uncomfortable')),
  constraint post_meal_response_logs_energy_valid
    check (energy is null or energy in ('better', 'steady', 'dip')),
  constraint post_meal_response_logs_appetite_valid
    check (appetite is null or appetite in ('stable', 'hungry_soon', 'overfull')),
  constraint post_meal_response_logs_focus_valid
    check (focus is null or focus in ('clear', 'neutral', 'foggy')),
  constraint post_meal_response_logs_cravings_valid
    check (cravings is null or cravings in ('none', 'mild', 'strong')),
  constraint post_meal_response_logs_confidence_valid
    check (confidence in ('low', 'medium', 'high'))
);

create index if not exists post_meal_response_logs_user_responded_idx
on public.post_meal_response_logs(user_id, responded_at desc);

create index if not exists post_meal_response_logs_meal_idx
on public.post_meal_response_logs(meal_log_id);

drop trigger if exists set_post_meal_response_logs_updated_at on public.post_meal_response_logs;
create trigger set_post_meal_response_logs_updated_at
before update on public.post_meal_response_logs
for each row execute function public.set_updated_at();

alter table public.post_meal_response_logs enable row level security;

drop policy if exists "post_meal_response_logs_select_own" on public.post_meal_response_logs;
create policy "post_meal_response_logs_select_own"
on public.post_meal_response_logs
for select using (auth.uid() = user_id);

drop policy if exists "post_meal_response_logs_insert_own" on public.post_meal_response_logs;
create policy "post_meal_response_logs_insert_own"
on public.post_meal_response_logs
for insert with check (auth.uid() = user_id);

drop policy if exists "post_meal_response_logs_update_own" on public.post_meal_response_logs;
create policy "post_meal_response_logs_update_own"
on public.post_meal_response_logs
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "post_meal_response_logs_delete_own" on public.post_meal_response_logs;
create policy "post_meal_response_logs_delete_own"
on public.post_meal_response_logs
for delete using (auth.uid() = user_id);
