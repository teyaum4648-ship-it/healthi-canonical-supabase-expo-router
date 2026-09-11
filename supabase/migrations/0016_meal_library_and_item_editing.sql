-- Reusable meals are distinct from food bookmarks and diary logs. The Food tab
-- writes/reads this owner-scoped library via invoker RPCs. RLS denies other users.
-- The edit RPC keeps meal aggregates and item rows in the same transaction.
create table public.user_meal_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  library_key text not null check (length(library_key) between 1 and 12000),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 500000),
  updated_at timestamptz not null default now(),
  unique(user_id, library_key)
);
alter table public.user_meal_library enable row level security;
create policy user_meal_library_owner on public.user_meal_library for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.user_meal_library from anon;
grant select, insert, update, delete on public.user_meal_library to authenticated;

create function public.get_meal_collection() returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(payload order by updated_at desc), '[]'::jsonb)
  from public.user_meal_library where user_id = auth.uid();
$$;
create function public.save_meal_collection_entry(entry jsonb) returns void
language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if coalesce(length(trim(entry->'meal'->>'name')),0) = 0
    or jsonb_typeof(entry->'items') is distinct from 'array'
    or jsonb_typeof(entry->'is_starred') is distinct from 'boolean'
    or jsonb_typeof(entry->'is_saved') is distinct from 'boolean' then
    raise exception 'Invalid meal entry';
  end if;
  if jsonb_array_length(entry->'items') > 100 or ((entry->>'is_saved')::boolean and jsonb_array_length(entry->'items') = 0) then
    raise exception 'Invalid meal foods';
  end if;
  insert into public.user_meal_library(user_id, library_key, payload)
  values(auth.uid(), entry->>'library_key', entry)
  on conflict(user_id, library_key) do update set payload = excluded.payload, updated_at = now();
end; $$;

-- Search all owned history, not just the currently displayed day or food cache.
-- Each page is bounded. Literal terms avoid treating user input as SQL patterns.
create function public.search_meal_history(query text default '', page_offset integer default 0) returns jsonb
language sql stable security invoker set search_path = public as $$
  with terms as (select term from regexp_split_to_table(lower(left(trim(query),120)), '\s+') term where term <> ''),
  matched_meals as (
    select m.* from public.meal_logs m where m.user_id = auth.uid() and not exists (
      select 1 from terms t where position(t.term in lower(m.name || ' ' || coalesce((
        select string_agg(i.name || ' ' || coalesce(i.brand,''), ' ') from public.meal_log_items i
        where i.meal_log_id = m.id and i.user_id = auth.uid()),''))) = 0
    ) order by m.logged_at desc, m.id limit 51 offset greatest(page_offset,0)
  ), page_meals as (select * from matched_meals limit 50),
  matched_foods as (
    select f.* from public.user_food_products f where f.user_id = auth.uid() and not exists (
      select 1 from terms t where position(t.term in lower(f.name || ' ' || coalesce(f.brand,''))) = 0
    ) order by f.last_used_at desc nulls last, f.id limit 51 offset greatest(page_offset,0)
  ) select jsonb_build_object(
    'meals', coalesce((select jsonb_agg(to_jsonb(m)) from page_meals m),'[]'::jsonb),
    'items', coalesce((select jsonb_agg(to_jsonb(i)) from public.meal_log_items i
      where i.user_id = auth.uid() and i.meal_log_id in (select id from page_meals)), '[]'::jsonb),
    'foods', coalesce((select jsonb_agg(to_jsonb(f)) from (select * from matched_foods limit 50) f),'[]'::jsonb),
    'has_more', (select count(*) > 50 from matched_meals) or (select count(*) > 50 from matched_foods)
  );
$$;

create function public.replace_meal_items(meal_id uuid, meal_patch jsonb, item_rows jsonb) returns jsonb
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
    ingredients = array(select name from public.meal_log_items where meal_log_id=m.id and user_id=auth.uid()),
    quality_flags = array(select jsonb_array_elements_text(meal_patch->'quality_flags')),
    reason_codes = array(select jsonb_array_elements_text(meal_patch->'reason_codes')),
    source_confidence = meal_patch->>'source_confidence', corrected_by_user = true, confirmed_by_user = true
    where id = m.id and user_id = auth.uid() returning * into m;
  return jsonb_build_object('meal', to_jsonb(m), 'items', (select jsonb_agg(to_jsonb(i)) from public.meal_log_items i
    where i.meal_log_id=m.id and i.user_id=auth.uid()));
end; $$;
revoke all on function public.get_meal_collection() from public, anon;
revoke all on function public.save_meal_collection_entry(jsonb) from public, anon;
revoke all on function public.search_meal_history(text, integer) from public, anon;
revoke all on function public.replace_meal_items(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.get_meal_collection(), public.save_meal_collection_entry(jsonb),
  public.search_meal_history(text, integer), public.replace_meal_items(uuid, jsonb, jsonb) to authenticated;
