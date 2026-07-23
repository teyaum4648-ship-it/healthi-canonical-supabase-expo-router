begin;

select plan(11);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.lab_evidence_records'::regclass),
  'global evidence records have RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.lab_reviewer_memberships'::regclass),
  'reviewer memberships have RLS enabled'
);
select is(
  has_table_privilege('authenticated', 'public.lab_evidence_records', 'select'),
  false,
  'authenticated cannot read raw evidence'
);
select is(
  has_table_privilege('authenticated', 'public.lab_evidence_records', 'insert'),
  false,
  'authenticated cannot write global evidence'
);
select is(
  has_table_privilege('authenticated', 'public.lab_evidence_source_documents', 'select'),
  false,
  'authenticated cannot read raw document metadata'
);
select is(
  has_table_privilege('authenticated', 'public.lab_reviewer_memberships', 'select'),
  false,
  'authenticated cannot enumerate reviewers'
);
select is(
  has_table_privilege('authenticated', 'public.lab_evidence_feature_flags', 'select'),
  false,
  'feature flags remain server-owned'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_food_products' and column_name = 'lab_evidence_state'
  ),
  'user product evidence reference column exists'
);
select is(
  has_table_privilege('service_role', 'public.lab_evidence_records', 'select'),
  true,
  'service role can resolve reviewed evidence'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'lab_evidence_records_lifecycle_audit'
      and tgrelid = 'public.lab_evidence_records'::regclass
  ),
  'evidence lifecycle changes are audited'
);
select ok(
  exists (
    select 1 from pg_trigger
    where tgname = 'lab_analyte_results_lifecycle_audit'
      and tgrelid = 'public.lab_analyte_results'::regclass
  ),
  'analyte corrections are audited'
);

select * from finish();
rollback;
