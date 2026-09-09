-- Stores the deterministic onboarding plan result generated at onboarding completion.
-- Scores are 0-100 where higher means more support is needed in that dimension.

create table if not exists public.onboarding_plan_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  assessment_session_id uuid references public.assessment_sessions(id) on delete set null,
  archetype text not null,
  metabolic_type text not null,
  dimension_scores jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  plan jsonb not null default '{}'::jsonb,
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.onboarding_plan_results enable row level security;

create policy "onboarding_plan_results_select_own"
on public.onboarding_plan_results
for select using (auth.uid() = user_id);

create policy "onboarding_plan_results_insert_own"
on public.onboarding_plan_results
for insert with check (auth.uid() = user_id);

create policy "onboarding_plan_results_update_own"
on public.onboarding_plan_results
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "onboarding_plan_results_delete_own"
on public.onboarding_plan_results
for delete using (auth.uid() = user_id);

create index if not exists onboarding_plan_results_user_time_idx
on public.onboarding_plan_results(user_id, created_at desc);
