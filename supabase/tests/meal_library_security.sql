-- Run after migrations on an isolated local Supabase/Postgres database.
-- All fixture rows and helper functions are rolled back.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', message; end if; end; $$;
insert into auth.users(id, email) values
  ('10000000-0000-4000-8000-000000000001', 'meal-owner@example.invalid'),
  ('10000000-0000-4000-8000-000000000002', 'meal-other@example.invalid');
insert into public.meal_logs(id,user_id,logged_at,meal_date,name,meal_type,source,source_confidence,calories) values
  ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','2026-09-01T12:00:00Z','2026-09-01','Lunch bowl','lunch','manual','medium',100),
  ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','2026-09-01T12:00:00Z','2026-09-01','Private lunch','lunch','manual','medium',999);
insert into public.user_food_products(id,user_id,name,provider) values
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Chickpeas','manual'),
  ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Private food','manual');
insert into public.meal_log_items(user_id,meal_log_id,logged_at,meal_type,name,servings,calories,source,source_confidence) values
  ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','2026-09-01T12:00:00Z','lunch','Chickpeas',1,100,'manual','medium');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.save_meal_collection_entry(jsonb_build_object('library_key','test-bowl','meal',jsonb_build_object('name','Lunch bowl'),
  'items',jsonb_build_array(jsonb_build_object('name','Chickpeas')),'is_starred',true,'is_saved',true));
select pg_temp.assert_true(jsonb_array_length(public.get_meal_collection())=1,'owner reads bookmark');
select pg_temp.assert_true(jsonb_array_length(public.search_meal_history('Chickpeas')->'meals')=1,'search contained food across dates');
select pg_temp.assert_true(jsonb_array_length(public.search_meal_history('Private')->'foods')=0,'search excludes other owner');
select public.replace_meal_items('20000000-0000-4000-8000-000000000001',
  '{"name":"Edited bowl","meal_type":"dinner","quality_flags":[],"reason_codes":[],"source_confidence":"low"}',
  '[{"name":"Chickpeas","servings":1.5,"calories":123.4,"protein_g":10,"sugar_g":0,"fiber_g":null,"source":"manual","source_confidence":"medium","reason_codes":[],"food_product_id":"30000000-0000-4000-8000-000000000001"}]');
select pg_temp.assert_true((select calories=123 and logged_at='2026-09-01T12:00:00Z' and meal_type='dinner' from public.meal_logs where id='20000000-0000-4000-8000-000000000001'),'edit retains date and recomputes aggregate');
select pg_temp.assert_true((select sugar_g=0 and fiber_g is null from public.meal_log_items where meal_log_id='20000000-0000-4000-8000-000000000001'),'null versus zero retained');
do $$ begin
  begin
    perform public.replace_meal_items('20000000-0000-4000-8000-000000000001',
      '{"name":"Bad","meal_type":"lunch","quality_flags":[],"reason_codes":[],"source_confidence":"low"}',
      '[{"name":"Bad","servings":1,"calories":-1,"source":"manual","source_confidence":"medium","reason_codes":[]}]');
    raise exception 'negative item unexpectedly accepted';
  exception when check_violation then null; end;
end; $$;
select pg_temp.assert_true((select name='Edited bowl' and calories=123 from public.meal_logs where id='20000000-0000-4000-8000-000000000001'),'failed edit preserves aggregate');
select pg_temp.assert_true((select count(*)=1 and min(calories)=123.4 from public.meal_log_items where meal_log_id='20000000-0000-4000-8000-000000000001'),'failed edit restores removed rows');
do $$ begin
  begin
    perform public.replace_meal_items('20000000-0000-4000-8000-000000000001',
      '{"name":"Bad","meal_type":"lunch"}',
      '[{"name":"Foreign food","servings":1,"food_product_id":"30000000-0000-4000-8000-000000000002"}]');
    raise exception 'foreign food unexpectedly accepted';
  exception when raise_exception then if sqlerrm <> 'Food not owned' then raise; end if; end;
end; $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
select pg_temp.assert_true(jsonb_array_length(public.get_meal_collection())=0,'cross-user bookmarks hidden');
do $$ begin
  begin
    perform public.replace_meal_items('20000000-0000-4000-8000-000000000001','{}','[]');
    raise exception 'other meal unexpectedly editable';
  exception when raise_exception then if sqlerrm <> 'Meal not found' then raise; end if; end;
  begin
    insert into public.user_meal_library(user_id,library_key,payload) values('10000000-0000-4000-8000-000000000001','forged','{}');
    raise exception 'forged owner unexpectedly accepted';
  exception when insufficient_privilege then null; end;
end; $$;
set local role anon;
do $$ begin
  begin perform public.get_meal_collection(); raise exception 'anonymous read unexpectedly accepted';
  exception when insufficient_privilege then null; end;
  begin perform public.replace_meal_items(null,'{}','[]'); raise exception 'anonymous edit unexpectedly accepted';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'PASS: owner persistence, cross-user isolation, literal history search, atomic edits, rollback, food ownership, anonymous denial' as result;
rollback;
