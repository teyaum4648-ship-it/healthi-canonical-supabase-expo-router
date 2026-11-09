-- Run after 0021 on an isolated Supabase/Postgres database. Synthetic fixtures and
-- every test write are rolled back. This exercises direct REST-equivalent table
-- privileges as authenticated, rather than relying only on trusted client code.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', message; end if; end; $$;
insert into auth.users(id,email) values
  ('71000000-0000-4000-8000-000000000001','integrity-owner@example.invalid'),
  ('71000000-0000-4000-8000-000000000002','integrity-other@example.invalid');
insert into public.meal_logs(id,user_id,logged_at,meal_date,meal_type,name,source,source_confidence,micronutrients) values
  ('72000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','2026-09-01T12:00:00Z','2026-09-01','lunch','Owner meal','manual','medium','{"calcium":100}'),
  ('72000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','2026-09-01T12:00:00Z','2026-09-01','lunch','Other meal','manual','medium','{"calcium":999}');
insert into public.user_food_products(id,user_id,name,provider) values
  ('73000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','Owned food','manual'),
  ('73000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','Other food','manual');
insert into public.workout_sessions(id,user_id,logged_at,session_date,title,workout_type) values
  ('74000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','2026-09-01T12:00:00Z','2026-09-01','Owner workout','strength'),
  ('74000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','2026-09-01T12:00:00Z','2026-09-01','Other workout','strength');
insert into public.exercise_library_items(id,user_id,name,category) values
  ('75000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000001','Owner exercise','strength'),
  ('75000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000002','Other exercise','strength');
set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000001',true);

insert into public.meal_log_items(id,user_id,meal_log_id,food_product_id,logged_at,meal_type,name) values
  ('76000000-0000-4000-8000-000000000001',auth.uid(),'72000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','2026-09-01T12:00:00Z','lunch','Owned item');
-- Standalone food logs and unlinked foods are still valid.
insert into public.meal_log_items(id,user_id,logged_at,meal_type,name) values
  ('76000000-0000-4000-8000-000000000002',auth.uid(),'2026-09-01T12:00:00Z','lunch','Standalone item');
select pg_temp.assert_true((select count(*)=2 from public.meal_log_items),'owned and nullable food references accepted');
do $$ begin
  begin
    insert into public.meal_log_items(user_id,meal_log_id,logged_at,meal_type,name) values
      (auth.uid(),'72000000-0000-4000-8000-000000000002','2026-09-01T12:00:00Z','lunch','Foreign meal link');
    raise exception 'foreign meal insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.meal_log_items(user_id,food_product_id,logged_at,meal_type,name) values
      (auth.uid(),'73000000-0000-4000-8000-000000000002','2026-09-01T12:00:00Z','lunch','Foreign food link');
    raise exception 'foreign food insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.meal_log_items set meal_log_id='72000000-0000-4000-8000-000000000002' where id='76000000-0000-4000-8000-000000000001';
    raise exception 'foreign meal update accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.meal_log_items set food_product_id='73000000-0000-4000-8000-000000000002' where id='76000000-0000-4000-8000-000000000001';
    raise exception 'foreign food update accepted';
  exception when insufficient_privilege then null; end;
end; $$;

insert into public.workout_exercise_entries(id,user_id,workout_session_id,exercise_library_item_id,exercise_name,category) values
  ('77000000-0000-4000-8000-000000000001',auth.uid(),'74000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','Owned exercise','strength'),
  ('77000000-0000-4000-8000-000000000002',auth.uid(),'74000000-0000-4000-8000-000000000001',null,'Custom exercise','strength');
select pg_temp.assert_true((select count(*)=2 from public.workout_exercise_entries),'owned and nullable exercise references accepted');
do $$ begin
  begin
    insert into public.workout_exercise_entries(user_id,workout_session_id,exercise_name,category) values
      (auth.uid(),'74000000-0000-4000-8000-000000000002','Foreign workout link','strength');
    raise exception 'foreign session insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.workout_exercise_entries(user_id,workout_session_id,exercise_library_item_id,exercise_name,category) values
      (auth.uid(),'74000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000002','Foreign exercise link','strength');
    raise exception 'foreign exercise insert accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.workout_exercise_entries set workout_session_id='74000000-0000-4000-8000-000000000002' where id='77000000-0000-4000-8000-000000000001';
    raise exception 'foreign session update accepted';
  exception when insufficient_privilege then null; end;
  begin
    update public.workout_exercise_entries set exercise_library_item_id='75000000-0000-4000-8000-000000000002' where id='77000000-0000-4000-8000-000000000001';
    raise exception 'foreign exercise update accepted';
  exception when insufficient_privilege then null; end;
end; $$;

select public.replace_meal_items('72000000-0000-4000-8000-000000000001',
  '{"name":"Edited meal","meal_type":"lunch","quality_flags":[],"reason_codes":[],"source_confidence":"medium","micronutrients":{"calcium":150,"iron":0}}',
  '[{"name":"Owned food","servings":1.5,"calories":150,"source":"manual","source_confidence":"medium","reason_codes":[],"food_product_id":"73000000-0000-4000-8000-000000000001"}]');
select pg_temp.assert_true((select micronutrients='{"calcium":150,"iron":0}'::jsonb and calories=150 from public.meal_logs where id='72000000-0000-4000-8000-000000000001'),'edit persists new nutrient panel and reported zero with macro total');
do $$ begin
  begin
    perform public.replace_meal_items('72000000-0000-4000-8000-000000000001',
      '{"name":"Invalid edit","meal_type":"lunch","quality_flags":[],"reason_codes":[],"source_confidence":"medium","micronutrients":[]}',
      '[{"name":"Changed food","servings":2,"calories":250,"source":"manual","source_confidence":"medium","reason_codes":[]}]');
    raise exception 'invalid micronutrient panel accepted';
  exception when check_violation then null; end;
end; $$;
select pg_temp.assert_true((select name='Edited meal' and calories=150 and micronutrients='{"calcium":150,"iron":0}'::jsonb from public.meal_logs where id='72000000-0000-4000-8000-000000000001'),'invalid panel rolls back aggregate');
select pg_temp.assert_true((select count(*)=1 and min(name)='Owned food' from public.meal_log_items where meal_log_id='72000000-0000-4000-8000-000000000001'),'invalid panel rolls back replaced item rows');
select public.replace_meal_items('72000000-0000-4000-8000-000000000001',
  '{"name":"No panel","meal_type":"lunch","quality_flags":[],"reason_codes":[],"source_confidence":"medium","micronutrients":null}',
  '[{"name":"Unreported food","servings":1,"source":"manual","source_confidence":"medium","reason_codes":[]}]');
select pg_temp.assert_true((select micronutrients is null from public.meal_logs where id='72000000-0000-4000-8000-000000000001'),'explicitly absent panel clears old nutrients');
-- Older clients omit the panel: keeping yesterday's nutrient values would be false.
update public.meal_logs set micronutrients='{"calcium":250}' where id='72000000-0000-4000-8000-000000000001';
select public.replace_meal_items('72000000-0000-4000-8000-000000000001',
  '{"name":"Legacy edit","meal_type":"lunch","quality_flags":[],"reason_codes":[],"source_confidence":"medium"}',
  '[{"name":"Unreported food","servings":1,"source":"manual","source_confidence":"medium","reason_codes":[]}]');
select pg_temp.assert_true((select micronutrients is null from public.meal_logs where id='72000000-0000-4000-8000-000000000001'),'omitted panel clears stale nutrients');
select set_config('request.jwt.claim.sub','71000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true((select micronutrients='{"calcium":999}'::jsonb from public.meal_logs),'other owner nutrient panel unchanged');
select pg_temp.assert_true((select count(*)=0 from public.workout_exercise_entries),'exercise rows remain isolated');
set local role anon;
do $$ begin
  begin
    perform public.replace_meal_items('72000000-0000-4000-8000-000000000001','{}','[]');
    raise exception 'anonymous edit accepted';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'PASS: owned/null parent references, cross-owner direct insert/update denial, micronutrient edit/null/legacy behavior and transactional rollback' as result;
rollback;
