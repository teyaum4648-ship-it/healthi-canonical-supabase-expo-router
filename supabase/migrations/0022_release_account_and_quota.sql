-- A durable per-account UTC-day budget for paid photo requests. Only the trusted
-- Edge Function consumes it; clients cannot read, reset, or raise their allowance.
create table public.photo_estimate_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  requests integer not null check (requests between 1 and 25),
  primary key (user_id, usage_day)
);
alter table public.photo_estimate_daily_usage enable row level security;
revoke all on public.photo_estimate_daily_usage from public, anon, authenticated;
grant all on public.photo_estimate_daily_usage to service_role;

create function public.consume_photo_estimate_quota(account_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare affected integer;
begin
  if account_id is null then raise exception 'Account required'; end if;
  insert into public.photo_estimate_daily_usage as usage (user_id, usage_day, requests)
  values (account_id, (now() at time zone 'UTC')::date, 1)
  on conflict (user_id, usage_day) do update set requests = usage.requests + 1
    where usage.requests < 25;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;
revoke all on function public.consume_photo_estimate_quota(uuid) from public, anon, authenticated;
grant execute on function public.consume_photo_estimate_quota(uuid) to service_role;

-- Keep published reviewer decisions while removing the deleted person's identity.
-- The original RESTRICT foreign key otherwise prevents reviewer account deletion.
alter table public.lab_match_decisions drop constraint lab_match_decisions_decided_by_fkey;
alter table public.lab_match_decisions alter column decided_by drop not null;
alter table public.lab_match_decisions add constraint lab_match_decisions_decided_by_fkey
  foreign key (decided_by) references auth.users(id) on delete set null;
