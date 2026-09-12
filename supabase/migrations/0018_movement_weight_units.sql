-- Weight units and warm-up flags for logged training.
--
-- Before this migration a logged weight was a dimensionless number, so the same
-- column held pounds for one user and kilograms for another with no way to tell
-- them apart. Units are recorded per row at log time.
--
-- Existing rows are left null on purpose rather than backfilled to a guessed
-- unit: an unknown unit is displayed without one, which is truthful, whereas a
-- backfill would invent data and silently corrupt any later strength estimate.

alter table public.workout_set_entries
  add column if not exists weight_unit text,
  add column if not exists warmup boolean not null default false;

alter table public.workout_exercise_entries
  add column if not exists weight_unit text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workout_set_entries_weight_unit_valid'
  ) then
    alter table public.workout_set_entries
      add constraint workout_set_entries_weight_unit_valid
      check (weight_unit is null or weight_unit in ('lb', 'kg'));
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'workout_exercise_entries_weight_unit_valid'
  ) then
    alter table public.workout_exercise_entries
      add constraint workout_exercise_entries_weight_unit_valid
      check (weight_unit is null or weight_unit in ('lb', 'kg'));
  end if;
end
$$;

-- Working sets drive progression; warm-ups are recorded but excluded.
create index if not exists workout_set_entries_working_sets_idx
on public.workout_set_entries(workout_exercise_entry_id, set_index)
where warmup = false;

comment on column public.workout_set_entries.weight_unit is
  'Unit the weight was entered in. Null for sets recorded before units existed; never assume a value.';
comment on column public.workout_set_entries.warmup is
  'Warm-up sets are kept for the record but excluded from headline load and progression.';
