-- Let a signed-in person record and read their own consents and privacy events.
--
-- Why: the app now asks for a separate permission before a meal photo is sent to an
-- outside AI service (App Store guideline 5.1.2(i)), and the photo-estimate function
-- refuses any photo without a recorded grant. Until now only the signup trigger, running
-- as security definer, wrote to `user_consents`; the app itself had no grant on it.
--
-- What writes: the app inserts one `user_consents` row each time the person answers the
--   AI photo question or turns it off in Settings. `export-account` inserts a
--   `privacy_events` row when it hands over an export (it uses the service role).
-- What reads: the app reads its own consents; `photo-estimate` and `export-account` read
--   with the service role.
-- RLS: both tables have had row-level security with own-rows-only policies since
--   0001_initial_schema (`auth.uid() = user_id` on select, insert, update and delete).
--   These grants only open the door those policies already guard.
--
-- Insert and select only, no update: consent is an append-only log. A withdrawal is a new
-- row with granted = false, and the latest row for a type is the current answer, so the
-- history of what someone agreed to cannot be rewritten from the client.

grant select, insert on table public.user_consents to authenticated;
grant select, insert on table public.privacy_events to authenticated;

create index if not exists user_consents_user_type_created_idx
  on public.user_consents (user_id, consent_type, created_at desc);
