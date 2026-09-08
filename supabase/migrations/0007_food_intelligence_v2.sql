-- Food Intelligence V2 persistence.
-- Meal logs remain the daily aggregate used by existing summaries; products and
-- meal items provide the reusable, multi-item detail beneath each logged meal.

create table if not exists public.user_food_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  barcode text,
  provider text not null,
  provider_product_id text,
  name text not null,
  brand text,
  serving_size text,
  serving_quantity_g numeric,
  calories_per_serving numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  saturated_fat_g numeric,
  ingredients_text text,
  quality_label text,
  quality_score numeric,
  quality_confidence text not null default 'low',
  quality_flags text[] not null default '{}',
  quality_reason_codes text[] not null default '{}',
  quality_snapshot jsonb,
  is_saved boolean not null default false,
  last_used_at timestamptz,
  last_scanned_at timestamptz,
  source text not null default 'manual',
  source_confidence text not null default 'medium',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_food_products_name_not_empty check (length(trim(name)) > 0),
  constraint user_food_products_provider_valid check (provider in ('open_food_facts', 'manual', 'demo')),
  constraint user_food_products_quality_label_valid check (
    quality_label is null or quality_label in ('supportive', 'steady', 'watch', 'calibrating')
  ),
  constraint user_food_products_quality_confidence_valid check (quality_confidence in ('low', 'medium', 'high')),
  constraint user_food_products_source_valid check (source in ('open_food_facts', 'manual', 'demo', 'scanner')),
  constraint user_food_products_source_confidence_valid check (source_confidence in ('low', 'medium', 'high')),
  constraint user_food_products_serving_quantity_valid check (serving_quantity_g is null or serving_quantity_g >= 0),
  constraint user_food_products_calories_valid check (calories_per_serving is null or calories_per_serving >= 0),
  constraint user_food_products_protein_valid check (protein_g is null or protein_g >= 0),
  constraint user_food_products_carbs_valid check (carbs_g is null or carbs_g >= 0),
  constraint user_food_products_fat_valid check (fat_g is null or fat_g >= 0),
  constraint user_food_products_fiber_valid check (fiber_g is null or fiber_g >= 0),
  constraint user_food_products_sugar_valid check (sugar_g is null or sugar_g >= 0),
  constraint user_food_products_sodium_valid check (sodium_mg is null or sodium_mg >= 0),
  constraint user_food_products_saturated_fat_valid check (saturated_fat_g is null or saturated_fat_g >= 0)
);

create unique index if not exists user_food_products_user_barcode_unique_idx
on public.user_food_products(user_id, barcode)
where barcode is not null;

create index if not exists user_food_products_user_last_used_idx
on public.user_food_products(user_id, last_used_at desc nulls last);

create index if not exists user_food_products_user_last_scanned_idx
on public.user_food_products(user_id, last_scanned_at desc nulls last);

create index if not exists user_food_products_user_saved_idx
on public.user_food_products(user_id, is_saved, updated_at desc);

create index if not exists user_food_products_user_name_idx
on public.user_food_products(user_id, name);

drop trigger if exists set_user_food_products_updated_at on public.user_food_products;
create trigger set_user_food_products_updated_at
before update on public.user_food_products
for each row execute function public.set_updated_at();

alter table public.user_food_products enable row level security;

drop policy if exists "user_food_products_select_own" on public.user_food_products;
create policy "user_food_products_select_own"
on public.user_food_products for select using (auth.uid() = user_id);

drop policy if exists "user_food_products_insert_own" on public.user_food_products;
create policy "user_food_products_insert_own"
on public.user_food_products for insert with check (auth.uid() = user_id);

drop policy if exists "user_food_products_update_own" on public.user_food_products;
create policy "user_food_products_update_own"
on public.user_food_products for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_food_products_delete_own" on public.user_food_products;
create policy "user_food_products_delete_own"
on public.user_food_products for delete using (auth.uid() = user_id);

create table if not exists public.meal_log_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_log_id uuid references public.meal_logs(id) on delete cascade,
  food_product_id uuid references public.user_food_products(id) on delete set null,
  logged_at timestamptz not null,
  meal_type text not null,
  name text not null,
  brand text,
  servings numeric not null default 1,
  serving_size text,
  serving_quantity_g numeric,
  calories numeric,
  protein_g numeric,
  carbs_g numeric,
  fat_g numeric,
  fiber_g numeric,
  sugar_g numeric,
  sodium_mg numeric,
  saturated_fat_g numeric,
  barcode text,
  provider text,
  provider_product_id text,
  quality_label text,
  quality_score numeric,
  quality_confidence text,
  source text not null default 'manual',
  source_confidence text not null default 'medium',
  reason_codes text[] not null default '{}',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_log_items_name_not_empty check (length(trim(name)) > 0),
  constraint meal_log_items_servings_valid check (servings > 0),
  constraint meal_log_items_meal_type_valid check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack', 'unknown')),
  constraint meal_log_items_provider_valid check (provider is null or provider in ('open_food_facts', 'manual', 'demo')),
  constraint meal_log_items_quality_label_valid check (
    quality_label is null or quality_label in ('supportive', 'steady', 'watch', 'calibrating')
  ),
  constraint meal_log_items_quality_confidence_valid check (
    quality_confidence is null or quality_confidence in ('low', 'medium', 'high')
  ),
  constraint meal_log_items_source_valid check (source in ('manual', 'scanner', 'search', 'saved_food', 'demo')),
  constraint meal_log_items_source_confidence_valid check (source_confidence in ('low', 'medium', 'high')),
  constraint meal_log_items_serving_quantity_valid check (serving_quantity_g is null or serving_quantity_g >= 0),
  constraint meal_log_items_calories_valid check (calories is null or calories >= 0),
  constraint meal_log_items_protein_valid check (protein_g is null or protein_g >= 0),
  constraint meal_log_items_carbs_valid check (carbs_g is null or carbs_g >= 0),
  constraint meal_log_items_fat_valid check (fat_g is null or fat_g >= 0),
  constraint meal_log_items_fiber_valid check (fiber_g is null or fiber_g >= 0),
  constraint meal_log_items_sugar_valid check (sugar_g is null or sugar_g >= 0),
  constraint meal_log_items_sodium_valid check (sodium_mg is null or sodium_mg >= 0),
  constraint meal_log_items_saturated_fat_valid check (saturated_fat_g is null or saturated_fat_g >= 0)
);

create index if not exists meal_log_items_user_logged_at_idx
on public.meal_log_items(user_id, logged_at desc);

create index if not exists meal_log_items_user_meal_type_idx
on public.meal_log_items(user_id, meal_type);

create index if not exists meal_log_items_user_meal_log_idx
on public.meal_log_items(user_id, meal_log_id);

create index if not exists meal_log_items_user_product_idx
on public.meal_log_items(user_id, food_product_id);

drop trigger if exists set_meal_log_items_updated_at on public.meal_log_items;
create trigger set_meal_log_items_updated_at
before update on public.meal_log_items
for each row execute function public.set_updated_at();

alter table public.meal_log_items enable row level security;

drop policy if exists "meal_log_items_select_own" on public.meal_log_items;
create policy "meal_log_items_select_own"
on public.meal_log_items for select using (auth.uid() = user_id);

drop policy if exists "meal_log_items_insert_own" on public.meal_log_items;
create policy "meal_log_items_insert_own"
on public.meal_log_items for insert with check (auth.uid() = user_id);

drop policy if exists "meal_log_items_update_own" on public.meal_log_items;
create policy "meal_log_items_update_own"
on public.meal_log_items for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "meal_log_items_delete_own" on public.meal_log_items;
create policy "meal_log_items_delete_own"
on public.meal_log_items for delete using (auth.uid() = user_id);
