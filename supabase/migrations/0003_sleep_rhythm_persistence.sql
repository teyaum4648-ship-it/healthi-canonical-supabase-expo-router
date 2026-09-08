-- Sleep + Rhythm source-of-truth persistence.
-- Derived sleep debt and circadian rhythm outputs remain recomputable from these tables.

create table if not exists public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  sleep_start_at timestamptz,
  sleep_end_at timestamptz,
  duration_minutes integer,
  sleep_quality integer,
  source text not null,
  source_confidence text not null,
  corrected_by_user boolean not null default false,
  confirmed_by_user boolean not null default false,
  correction_of_session_id uuid references public.sleep_sessions(id) on delete set null,
  original_source_id text,
  raw_source_payload jsonb,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_sessions_duration_minutes_valid
    check (duration_minutes is null or duration_minutes >= 0),
  constraint sleep_sessions_sleep_quality_valid
    check (sleep_quality is null or sleep_quality between 1 and 5),
  constraint sleep_sessions_time_order_valid
    check (sleep_end_at is null or sleep_start_at is null or sleep_end_at > sleep_start_at),
  constraint sleep_sessions_source_valid
    check (
      source in (
        'manual',
        'estimated',
        'demo',
        'phone_motion',
        'phone_activity',
        'healthkit',
        'health_connect',
        'wearable',
        'user_corrected'
      )
    ),
  constraint sleep_sessions_source_confidence_valid
    check (source_confidence in ('low', 'medium', 'high'))
);

create index if not exists sleep_sessions_user_date_idx
on public.sleep_sessions(user_id, date desc);

create index if not exists sleep_sessions_user_source_idx
on public.sleep_sessions(user_id, source);

create index if not exists sleep_sessions_correction_idx
on public.sleep_sessions(correction_of_session_id);

drop trigger if exists set_sleep_sessions_updated_at on public.sleep_sessions;
create trigger set_sleep_sessions_updated_at
before update on public.sleep_sessions
for each row execute function public.set_updated_at();

alter table public.sleep_sessions enable row level security;

drop policy if exists "sleep_sessions_select_own" on public.sleep_sessions;
create policy "sleep_sessions_select_own"
on public.sleep_sessions
for select using (auth.uid() = user_id);

drop policy if exists "sleep_sessions_insert_own" on public.sleep_sessions;
create policy "sleep_sessions_insert_own"
on public.sleep_sessions
for insert with check (auth.uid() = user_id);

drop policy if exists "sleep_sessions_update_own" on public.sleep_sessions;
create policy "sleep_sessions_update_own"
on public.sleep_sessions
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sleep_sessions_delete_own" on public.sleep_sessions;
create policy "sleep_sessions_delete_own"
on public.sleep_sessions
for delete using (auth.uid() = user_id);

create table if not exists public.sleep_need_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  minutes integer not null,
  confidence text not null,
  basis text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_need_estimates_minutes_valid
    check (minutes between 300 and 720),
  constraint sleep_need_estimates_confidence_valid
    check (confidence in ('low', 'medium', 'high')),
  constraint sleep_need_estimates_basis_valid
    check (
      basis <@ array[
        'onboarding',
        'default',
        'sleep_history',
        'manual_adjustment'
      ]::text[]
    )
);

create index if not exists sleep_need_estimates_user_active_idx
on public.sleep_need_estimates(user_id, is_active, created_at desc);

create unique index if not exists sleep_need_estimates_one_active_per_user_idx
on public.sleep_need_estimates(user_id)
where is_active = true;

drop trigger if exists set_sleep_need_estimates_updated_at on public.sleep_need_estimates;
create trigger set_sleep_need_estimates_updated_at
before update on public.sleep_need_estimates
for each row execute function public.set_updated_at();

alter table public.sleep_need_estimates enable row level security;

drop policy if exists "sleep_need_estimates_select_own" on public.sleep_need_estimates;
create policy "sleep_need_estimates_select_own"
on public.sleep_need_estimates
for select using (auth.uid() = user_id);

drop policy if exists "sleep_need_estimates_insert_own" on public.sleep_need_estimates;
create policy "sleep_need_estimates_insert_own"
on public.sleep_need_estimates
for insert with check (auth.uid() = user_id);

drop policy if exists "sleep_need_estimates_update_own" on public.sleep_need_estimates;
create policy "sleep_need_estimates_update_own"
on public.sleep_need_estimates
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "sleep_need_estimates_delete_own" on public.sleep_need_estimates;
create policy "sleep_need_estimates_delete_own"
on public.sleep_need_estimates
for delete using (auth.uid() = user_id);

