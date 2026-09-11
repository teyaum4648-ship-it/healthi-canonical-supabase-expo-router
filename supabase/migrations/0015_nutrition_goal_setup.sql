-- One-time quiz metadata belongs to the existing owner-scoped target row.
-- Food tab writes via the atomic RPC; all target consumers read the same row.
-- Existing nutrition_targets RLS remains enabled and unchanged.
alter table public.nutrition_targets add column if not exists goal_setup jsonb;

create or replace function public.save_nutrition_goal_setup(setup jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare owner_id uuid := auth.uid(); t jsonb := setup->'targets';
begin
  if owner_id is null then raise exception 'Authentication required'; end if;
  if setup->>'version' is distinct from 'nutrition_goals_v1'
     or coalesce(setup->>'status','') not in ('estimated','guidance')
     or jsonb_typeof(setup->'answers') is distinct from 'object'
     or jsonb_typeof(t) is distinct from 'object'
     or octet_length(setup::text) > 10000 then raise exception 'Invalid goal setup'; end if;
  if setup->>'status' = 'estimated' and (t->>'calories_target' is null or (t->>'calories_target')::numeric not between 1500 and 4500) then raise exception 'Invalid calorie estimate'; end if;
  -- Per-owner transaction lock also makes simultaneous first-time submissions safe.
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text, 0));
  update public.nutrition_targets set is_active = false where user_id = owner_id and is_active;
  insert into public.nutrition_targets(user_id, calories_target, protein_g_target, carbs_g_target, fat_g_target, confidence, basis, is_active, goal_setup)
  values (owner_id,
    case when setup->>'status'='estimated' then (t->>'calories_target')::integer end,
    case when setup->>'status'='estimated' then (t->>'protein_g_target')::numeric end,
    case when setup->>'status'='estimated' then (t->>'carbs_g_target')::numeric end,
    case when setup->>'status'='estimated' then (t->>'fat_g_target')::numeric end,
    'low', array['onboarding'], true, setup);
end; $$;
revoke all on function public.save_nutrition_goal_setup(jsonb) from public, anon;
grant execute on function public.save_nutrition_goal_setup(jsonb) to authenticated;
