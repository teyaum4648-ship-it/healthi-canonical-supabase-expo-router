-- Set-level workout logging for fast entry and previous-session continuity.
-- Aggregate workout_exercise_entries remain populated for backward-compatible scoring.

create table if not exists public.workout_set_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  workout_exercise_entry_id uuid not null references public.workout_exercise_entries(id) on delete cascade,
  set_index integer not null,
  weight numeric,
  reps integer,
  rpe numeric,
  rest_seconds integer,
  completed_at timestamptz,
  notes text,
  source text not null default 'manual',
  source_confidence text not null default 'medium',
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_set_entries_set_index_valid check (set_index >= 1),
  constraint workout_set_entries_weight_valid check (weight is null or weight >= 0),
  constraint workout_set_entries_reps_valid check (reps is null or reps >= 0),
  constraint workout_set_entries_rpe_valid check (rpe is null or rpe between 1 and 10),
  constraint workout_set_entries_rest_valid check (rest_seconds is null or rest_seconds >= 0),
  constraint workout_set_entries_source_valid check (source in ('manual', 'demo')),
  constraint workout_set_entries_confidence_valid check (source_confidence in ('low', 'medium', 'high')),
  constraint workout_set_entries_exercise_set_unique unique (workout_exercise_entry_id, set_index)
);

create index if not exists workout_set_entries_session_idx
on public.workout_set_entries(workout_session_id, workout_exercise_entry_id, set_index);

create index if not exists workout_set_entries_user_created_idx
on public.workout_set_entries(user_id, created_at desc);

drop trigger if exists set_workout_set_entries_updated_at on public.workout_set_entries;
create trigger set_workout_set_entries_updated_at
before update on public.workout_set_entries
for each row execute function public.set_updated_at();

alter table public.workout_set_entries enable row level security;

drop policy if exists "workout_set_entries_select_own" on public.workout_set_entries;
create policy "workout_set_entries_select_own"
on public.workout_set_entries for select
using (auth.uid() = user_id);

drop policy if exists "workout_set_entries_insert_own" on public.workout_set_entries;
create policy "workout_set_entries_insert_own"
on public.workout_set_entries for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.workout_sessions session
    where session.id = workout_set_entries.workout_session_id and session.user_id = auth.uid()
  )
  and exists (
    select 1 from public.workout_exercise_entries exercise
    where exercise.id = workout_set_entries.workout_exercise_entry_id
      and exercise.workout_session_id = workout_set_entries.workout_session_id
      and exercise.user_id = auth.uid()
  )
);

drop policy if exists "workout_set_entries_update_own" on public.workout_set_entries;
create policy "workout_set_entries_update_own"
on public.workout_set_entries for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.workout_sessions session
    where session.id = workout_set_entries.workout_session_id and session.user_id = auth.uid()
  )
  and exists (
    select 1 from public.workout_exercise_entries exercise
    where exercise.id = workout_set_entries.workout_exercise_entry_id
      and exercise.workout_session_id = workout_set_entries.workout_session_id
      and exercise.user_id = auth.uid()
  )
);

drop policy if exists "workout_set_entries_delete_own" on public.workout_set_entries;
create policy "workout_set_entries_delete_own"
on public.workout_set_entries for delete
using (auth.uid() = user_id);

revoke all on table public.workout_set_entries from anon;
grant select, insert, update, delete on table public.workout_set_entries to authenticated;
grant all on table public.workout_set_entries to service_role;
