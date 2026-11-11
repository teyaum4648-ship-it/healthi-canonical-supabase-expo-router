-- Applied to production with Supabase MCP: harden internal triggers against public RPC.
-- This migration describes the verified existing permissions change.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
alter function public.set_updated_at() set search_path = pg_catalog, public;
alter function public.prevent_lab_audit_mutation() set search_path = pg_catalog, public;
