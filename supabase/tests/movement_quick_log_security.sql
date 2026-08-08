begin;

select plan(9);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.workout_set_entries'::regclass),
  'workout set entries have RLS enabled'
);
select ok(
  not has_table_privilege('anon', 'public.workout_set_entries', 'select'),
  'anonymous clients cannot read workout sets'
);
select ok(
  has_table_privilege('authenticated', 'public.workout_set_entries', 'select'),
  'authenticated users can select through owner RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.workout_set_entries', 'insert'),
  'authenticated users can insert through owner RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.workout_set_entries', 'update'),
  'authenticated users can update through owner RLS'
);
select ok(
  has_table_privilege('authenticated', 'public.workout_set_entries', 'delete'),
  'authenticated users can delete through owner RLS'
);
select is(
  (select count(*)::integer from pg_policies where schemaname = 'public' and tablename = 'workout_set_entries'),
  4,
  'owner CRUD policies exist'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_set_entries'
      and column_name = 'user_id'
      and is_nullable = 'NO'
  ),
  'workout set rows require a user owner'
);
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.workout_set_entries'::regclass
      and contype = 'u'
      and conname = 'workout_set_entries_exercise_set_unique'
  ),
  'an exercise cannot have duplicate set numbers'
);

select * from finish();
rollback;
