-- Food search saves truthful USDA provenance to existing owner-scoped food and
-- diary rows. This also supports databases where the unrelated service cache
-- migration (0013) has not been deployed. Applying 0013 later remains compatible.
alter table public.user_food_products drop constraint user_food_products_provider_valid;
alter table public.user_food_products add constraint user_food_products_provider_valid
  check (provider in ('open_food_facts', 'usda_food_data_central', 'manual', 'demo'));
alter table public.user_food_products drop constraint user_food_products_source_valid;
alter table public.user_food_products add constraint user_food_products_source_valid
  check (source in ('open_food_facts', 'usda_food_data_central', 'manual', 'demo', 'scanner'));
alter table public.meal_log_items drop constraint meal_log_items_provider_valid;
alter table public.meal_log_items add constraint meal_log_items_provider_valid
  check (provider is null or provider in ('open_food_facts', 'usda_food_data_central', 'manual', 'demo'));

-- The Food tab reads/writes goals, food records, diary items, and reusable meals.
-- Existing owner RLS policies remain unchanged. Table-level TRUNCATE is not
-- constrained by RLS; strip inherited/default broad grants before granting CRUD.
-- No global defaults, service-role permissions, or other feature tables change.
revoke all privileges on table public.nutrition_targets, public.meal_logs,
  public.meal_log_items, public.user_food_products, public.user_meal_library
  from public, anon, authenticated;
grant select, insert, update, delete on table public.nutrition_targets,
  public.meal_logs, public.meal_log_items, public.user_food_products,
  public.user_meal_library to authenticated;
