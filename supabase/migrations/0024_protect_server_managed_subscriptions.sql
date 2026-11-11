-- Protect server-managed RevenueCat entitlements.
-- Applied and verified in production. App clients must never self-award premium status.
drop policy if exists "subscription_status_insert_own" on public.subscription_status;
drop policy if exists "subscription_status_update_own" on public.subscription_status;
drop policy if exists "subscription_status_delete_own" on public.subscription_status;
revoke insert, update, delete on table public.subscription_status from public, anon, authenticated;
grant select on table public.subscription_status to authenticated;
grant all on table public.subscription_status to service_role;
