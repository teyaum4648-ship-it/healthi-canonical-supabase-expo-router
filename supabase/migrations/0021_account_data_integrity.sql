-- Tighten owner relationships on directly writable child rows. The existing
-- tables/columns remain unchanged; policies now enforce the same parent ownership
-- checks as the meal-edit RPC and workout-set policies. No existing data is rewritten.
-- Requires 0020: account meal edits must persist the recomputed micronutrient panel
-- in the same transaction as the item rows and macro totals.

drop policy if exists "meal_log_items_insert_own" on public.meal_log_items;
create policy "meal_log_items_insert_own" on public.meal_log_items
for insert to authenticated
with check (
  auth.uid() = user_id
  and (meal_log_id is null or exists (select 1 from public.meal_logs parent where parent.id = meal_log_items.meal_log_id and parent.user_id = auth.uid()))
  and (food_product_id is null or exists (select 1 from public.user_food_products parent where parent.id = meal_log_items.food_product_id and parent.user_id = auth.uid()))
);

drop policy if exists "meal_log_items_update_own" on public.meal_log_items;
create policy "meal_log_items_update_own" on public.meal_log_items
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (meal_log_id is null or exists (select 1 from public.meal_logs parent where parent.id = meal_log_items.meal_log_id and parent.user_id = auth.uid()))
  and (food_product_id is null or exists (select 1 from public.user_food_products parent where parent.id = meal_log_items.food_product_id and parent.user_id = auth.uid()))
);

drop policy if exists "workout_exercise_entries_insert_own" on public.workout_exercise_entries;
create policy "workout_exercise_entries_insert_own" on public.workout_exercise_entries
for insert to authenticated
with check (
  auth.uid() = user_id
  and exists (select 1 from public.workout_sessions parent where parent.id = workout_exercise_entries.workout_session_id and parent.user_id = auth.uid())
  and (exercise_library_item_id is null or exists (select 1 from public.exercise_library_items parent where parent.id = workout_exercise_entries.exercise_library_item_id and parent.user_id = auth.uid()))
);

drop policy if exists "workout_exercise_entries_update_own" on public.workout_exercise_entries;
create policy "workout_exercise_entries_update_own" on public.workout_exercise_entries
for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (select 1 from public.workout_sessions parent where parent.id = workout_exercise_entries.workout_session_id and parent.user_id = auth.uid())
  and (exercise_library_item_id is null or exists (select 1 from public.exercise_library_items parent where parent.id = workout_exercise_entries.exercise_library_item_id and parent.user_id = auth.uid()))
);

create or replace function public.replace_meal_items(meal_id uuid, meal_patch jsonb, item_rows jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare m public.meal_logs; item public.meal_log_items; value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into m from public.meal_logs where id = meal_id and user_id = auth.uid() for update;
  if not found then raise exception 'Meal not found'; end if;
  if jsonb_typeof(item_rows) is distinct from 'array' then raise exception 'Invalid foods'; end if;
  if jsonb_array_length(item_rows) not between 1 and 100 or octet_length(item_rows::text) > 500000
    or coalesce(length(trim(meal_patch->>'name')),0) = 0 then raise exception 'Invalid meal'; end if;
  delete from public.meal_log_items where meal_log_id = meal_id and user_id = auth.uid();
  for value in select * from jsonb_array_elements(item_rows) loop
    item := jsonb_populate_record(null::public.meal_log_items, value);
    if item.servings is null or item.servings not between 0.01 and 20 then raise exception 'Invalid portion'; end if;
    if item.food_product_id is not null and not exists (
      select 1 from public.user_food_products f where f.id = item.food_product_id and f.user_id = auth.uid()
    ) then raise exception 'Food not owned'; end if;
    -- Do not accept identity, ownership or timestamp fields supplied by clients.
    item.id := gen_random_uuid(); item.user_id := auth.uid(); item.meal_log_id := m.id;
    item.logged_at := m.logged_at; item.meal_type := meal_patch->>'meal_type';
    item.created_at := now(); item.updated_at := now();
    insert into public.meal_log_items select (item).*;
  end loop;
  update public.meal_logs set name = trim(meal_patch->>'name'), meal_type = meal_patch->>'meal_type',
    calories = (select round(sum(calories)) from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    protein_g = (select sum(protein_g) from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    carbs_g = (select sum(carbs_g) from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    fat_g = (select sum(fat_g) from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    fiber_g = (select sum(fiber_g) from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    sugar_g = (select sum(sugar_g) from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    sodium_mg = (select sum(sodium_mg) from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    -- A missing panel is unknown, including edits from older clients. Never keep
    -- nutrient amounts from the foods/portions that this edit just replaced.
    micronutrients = nullif(meal_patch->'micronutrients', 'null'::jsonb),
    ingredients = array(select name from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    quality_flags = array(select jsonb_array_elements_text(meal_patch->'quality_flags')),
    reason_codes = array(select jsonb_array_elements_text(meal_patch->'reason_codes')),
    source_confidence = meal_patch->>'source_confidence', corrected_by_user = true, confirmed_by_user = true
    where id = m.id and user_id = auth.uid() returning * into m;
  return jsonb_build_object('meal', to_jsonb(m), 'items', (select jsonb_agg(to_jsonb(i)) from public.meal_log_items i
    where i.meal_log_id=m.id and i.user_id=auth.uid()));
end; $$;
