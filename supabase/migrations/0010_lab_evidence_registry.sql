-- Global Lab Evidence registry. These tables contain reviewed source material,
-- matching inputs, and internal notes. Mobile clients receive a safe projection
-- only through authenticated Edge Functions; no global table is client-readable.

create table public.lab_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  display_name text not null,
  source_type text not null check (source_type in (
    'healthi_curated', 'category_research', 'fda_regulatory', 'certification_body',
    'independent_lab', 'manufacturer', 'licensed_provider'
  )),
  enabled boolean not null default false,
  rights_status text not null default 'pending' check (rights_status in ('approved', 'pending', 'expired', 'revoked')),
  allow_client_summary boolean not null default false,
  allow_numeric_results boolean not null default false,
  rights_valid_from timestamptz,
  rights_valid_until timestamptz,
  rights_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lab_evidence_source_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lab_evidence_sources(id) on delete restrict,
  storage_bucket text not null default 'lab-evidence-private',
  storage_path text not null,
  external_reference text,
  content_hash text not null,
  document_date date,
  retrieved_at timestamptz not null default now(),
  rights_snapshot jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  unique (source_id, content_hash)
);

create table public.lab_product_identities (
  id uuid primary key default gen_random_uuid(),
  canonical_gtin text,
  product_name text not null,
  brand_name text,
  variant_name text,
  package_size text,
  market text,
  country text,
  formulation_valid_from date,
  formulation_valid_until date,
  identity_status text not null default 'reviewed' check (identity_status in ('candidate', 'reviewed', 'retired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (canonical_gtin is null or canonical_gtin ~ '^[0-9]{8,14}$')
);

create unique index lab_product_identities_gtin_current_idx
on public.lab_product_identities(canonical_gtin)
where canonical_gtin is not null and identity_status = 'reviewed';

create table public.lab_product_identity_aliases (
  id uuid primary key default gen_random_uuid(),
  product_identity_id uuid not null references public.lab_product_identities(id) on delete cascade,
  alias_type text not null check (alias_type in ('gtin', 'provider_id', 'product_name', 'brand_name')),
  alias_value text not null,
  provider text,
  created_at timestamptz not null default now(),
  unique (alias_type, alias_value, provider)
);

create unique index lab_product_identity_aliases_exact_idx
on public.lab_product_identity_aliases(alias_type, alias_value, coalesce(provider, ''));

create table public.lab_analytes (
  id uuid primary key default gen_random_uuid(),
  analyte_key text not null unique,
  display_name text not null,
  dimension text not null check (dimension in ('mass_concentration', 'mass', 'count_concentration', 'other')),
  aliases text[] not null default '{}',
  distinct_from text[] not null default '{}',
  active boolean not null default true
);

insert into public.lab_analytes (analyte_key, display_name, dimension, aliases, distinct_from) values
  ('lead', 'Lead', 'mass_concentration', array['lead', 'pb'], '{}'),
  ('cadmium', 'Cadmium', 'mass_concentration', array['cadmium', 'cd'], '{}'),
  ('total_arsenic', 'Total arsenic', 'mass_concentration', array['arsenic', 'total arsenic'], array['inorganic_arsenic']),
  ('inorganic_arsenic', 'Inorganic arsenic', 'mass_concentration', array['inorganic arsenic', 'ias'], array['total_arsenic']),
  ('mercury', 'Mercury', 'mass_concentration', array['mercury', 'total mercury', 'hg'], array['methylmercury']),
  ('methylmercury', 'Methylmercury', 'mass_concentration', array['methylmercury', 'methyl mercury'], array['mercury']),
  ('microplastics', 'Microplastics', 'count_concentration', array['microplastic', 'microplastics'], '{}')
on conflict (analyte_key) do nothing;

create table public.lab_evidence_records (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lab_evidence_sources(id) on delete restrict,
  source_document_id uuid references public.lab_evidence_source_documents(id) on delete restrict,
  product_identity_id uuid references public.lab_product_identities(id) on delete restrict,
  supersedes_record_id uuid references public.lab_evidence_records(id) on delete restrict,
  record_type text not null check (record_type in ('independent_lab_test', 'manufacturer_coa')),
  lot_number text,
  production_date date,
  laboratory_name text,
  laboratory_accreditation text,
  testing_method text,
  sample_acquisition text not null default 'unknown' check (sample_acquisition in ('retail_purchased', 'manufacturer_submitted', 'unknown')),
  sample_date date,
  publication_date date,
  expires_at timestamptz,
  revoked_at timestamptz,
  review_status text not null default 'draft' check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'superseded')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  published_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  check (review_status <> 'approved' or (reviewed_by is not null and reviewed_at is not null))
);

create table public.lab_analyte_results (
  id uuid primary key default gen_random_uuid(),
  evidence_record_id uuid not null references public.lab_evidence_records(id) on delete cascade,
  analyte_id uuid not null references public.lab_analytes(id) on delete restrict,
  measured_value numeric,
  unit text,
  reporting_limit numeric,
  result_status text not null check (result_status in ('detected', 'below_reporting_limit', 'above_reference', 'not_reported')),
  comparison_threshold numeric,
  threshold_unit text,
  threshold_authority text,
  note text,
  check (measured_value is null or measured_value >= 0),
  check (reporting_limit is null or reporting_limit >= 0)
);

create table public.lab_certifications (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lab_evidence_sources(id) on delete restrict,
  source_document_id uuid references public.lab_evidence_source_documents(id) on delete restrict,
  product_identity_id uuid references public.lab_product_identities(id) on delete restrict,
  certification_name text not null,
  certifying_body text not null,
  scope text not null check (scope in ('product', 'facility', 'brand')),
  valid_from date,
  valid_until date,
  revoked_at timestamptz,
  review_status text not null default 'draft' check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'superseded')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lab_regulatory_alerts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lab_evidence_sources(id) on delete restrict,
  source_document_id uuid references public.lab_evidence_source_documents(id) on delete restrict,
  product_identity_id uuid references public.lab_product_identities(id) on delete restrict,
  authority text not null,
  external_alert_id text not null,
  title text not null,
  alert_status text not null default 'unknown' check (alert_status in ('active', 'resolved', 'unknown')),
  lot_number text,
  published_at timestamptz,
  resolved_at timestamptz,
  source_url text,
  match_status text not null default 'pending_review' check (match_status in ('pending_review', 'approved_exact_lot', 'approved_exact_product', 'approved_related', 'withheld')),
  match_reason_codes text[] not null default '{}',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (source_id, external_alert_id)
);

create table public.lab_evidence_contexts (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lab_evidence_sources(id) on delete restrict,
  source_document_id uuid references public.lab_evidence_source_documents(id) on delete restrict,
  product_identity_id uuid references public.lab_product_identities(id) on delete restrict,
  scope text not null check (scope in ('related_variant', 'brand', 'category')),
  category_key text,
  title text not null,
  safe_summary text not null,
  publication_date date,
  expires_at timestamptz,
  revoked_at timestamptz,
  review_status text not null default 'draft' check (review_status in ('draft', 'in_review', 'approved', 'rejected', 'superseded')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.lab_match_decisions (
  id uuid primary key default gen_random_uuid(),
  product_identity_id uuid references public.lab_product_identities(id) on delete restrict,
  evidence_kind text not null check (evidence_kind in ('record', 'certification', 'regulatory_alert', 'context')),
  evidence_id uuid not null,
  match_level text,
  reason_codes text[] not null default '{}',
  decision text not null check (decision in ('approved', 'withheld', 'rejected')),
  decided_by uuid not null references auth.users(id) on delete restrict,
  decided_at timestamptz not null default now()
);

create table public.lab_ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lab_evidence_sources(id) on delete restrict,
  run_type text not null,
  status text not null check (status in ('started', 'completed', 'failed', 'partial')),
  cursor_value text,
  records_seen integer not null default 0,
  records_created integer not null default 0,
  records_withheld integer not null default 0,
  error_summary text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.lab_reviewer_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('reviewer', 'admin')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.lab_audit_events (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type text not null check (actor_type in ('reviewer', 'service', 'ingestion')),
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

insert into public.lab_evidence_sources (
  source_key, display_name, source_type, enabled, rights_status, allow_client_summary, allow_numeric_results
) values
  ('healthi_curated_registry', 'Healthi reviewed evidence registry', 'healthi_curated', true, 'approved', true, true),
  ('category_context', 'Healthi reviewed category context', 'category_research', true, 'approved', true, false),
  ('fda_regulatory', 'U.S. Food and Drug Administration', 'fda_regulatory', false, 'pending', true, false),
  ('consumerlab', 'ConsumerLab', 'licensed_provider', false, 'pending', false, false),
  ('clean_label_project', 'Clean Label Project', 'licensed_provider', false, 'pending', false, false),
  ('nsf', 'NSF', 'certification_body', false, 'pending', false, false),
  ('usp', 'USP', 'certification_body', false, 'pending', false, false),
  ('manufacturer_coa', 'Manufacturer certificates', 'manufacturer', false, 'pending', false, false),
  ('independent_labs', 'Independent laboratories', 'independent_lab', false, 'pending', false, false)
on conflict (source_key) do nothing;

-- Review actions are recorded explicitly by the reviewer-only Edge Function.
-- This trigger records service-side lifecycle and source-control changes that
-- must remain visible even when they are made by ingestion or operations jobs.
create or replace function public.audit_lab_evidence_lifecycle_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  audit_action text;
  audit_details jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'lab_evidence_sources' then
    if old.enabled is distinct from new.enabled
      or old.rights_status is distinct from new.rights_status
      or old.allow_client_summary is distinct from new.allow_client_summary
      or old.allow_numeric_results is distinct from new.allow_numeric_results
      or old.rights_valid_from is distinct from new.rights_valid_from
      or old.rights_valid_until is distinct from new.rights_valid_until then
      audit_action := 'source_rights_or_controls_changed';
      audit_details := jsonb_build_object('source_key', new.source_key);
    end if;
  elsif tg_table_name = 'lab_evidence_records' then
    if old.published_at is null and new.published_at is not null then
      audit_action := 'evidence_published';
    elsif old.revoked_at is distinct from new.revoked_at and new.revoked_at is not null then
      audit_action := 'evidence_revoked';
    elsif old.supersedes_record_id is distinct from new.supersedes_record_id
      or (old.review_status is distinct from 'superseded' and new.review_status = 'superseded') then
      audit_action := 'evidence_superseded';
    end if;
  elsif tg_table_name = 'lab_analyte_results' then
    audit_action := 'analyte_result_corrected';
  elsif tg_table_name = 'lab_certifications' then
    if old.revoked_at is distinct from new.revoked_at and new.revoked_at is not null then
      audit_action := 'certification_revoked';
    end if;
  elsif tg_table_name = 'lab_regulatory_alerts' then
    if old.alert_status is distinct from new.alert_status
      or old.match_status is distinct from new.match_status then
      audit_action := 'regulatory_alert_status_changed';
    end if;
  elsif tg_table_name = 'lab_evidence_contexts' then
    if old.revoked_at is distinct from new.revoked_at and new.revoked_at is not null then
      audit_action := 'evidence_context_revoked';
    end if;
  end if;

  if audit_action is not null then
    insert into public.lab_audit_events(actor_type, action, entity_type, entity_id, details)
    values ('service', audit_action, tg_table_name, new.id::text, audit_details);
  end if;
  return new;
end;
$$;

create trigger lab_evidence_sources_lifecycle_audit
after update on public.lab_evidence_sources
for each row execute function public.audit_lab_evidence_lifecycle_change();

create trigger lab_evidence_records_lifecycle_audit
after update on public.lab_evidence_records
for each row execute function public.audit_lab_evidence_lifecycle_change();

create trigger lab_analyte_results_lifecycle_audit
after update on public.lab_analyte_results
for each row execute function public.audit_lab_evidence_lifecycle_change();

create trigger lab_certifications_lifecycle_audit
after update on public.lab_certifications
for each row execute function public.audit_lab_evidence_lifecycle_change();

create trigger lab_regulatory_alerts_lifecycle_audit
after update on public.lab_regulatory_alerts
for each row execute function public.audit_lab_evidence_lifecycle_change();

create trigger lab_evidence_contexts_lifecycle_audit
after update on public.lab_evidence_contexts
for each row execute function public.audit_lab_evidence_lifecycle_change();

revoke all on function public.audit_lab_evidence_lifecycle_change() from public, anon, authenticated;

create index lab_evidence_records_product_idx on public.lab_evidence_records(product_identity_id, review_status);
create index lab_regulatory_alerts_product_idx on public.lab_regulatory_alerts(product_identity_id, match_status);
create index lab_contexts_category_idx on public.lab_evidence_contexts(category_key, review_status);
create index lab_audit_events_entity_idx on public.lab_audit_events(entity_type, entity_id, occurred_at desc);

insert into storage.buckets (id, name, public)
values ('lab-evidence-private', 'lab-evidence-private', false)
on conflict (id) do update set public = false;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'lab_evidence_sources', 'lab_evidence_source_documents', 'lab_product_identities',
    'lab_product_identity_aliases', 'lab_analytes', 'lab_evidence_records', 'lab_analyte_results',
    'lab_certifications', 'lab_regulatory_alerts', 'lab_evidence_contexts', 'lab_match_decisions',
    'lab_ingestion_runs', 'lab_reviewer_memberships', 'lab_audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon, authenticated', table_name);
  end loop;
end $$;

grant all on table
  public.lab_evidence_sources,
  public.lab_evidence_source_documents,
  public.lab_product_identities,
  public.lab_product_identity_aliases,
  public.lab_analytes,
  public.lab_evidence_records,
  public.lab_analyte_results,
  public.lab_certifications,
  public.lab_regulatory_alerts,
  public.lab_evidence_contexts,
  public.lab_match_decisions,
  public.lab_ingestion_runs,
  public.lab_reviewer_memberships,
  public.lab_audit_events
to service_role;

grant usage, select on sequence public.lab_audit_events_id_seq to service_role;
