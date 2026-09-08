-- Day Schedule Blocks source-of-truth persistence.
-- Generated day plans remain recomputable from schedule blocks and current engine inputs.

create table if not exists public.day_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  block_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  block_type text not null,
  title text,
  description text,
  location text,
  flexibility text not null default 'fixed',
  is_protected boolean not null default true,
  source text not null default 'manual',
  source_confidence text not null default 'medium',
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint day_schedule_blocks_time_order_valid
    check (end_at > start_at),
  constraint day_schedule_blocks_type_valid
    check (
      block_type in (
        'work',
        'class',
        'commute',
        'exercise',
        'meal',
        'free_time',
        'recovery',
        'social',
        'appointment',
        'sleep',
        'other'
      )
    ),
  constraint day_schedule_blocks_flexibility_valid
    check (flexibility in ('fixed', 'flexible', 'movable')),
  constraint day_schedule_blocks_source_valid
    check (source in ('manual', 'demo', 'calendar_import', 'system_suggested')),
  constraint day_schedule_blocks_source_confidence_valid
    check (source_confidence in ('low', 'medium', 'high'))
);

create index if not exists day_schedule_blocks_user_date_idx
on public.day_schedule_blocks(user_id, block_date, start_at);

create index if not exists day_schedule_blocks_user_range_idx
on public.day_schedule_blocks(user_id, start_at, end_at);

create index if not exists day_schedule_blocks_user_type_idx
on public.day_schedule_blocks(user_id, block_type);

drop trigger if exists set_day_schedule_blocks_updated_at on public.day_schedule_blocks;
create trigger set_day_schedule_blocks_updated_at
before update on public.day_schedule_blocks
for each row execute function public.set_updated_at();

alter table public.day_schedule_blocks enable row level security;

drop policy if exists "day_schedule_blocks_select_own" on public.day_schedule_blocks;
create policy "day_schedule_blocks_select_own"
on public.day_schedule_blocks
for select using (auth.uid() = user_id);

drop policy if exists "day_schedule_blocks_insert_own" on public.day_schedule_blocks;
create policy "day_schedule_blocks_insert_own"
on public.day_schedule_blocks
for insert with check (auth.uid() = user_id);

drop policy if exists "day_schedule_blocks_update_own" on public.day_schedule_blocks;
create policy "day_schedule_blocks_update_own"
on public.day_schedule_blocks
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "day_schedule_blocks_delete_own" on public.day_schedule_blocks;
create policy "day_schedule_blocks_delete_own"
on public.day_schedule_blocks
for delete using (auth.uid() = user_id);
