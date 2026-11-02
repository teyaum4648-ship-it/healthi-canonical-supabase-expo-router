-- The pre-launch waitlist behind daywovenapp.com.
--
-- Why: people sign up on the website before the app is in the stores, and we need to
-- email them at launch. They have no account, so this is not a user-owned table and has
-- no user_id: a row is an email address and what the person chose to tell us with it.
--
-- What writes: only `public.join_waitlist`, called by the site's /api/waitlist route
--   (src/server/waitlist.ts) with the project's public anon key.
-- What reads: nobody through the API. The owner reads it from the Supabase dashboard
--   or with the service role to send the launch email.
-- RLS: enabled with no policies, and all table privileges revoked from anon and
--   authenticated, so the table cannot be read, listed or edited from a browser. The
--   one way in is the security-definer function, which only inserts or refreshes a row
--   and returns nothing — the same answer whether an email was new or already there, so
--   it cannot be used to check whether someone signed up.

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) <= 254),
  email_normalized text generated always as (lower(btrim(email))) stored,
  first_name text check (first_name is null or length(first_name) <= 40),
  platform text check (platform is null or platform in ('ios', 'android')),
  source text check (source is null or source ~ '^[a-z0-9_-]{1,40}$'),
  notice_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create unique index if not exists waitlist_signups_email_normalized_key
  on public.waitlist_signups (email_normalized);

alter table public.waitlist_signups enable row level security;
revoke all on table public.waitlist_signups from anon, authenticated;

create or replace function public.join_waitlist(
  p_email text,
  p_first_name text default null,
  p_platform text default null,
  p_source text default null,
  p_notice_version text default 'unversioned'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_email text := btrim(coalesce(p_email, ''));
begin
  if length(clean_email) > 254 or clean_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  insert into public.waitlist_signups (email, first_name, platform, source, notice_version)
  values (
    clean_email,
    nullif(left(btrim(coalesce(p_first_name, '')), 40), ''),
    case when p_platform in ('ios', 'android') then p_platform end,
    case when p_source ~ '^[a-z0-9_-]{1,40}$' then p_source end,
    left(coalesce(p_notice_version, 'unversioned'), 40)
  )
  on conflict (email_normalized) do update set
    -- Signing up again keeps what we had unless something new was given, and counts as
    -- asking for the emails again after an earlier unsubscribe.
    first_name = coalesce(excluded.first_name, waitlist_signups.first_name),
    platform = coalesce(excluded.platform, waitlist_signups.platform),
    source = coalesce(waitlist_signups.source, excluded.source),
    notice_version = excluded.notice_version,
    unsubscribed_at = null,
    updated_at = now();
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text) to anon, authenticated;
