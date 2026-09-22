-- Record what a person agreed to at signup.
--
-- `public.user_consents` has existed since the initial schema but nothing ever wrote to
-- it, so the app could show a consent screen and keep no proof that it had. With email
-- confirmation enabled there is no session at signup, which means the client cannot
-- insert the rows itself without row-level security rejecting them. The new-user trigger
-- already runs as security definer in order to create the profile, so it is the place
-- where the account and its consent can be written in the same transaction.
--
-- Consent arrives as `raw_user_meta_data->'healthi_consent'`, set by the signup form. A
-- signup carrying no consent object writes no consent rows at all: absent is recorded as
-- absent rather than as a grant, because a consent that defaults to true is not one.
--
-- One row per item agreed to, rather than a single blob, so that a later withdrawal is
-- recorded against the specific thing withdrawn.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  consent jsonb := new.raw_user_meta_data -> 'healthi_consent';
  consent_version text := coalesce(consent ->> 'version', 'unversioned');
begin
  insert into public.profiles (id, display_name, timezone)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email), 'UTC')
  on conflict (id) do nothing;

  if consent is not null then
    insert into public.user_consents (user_id, consent_type, granted, version, granted_at, metadata)
    select
      new.id,
      item.consent_type,
      item.granted,
      consent_version,
      case when item.granted then now() else null end,
      jsonb_build_object('captured_at', 'signup')
    from (
      values
        ('terms',         coalesce(consent -> 'terms'      = 'true'::jsonb, false)),
        ('privacy',       coalesce(consent -> 'privacy'    = 'true'::jsonb, false)),
        ('health_data',   coalesce(consent -> 'healthData' = 'true'::jsonb, false)),
        ('age_confirmed', coalesce(consent -> 'ageConfirmed' = 'true'::jsonb, false))
    ) as item(consent_type, granted);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
