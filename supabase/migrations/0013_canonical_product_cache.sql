-- Shared, non-user product-label cache for the authenticated server resolver.
-- It contains no health, account, or personal data. Only the service role can
-- read or write it; clients receive bounded projections through the Edge Function.

create table public.canonical_product_cache (
  canonical_gtin text primary key check (canonical_gtin ~ '^[0-9]{8,14}$'),
  normalized_snapshot jsonb not null,
  provider_provenance jsonb not null default '[]'::jsonb,
  provider_conflicts jsonb not null default '[]'::jsonb,
  source_timestamps jsonb not null default '{}'::jsonb,
  resolver_version text not null,
  freshness_state text not null default 'fresh' check (freshness_state in ('fresh', 'stale')),
  fetched_at timestamptz not null,
  fresh_until timestamptz not null,
  last_successful_provider_at timestamptz not null,
  payload_bytes integer not null check (payload_bytes between 1 and 262144),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(normalized_snapshot) = 'object'),
  check (octet_length(normalized_snapshot::text) <= 262144),
  check (fresh_until >= fetched_at)
);

alter table public.canonical_product_cache enable row level security;

revoke all on table public.canonical_product_cache from anon, authenticated;
grant all on table public.canonical_product_cache to service_role;

comment on table public.canonical_product_cache is
'Service-only exact-GTIN cache of normalized product-label evidence. Contains no user or health data.';

-- The server resolver may select USDA as the exact-GTIN source when OFF does
-- not have the product. Persist the truthful provider identifier.
alter table public.user_food_products drop constraint user_food_products_provider_valid;
alter table public.user_food_products add constraint user_food_products_provider_valid
check (provider in ('open_food_facts', 'usda_food_data_central', 'manual', 'demo'));

alter table public.user_food_products drop constraint user_food_products_source_valid;
alter table public.user_food_products add constraint user_food_products_source_valid
check (source in ('open_food_facts', 'usda_food_data_central', 'manual', 'demo', 'scanner'));

alter table public.meal_log_items drop constraint meal_log_items_provider_valid;
alter table public.meal_log_items add constraint meal_log_items_provider_valid
check (provider is null or provider in ('open_food_facts', 'usda_food_data_central', 'manual', 'demo'));
