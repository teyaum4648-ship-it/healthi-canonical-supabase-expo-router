-- Synthetic users only; all changes roll back. Run after migration 0022.
begin;
create function pg_temp.assert_true(ok boolean, message text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'FAILED: %', message; end if; end; $$;
insert into auth.users(id,email) values
 ('81000000-0000-4000-8000-000000000001','delete-owner@example.invalid'),
 ('81000000-0000-4000-8000-000000000002','delete-other@example.invalid');
insert into public.meal_logs(user_id,logged_at,meal_date,meal_type,name,source,source_confidence) values
 ('81000000-0000-4000-8000-000000000001',now(),current_date,'lunch','Owner meal','manual','medium'),
 ('81000000-0000-4000-8000-000000000002',now(),current_date,'lunch','Other meal','manual','medium');
insert into public.lab_match_decisions(evidence_kind,evidence_id,decision,decided_by) values
 ('record','81000000-0000-4000-8000-000000000003','withheld','81000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$ begin
 begin
  perform public.consume_photo_estimate_quota('81000000-0000-4000-8000-000000000001');
  raise exception 'client invoked privileged quota';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.photo_estimate_daily_usage;
  raise exception 'client reset quota';
 exception when insufficient_privilege then null; end;
end; $$;
reset role;
set local role service_role;
do $$ begin
 for i in 1..25 loop
  perform pg_temp.assert_true(public.consume_photo_estimate_quota('81000000-0000-4000-8000-000000000001'),'first 25 reservations accepted');
 end loop;
 perform pg_temp.assert_true(not public.consume_photo_estimate_quota('81000000-0000-4000-8000-000000000001'),'26th reservation denied');
 perform pg_temp.assert_true(public.consume_photo_estimate_quota('81000000-0000-4000-8000-000000000002'),'separate account budget');
end; $$;
reset role;
delete from auth.users where id='81000000-0000-4000-8000-000000000001';
select pg_temp.assert_true(not exists(select 1 from public.profiles where id='81000000-0000-4000-8000-000000000001'),'profile cascades');
select pg_temp.assert_true(not exists(select 1 from public.meal_logs where user_id='81000000-0000-4000-8000-000000000001'),'meal cascades');
select pg_temp.assert_true(not exists(select 1 from public.photo_estimate_daily_usage where user_id='81000000-0000-4000-8000-000000000001'),'quota cascades');
select pg_temp.assert_true(exists(select 1 from public.meal_logs where user_id='81000000-0000-4000-8000-000000000002'),'other account retained');
select pg_temp.assert_true(exists(select 1 from public.lab_match_decisions where evidence_id='81000000-0000-4000-8000-000000000003' and decided_by is null),'review retained without deleted identity');
rollback;
