-- Run after 0015, 0016 and 0017. Synthetic rows and all changes roll back.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', message; end if; end; $$;
insert into auth.users(id,email) values
  ('40000000-0000-4000-8000-000000000001','nutrition-owner@example.invalid'),
  ('40000000-0000-4000-8000-000000000002','nutrition-other@example.invalid');

do $$ declare t text; p text; begin
  foreach t in array array['nutrition_targets','meal_logs','meal_log_items','user_food_products','user_meal_library'] loop
    perform pg_temp.assert_true((select relrowsecurity from pg_class where oid=('public.'||t)::regclass),t||' RLS enabled');
    foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
      perform pg_temp.assert_true(not has_table_privilege('anon','public.'||t,p),t||' denies anonymous '||p);
      perform pg_temp.assert_true(has_table_privilege('authenticated','public.'||t,p) = (p in ('SELECT','INSERT','UPDATE','DELETE')),t||' bounded authenticated '||p);
      perform pg_temp.assert_true(has_table_privilege('service_role','public.'||t,p),t||' preserves service role '||p);
    end loop;
  end loop;
end; $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select public.save_nutrition_goal_setup('{"version":"nutrition_goals_v1","status":"estimated","answers":{"age":30},"targets":{"calories_target":2300,"protein_g_target":120,"carbs_g_target":275,"fat_g_target":80}}');
select pg_temp.assert_true((select calories_target=2300 and protein_g_target=120 and goal_setup->'answers'->>'age'='30' from public.nutrition_targets where is_active),'goal round trip');
select public.save_nutrition_goal_setup('{"version":"nutrition_goals_v1","status":"estimated","answers":{"age":30},"targets":{"calories_target":2400,"protein_g_target":125,"carbs_g_target":285,"fat_g_target":85}}');
select pg_temp.assert_true((select count(*)=2 and count(*) filter(where is_active)=1 from public.nutrition_targets),'one active goal with history');
do $$ begin
  begin
    perform public.save_nutrition_goal_setup('{"version":"nutrition_goals_v1","status":"estimated","answers":{},"targets":{"calories_target":1}}');
    raise exception 'invalid goal accepted';
  exception when raise_exception then if sqlerrm <> 'Invalid calorie estimate' then raise; end if; end;
  begin
    perform public.save_nutrition_goal_setup('{"version":"nutrition_goals_v1","status":"estimated","answers":{},"targets":{"calories_target":2400,"protein_g_target":-1}}');
    raise exception 'invalid macro accepted';
  exception when check_violation then null; end;
end; $$;
select pg_temp.assert_true((select count(*)=2 and count(*) filter(where is_active and calories_target=2400)=1 from public.nutrition_targets),'failed goal writes roll back old target deactivation');

insert into public.user_food_products(id,user_id,name,provider,source) values
  ('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','USDA fixture','usda_food_data_central','usda_food_data_central');
insert into public.meal_logs(id,user_id,logged_at,meal_date,name,meal_type,source,source_confidence) values
  ('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-09-01T12:00:00Z','2026-09-01','USDA lunch','lunch','manual','medium');
select public.replace_meal_items('60000000-0000-4000-8000-000000000001',
  '{"name":"USDA lunch","meal_type":"lunch","source_confidence":"medium","reason_codes":[],"quality_flags":[]}',
  '[{"name":"USDA fixture","servings":1,"calories":200,"provider":"usda_food_data_central","source":"search","source_confidence":"medium","reason_codes":[],"food_product_id":"50000000-0000-4000-8000-000000000001"}]');
select pg_temp.assert_true((select provider='usda_food_data_central' and calories=200 from public.meal_log_items where meal_log_id='60000000-0000-4000-8000-000000000001'),'USDA diary provenance round trip');
select pg_temp.assert_true(jsonb_array_length(public.search_meal_history('USDA')->'foods')=1,'USDA saved food searchable');
do $$ begin
  begin
    insert into public.user_food_products(user_id,name,provider) values(auth.uid(),'Bad provider','invented_provider');
    raise exception 'unknown provider accepted';
  exception when check_violation then null; end;
end; $$;

select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select count(*)=0 from public.nutrition_targets),'other account goals hidden');
select pg_temp.assert_true((select count(*)=0 from public.user_food_products),'other account USDA foods hidden');
select pg_temp.assert_true((select count(*)=0 from public.meal_log_items),'other account USDA diary items hidden');
do $$ declare changed integer; begin
  update public.nutrition_targets set calories_target=2500 where user_id='40000000-0000-4000-8000-000000000001';
  get diagnostics changed = row_count;
  perform pg_temp.assert_true(changed=0,'cross-account goal update denied');
  begin
    insert into public.nutrition_targets(user_id,confidence,basis) values('40000000-0000-4000-8000-000000000001','low',array['onboarding']);
    raise exception 'forged goal owner accepted';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
select public.save_nutrition_goal_setup('{"version":"nutrition_goals_v1","status":"guidance","answers":{},"targets":{}}');
select pg_temp.assert_true((select calories_target is null and protein_g_target is null and carbs_g_target is null and fat_g_target is null and goal_setup->>'status'='guidance' from public.nutrition_targets where is_active),'guidance preserves absent numeric targets');
set local role anon;
do $$ begin
  begin perform public.save_nutrition_goal_setup('{}'); raise exception 'anonymous goal write accepted';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'PASS: bounded grants, RLS, goal round trips/history/rollback, USDA persistence/search, owner isolation, anonymous denial' as result;
rollback;
