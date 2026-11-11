-- Daywoven paid experience: database-level protection of premium writes.
-- Defaults to OFF; existing users' behavior is unchanged until a reviewed launch.
-- Account auth, onboarding, privacy controls, historical reads and deletion remain free.
-- This is not a StoreKit receipt validator; subscription-access verifies RevenueCat server-side.

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.billing_gate_settings (
  id smallint primary key check (id = 1),
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.billing_gate_settings enable row level security;
revoke all on public.billing_gate_settings from public, anon, authenticated;
grant select, update on public.billing_gate_settings to service_role;
insert into public.billing_gate_settings (id,enabled) values (1,false)
on conflict (id) do nothing;

create or replace function private.can_write_premium_data()
returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select
    coalesce((select not enabled from public.billing_gate_settings where id = 1), false)
    or exists (
      select 1 from public.subscription_status s
      where s.user_id = (select auth.uid())
        and s.status = 'active'
        and s.entitlement = 'pro'
        and (s.current_period_end is null or s.current_period_end > now())
    );
$$;
revoke all on function private.can_write_premium_data() from public, anon;
grant execute on function private.can_write_premium_data() to authenticated;

-- Restrictive policies ADD a condition to existing owner-only permissive RLS
-- policies. We restrict INSERT and UPDATE, leaving SELECT and DELETE available
-- so customers can still inspect/remove their previously saved records.
do $$
declare
  premium_table text;
begin
  foreach premium_table in array array[
    'ai_chat_sessions',
    'ai_context_snapshots',
    'ai_messages',
    'ai_safety_events',
    'allostatic_load_scores',
    'barcode_scans',
    'breathing_assessments',
    'circadian_logs',
    'circadian_profiles',
    'daily_checkins',
    'day_schedule_blocks',
    'exercise_library_items',
    'exercise_sets',
    'food_items',
    'food_logs',
    'food_pattern_profiles',
    'food_patterns',
    'food_response_logs',
    'foundation_scores',
    'hydration_logs',
    'meal_log_items',
    'meal_logs',
    'meal_plan_items',
    'meal_plans',
    'metric_observations',
    'metric_sources',
    'movement_assessments',
    'movement_pattern_permissions',
    'movement_screen_results',
    'nutrition_targets',
    'pantry_items',
    'post_meal_response_logs',
    'posture_assessments',
    'progression_targets',
    'readiness_scores',
    'rebalancing_sessions',
    'recipes',
    'session_outcomes',
    'shopping_list_items',
    'shopping_lists',
    'sleep_debt_history',
    'sleep_logs',
    'sleep_need_estimates',
    'sleep_sessions',
    'stress_assessments',
    'training_plans',
    'training_sessions',
    'user_food_products',
    'user_meal_library',
    'wearable_connections',
    'wearable_data_logs',
    'workout_exercise_entries',
    'workout_sessions',
    'workout_set_entries'
  ] loop
    if not exists (
      select 1 from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relname=premium_table
        and c.relkind in ('r','p') and c.relrowsecurity
    ) then
      raise exception 'RLS missing for premium table %', premium_table;
    end if;
    execute format(
      'create policy premium_insert_membership on public.%I as restrictive for insert to authenticated with check ((select private.can_write_premium_data()))',
      premium_table
    );
    execute format(
      'create policy premium_update_membership on public.%I as restrictive for update to authenticated using ((select private.can_write_premium_data())) with check ((select private.can_write_premium_data()))',
      premium_table
    );
  end loop;
end;
$$;

comment on function private.can_write_premium_data is
  'Server-authoritative gate for paid mutations. Fail closed when settings missing; bypassed while billing gate disabled. Never authorize from raw_user_meta_data or EXPO_PUBLIC values.';
