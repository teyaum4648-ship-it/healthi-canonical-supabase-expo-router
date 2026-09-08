-- Movement Intelligence V1 source-of-truth persistence.
-- Starter exercises and templates stay in app code; persisted rows are user-owned.

create table if not exists public.exercise_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null,
  movement_pattern text,
  primary_muscles text[] not null default '{}',
  equipment text[] not null default '{}',
  is_default boolean not null default false,
  source text not null default 'manual',
  source_confidence text not null default 'medium',
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_library_items_name_not_empty check (length(trim(name)) > 0),
  constraint exercise_library_items_category_valid check (
    category in ('strength', 'cardio', 'mobility', 'recovery', 'sport', 'other')
  ),
  constraint exercise_library_items_pattern_valid check (
    movement_pattern is null or movement_pattern in (
      'squat', 'hinge', 'push', 'pull', 'carry', 'lunge', 'rotation', 'locomotion', 'mobility', 'other'
    )
  ),
  constraint exercise_library_items_source_valid check (source in ('manual', 'demo', 'default')),
  constraint exercise_library_items_confidence_valid check (source_confidence in ('low', 'medium', 'high'))
);

create index if not exists exercise_library_items_user_name_idx
on public.exercise_library_items(user_id, name);

create index if not exists exercise_library_items_user_category_idx
on public.exercise_library_items(user_id, category);

drop trigger if exists set_exercise_library_items_updated_at on public.exercise_library_items;
create trigger set_exercise_library_items_updated_at
before update on public.exercise_library_items
for each row execute function public.set_updated_at();

alter table public.exercise_library_items enable row level security;

drop policy if exists "exercise_library_items_select_own" on public.exercise_library_items;
create policy "exercise_library_items_select_own"
on public.exercise_library_items for select using (auth.uid() = user_id);

drop policy if exists "exercise_library_items_insert_own" on public.exercise_library_items;
create policy "exercise_library_items_insert_own"
on public.exercise_library_items for insert with check (auth.uid() = user_id);

drop policy if exists "exercise_library_items_update_own" on public.exercise_library_items;
create policy "exercise_library_items_update_own"
on public.exercise_library_items for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "exercise_library_items_delete_own" on public.exercise_library_items;
create policy "exercise_library_items_delete_own"
on public.exercise_library_items for delete using (auth.uid() = user_id);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null,
  session_date date not null,
  title text not null,
  workout_type text not null,
  duration_minutes integer,
  perceived_effort integer,
  readiness_before text,
  session_note text,
  source text not null default 'manual',
  source_confidence text not null default 'medium',
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sessions_title_not_empty check (length(trim(title)) > 0),
  constraint workout_sessions_type_valid check (
    workout_type in ('strength', 'cardio', 'mobility', 'recovery', 'mixed', 'sport', 'other')
  ),
  constraint workout_sessions_duration_valid check (duration_minutes is null or duration_minutes >= 0),
  constraint workout_sessions_effort_valid check (perceived_effort is null or perceived_effort between 1 and 10),
  constraint workout_sessions_source_valid check (source in ('manual', 'demo')),
  constraint workout_sessions_confidence_valid check (source_confidence in ('low', 'medium', 'high'))
);

create index if not exists workout_sessions_user_date_idx
on public.workout_sessions(user_id, session_date, logged_at desc);

create index if not exists workout_sessions_user_type_idx
on public.workout_sessions(user_id, workout_type);

create index if not exists workout_sessions_user_created_idx
on public.workout_sessions(user_id, created_at desc);

drop trigger if exists set_workout_sessions_updated_at on public.workout_sessions;
create trigger set_workout_sessions_updated_at
before update on public.workout_sessions
for each row execute function public.set_updated_at();

alter table public.workout_sessions enable row level security;

drop policy if exists "workout_sessions_select_own" on public.workout_sessions;
create policy "workout_sessions_select_own"
on public.workout_sessions for select using (auth.uid() = user_id);

drop policy if exists "workout_sessions_insert_own" on public.workout_sessions;
create policy "workout_sessions_insert_own"
on public.workout_sessions for insert with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_update_own" on public.workout_sessions;
create policy "workout_sessions_update_own"
on public.workout_sessions for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_delete_own" on public.workout_sessions;
create policy "workout_sessions_delete_own"
on public.workout_sessions for delete using (auth.uid() = user_id);

create table if not exists public.workout_exercise_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_library_item_id uuid references public.exercise_library_items(id) on delete set null,
  exercise_name text not null,
  category text not null,
  order_index integer not null default 0,
  sets integer,
  reps integer,
  weight numeric,
  distance numeric,
  duration_minutes integer,
  effort integer,
  notes text,
  source text not null default 'manual',
  source_confidence text not null default 'medium',
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_exercise_entries_name_not_empty check (length(trim(exercise_name)) > 0),
  constraint workout_exercise_entries_category_valid check (
    category in ('strength', 'cardio', 'mobility', 'recovery', 'sport', 'other')
  ),
  constraint workout_exercise_entries_order_valid check (order_index >= 0),
  constraint workout_exercise_entries_sets_valid check (sets is null or sets >= 0),
  constraint workout_exercise_entries_reps_valid check (reps is null or reps >= 0),
  constraint workout_exercise_entries_weight_valid check (weight is null or weight >= 0),
  constraint workout_exercise_entries_distance_valid check (distance is null or distance >= 0),
  constraint workout_exercise_entries_duration_valid check (duration_minutes is null or duration_minutes >= 0),
  constraint workout_exercise_entries_effort_valid check (effort is null or effort between 1 and 10),
  constraint workout_exercise_entries_source_valid check (source in ('manual', 'demo')),
  constraint workout_exercise_entries_confidence_valid check (source_confidence in ('low', 'medium', 'high'))
);

create index if not exists workout_exercise_entries_session_idx
on public.workout_exercise_entries(workout_session_id, order_index);

create index if not exists workout_exercise_entries_user_name_idx
on public.workout_exercise_entries(user_id, exercise_name);

create index if not exists workout_exercise_entries_user_created_idx
on public.workout_exercise_entries(user_id, created_at desc);

drop trigger if exists set_workout_exercise_entries_updated_at on public.workout_exercise_entries;
create trigger set_workout_exercise_entries_updated_at
before update on public.workout_exercise_entries
for each row execute function public.set_updated_at();

alter table public.workout_exercise_entries enable row level security;

drop policy if exists "workout_exercise_entries_select_own" on public.workout_exercise_entries;
create policy "workout_exercise_entries_select_own"
on public.workout_exercise_entries for select using (auth.uid() = user_id);

drop policy if exists "workout_exercise_entries_insert_own" on public.workout_exercise_entries;
create policy "workout_exercise_entries_insert_own"
on public.workout_exercise_entries for insert with check (auth.uid() = user_id);

drop policy if exists "workout_exercise_entries_update_own" on public.workout_exercise_entries;
create policy "workout_exercise_entries_update_own"
on public.workout_exercise_entries for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "workout_exercise_entries_delete_own" on public.workout_exercise_entries;
create policy "workout_exercise_entries_delete_own"
on public.workout_exercise_entries for delete using (auth.uid() = user_id);
