# Clean demo and beta launch checklist

## Available in the local-demo build

- A new device opens the demo entry screen and starts with onboarding.
- Continue demo resumes the same device's entries.
- You → Start fresh demo asks for confirmation before clearing demo records.
- Reset removes demo onboarding, meal logs, saved products, workouts, schedule blocks,
  sleep windows, and the demo scope of protocol/closeout records. It does not remove
  authentication tokens or another account's records.
- Logging out of the demo retains its entries; it is not a reset.
- No sample sleep history is automatically supplied to Home, Plan, Move, or Sleep.
- A default clock-based sleep schedule does not count as observed recovery evidence.
- Failed account sleep reads/writes do not fall back to the local demo store.
- Reset is for the local demo only; it is not an account deletion feature.

The demo is stored in that browser/device. Clearing browser data can erase it.
It is not a shared account, cloud backup, or a real multi-user beta.

## Before inviting people to a real-account beta

1. Confirm the dedicated beta Supabase project. The current development configuration
   uses local Supabase and enables demo mode; do not ship that as account-enabled.
2. Configure the hosted account build with the verified HTTPS Supabase URL and public
   publishable/anon key, with demo mode disabled. Keep service-role, database, and
   provider keys server-only. Do not use a local-host database URL in a phone build.
3. Verify email confirmation, redirect URLs, sign-in, sign-out, session restoration,
   and fresh-account onboarding against the hosted build.
4. Verify the profile trigger and all onboarding writes: assessment session/answers,
   baseline profile, food constraints where applicable, plan results, and final
   profile status. A partial failure must not mark onboarding completed.
5. Run two-user isolation checks for meals/items, workouts/sets, sleep, schedules,
   baseline records, and evidence references. Verify RLS with the real user roles.
6. Check save/reload/offline failures and account switching on two devices. Some
   coaching progress is currently device-local; do not promise full cross-device
   sync until that is implemented and tested.
7. Decide the invite audience and publish only to that audience. The current preview
   remains private; deploying a new preview does not make it publicly accessible.
8. Provide clear beta/privacy wording and an account-data deletion/support path
   before collecting real users' wellness data.

No remote database changes or invitation/access changes are part of this patch.

## Day-by-day acceptance exercise

Start with a fresh demo; do not prefill fourteen days of sample health data.

- Day 0: complete onboarding; confirm empty logs and low-confidence/calibrating
  daily signals. Suggested schedules must not be presented as recorded sleep.
- Day 1: save a sleep window, meal, and workout; navigate away and back, then reload.
  Confirm the entries persist and the corresponding Home signals use them.
- Day 2: log a different day and confirm its date, history, and no carryover of today's
  nutrition totals. Confirm that missed logs are uncertainty, not evidence of a bad day.
- Days 3–14: check explanations, corrections, missing days, and changing routines.
  Avoid turning short-term observations into chronic or medical conclusions.
- Reset: confirm the local demo becomes empty again while another account's state
  and unrelated device settings remain unchanged.

## Next approved product work, separate from this foundation patch

1. Unify the readiness inputs used by Home and Plan and remove duplicate contribution
   paths. Keep every contribution traceable and missing evidence neutral.
2. Add explicit hydration logging and confidence-aware daily progress.
3. Expand branded/generic food search with serving confirmation and reliable logging.
4. Carry available Product Quality evidence from consumed foods through Nourishment,
   not from products that were only scanned; avoid double-counting.

The temporary scanner-algorithm experiment is unchanged by this patch and still
needs its own acceptance review before it is called production-ready.
