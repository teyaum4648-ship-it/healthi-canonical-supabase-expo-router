-- Runtime controls, append-only audit protection, safe aggregation, and
-- server-side reviewer authorization. These functions are service-only.

create table public.lab_evidence_feature_flags (
  flag_key text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.lab_evidence_feature_flags (flag_key, enabled) values
  ('lab_evidence_lookup', true),
  ('healthi_curated_registry', true),
  ('category_context', true),
  ('fda_regulatory_ingestion', false),
  ('manufacturer_coa', false),
  ('independent_labs', false),
  ('licensed_providers', false),
  ('licensed_numeric_evidence', false),
  ('consumerlab', false),
  ('clean_label_project', false),
  ('nsf', false),
  ('usp', false),
  ('reviewer_console', false)
on conflict (flag_key) do nothing;

alter table public.lab_evidence_feature_flags enable row level security;
revoke all on table public.lab_evidence_feature_flags from anon, authenticated;
grant all on table public.lab_evidence_feature_flags to service_role;

create or replace function public.lab_evidence_is_reviewer(candidate_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lab_reviewer_memberships
    where user_id = candidate_user_id and active
  );
$$;

create or replace function public.lab_evidence_source_usable(candidate_source_id uuid, at_time timestamptz default now())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select enabled
      and rights_status = 'approved'
      and allow_client_summary
      and (rights_valid_from is null or rights_valid_from <= at_time)
      and (rights_valid_until is null or rights_valid_until > at_time)
    from public.lab_evidence_sources
    where id = candidate_source_id
  ), false);
$$;

create or replace function public.prevent_lab_audit_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'lab_audit_events is append-only';
end;
$$;

create trigger lab_audit_events_append_only
before update or delete on public.lab_audit_events
for each row execute function public.prevent_lab_audit_mutation();

create table public.lab_coverage_daily_metrics (
  metric_date date not null,
  resolution_status text not null,
  request_count bigint not null default 0 check (request_count >= 0),
  primary key (metric_date, resolution_status)
);

alter table public.lab_coverage_daily_metrics enable row level security;
revoke all on table public.lab_coverage_daily_metrics from anon, authenticated;
grant all on table public.lab_coverage_daily_metrics to service_role;

create or replace function public.record_lab_coverage_metric(candidate_status text, candidate_date date default current_date)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.lab_coverage_daily_metrics(metric_date, resolution_status, request_count)
  values (candidate_date, candidate_status, 1)
  on conflict (metric_date, resolution_status)
  do update set request_count = public.lab_coverage_daily_metrics.request_count + 1;
$$;

revoke all on function public.lab_evidence_is_reviewer(uuid) from public, anon, authenticated;
revoke all on function public.lab_evidence_source_usable(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.record_lab_coverage_metric(text, date) from public, anon, authenticated;
grant execute on function public.lab_evidence_is_reviewer(uuid) to service_role;
grant execute on function public.lab_evidence_source_usable(uuid, timestamptz) to service_role;
grant execute on function public.record_lab_coverage_metric(text, date) to service_role;
