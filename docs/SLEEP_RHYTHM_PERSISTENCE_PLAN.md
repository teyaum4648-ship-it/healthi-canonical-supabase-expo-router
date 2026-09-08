# Sleep + Rhythm Persistence Plan

## 1. Recommendation Summary

Implement persistence for durable Sleep + Rhythm source data first:

- `sleep_sessions`
- `sleep_need_estimates`

Delay persistence for generated daily rhythm outputs until the app has Morning Briefing or another user-facing surface that needs cached results:

- `circadian_daily_summaries`
- `sleep_signal_events`

The V1 engine can recompute sleep debt, energy curves, rhythm windows, caffeine cutoff, wind-down start, and Daily Check-In skip logic from stored sleep sessions plus the active sleep need estimate. That keeps the database clean, avoids stale derived outputs, and makes later engine tuning easier.

The existing initial schema already contains older tables named `sleep_logs`, `sleep_debt_history`, `circadian_profiles`, and `circadian_logs`. The eventual migration should not blindly duplicate writes across old and new tables. Before production data exists, prefer replacing or superseding the older sleep/circadian tables with the engine-aligned tables below. If production data exists by then, add a one-time backfill and mark the older tables as legacy.

## 2. Store vs Recompute Decision

Store source-of-truth data:

- User-confirmed or user-entered sleep sessions.
- Demo/manual sleep sessions used to seed the engine.
- Future imported sessions from wearable or platform sources.
- User corrections to prior sleep sessions.
- The user's active and historical sleep need estimates.
- Source, confidence, correction, and reason-code metadata.

Recompute when practical:

- 7-day sleep debt.
- 14-day weighted sleep debt.
- Current phase.
- Energy curve.
- Rhythm plan windows.
- Caffeine cutoff.
- Wind-down start.
- Daily Check-In missing-signal output.

Maybe cache later:

- Full `CircadianBriefing` output for a specific user/date/timezone once Morning Briefing needs stable daily snapshots.
- Generated Morning Briefing payloads when the user needs to see exactly what was shown that day.
- Expensive passive-detection summaries after passive tracking exists and consent rules are finalized.

Do not store in V1:

- Raw phone motion minute streams.
- Raw HealthKit or Health Connect payloads.
- Raw wearable payloads by default.
- Every generated energy point unless a later product surface requires a stable historical snapshot.

## 3. Table Recommendations

Implement now:

### `sleep_sessions`

Purpose: durable source-of-truth sleep sessions from manual, demo, correction, and future device sources.

This table should become the canonical replacement for the older `sleep_logs` shape because the engine requires `date`, `source_confidence`, `reason_codes`, correction lineage, and optional source identifiers.

### `sleep_need_estimates`

Purpose: slow-changing user sleep need estimate used by `calculateSleepDebt` and `generateCircadianBriefing`.

Use historical rows with one active estimate per user. This allows future adaptive updates without losing the prior estimate that older generated outputs were based on.

Delay:

### `circadian_daily_summaries`

Purpose: cache a full generated briefing for a user/date/timezone.

Delay until Morning Briefing or notifications need an immutable daily snapshot. Until then, the engine can recompute from `sleep_sessions`, `sleep_need_estimates`, and profile timezone/preferred bedtime.

### `sleep_signal_events`

Purpose: future minute-level or event-level passive signals.

Delay until passive tracking V2 because this table has the highest privacy and consent burden.

## 4. Proposed `sleep_sessions` Schema

Suggested columns:

```sql
create table public.sleep_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  sleep_start_at timestamptz,
  sleep_end_at timestamptz,
  duration_minutes int,
  sleep_quality numeric,
  source text not null,
  source_confidence text not null,
  corrected_by_user boolean not null default false,
  confirmed_by_user boolean not null default false,
  correction_of_session_id uuid references public.sleep_sessions(id) on delete set null,
  original_source_id text,
  raw_source_payload jsonb,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Recommended checks:

- `source in ('manual','estimated','demo','phone_motion','phone_activity','healthkit','health_connect','wearable','user_corrected')`
- `source_confidence in ('low','medium','high')`
- `sleep_quality is null or sleep_quality between 1 and 10`
- `duration_minutes is null or duration_minutes > 0`
- At least one of `duration_minutes`, `sleep_start_at`, or `sleep_end_at` should be present for inserted rows.

Recommended indexes:

- `(user_id, date desc)`
- `(user_id, sleep_end_at desc)`
- `(user_id, source, date desc)`
- `(correction_of_session_id)` where not null

Recommended uniqueness:

- Do not force one row per user/date because naps, split sleep, imported duplicate candidates, and correction lineage may need multiple rows.
- If V1 wants one primary overnight session per date, represent that in app logic or add a future `session_role text` column rather than blocking the data model now.

Notes on `raw_source_payload`:

- Keep null for manual/demo V1.
- Only store future raw platform/wearable payloads if there is explicit consent and a clear debugging or audit reason.
- Prefer storing derived source metadata in narrow columns over full raw payloads.

## 5. Proposed `sleep_need_estimates` Schema

Suggested columns:

```sql
create table public.sleep_need_estimates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  minutes int not null,
  confidence text not null,
  basis text[] not null default '{}',
  is_active boolean not null default true,
  effective_at timestamptz not null default now(),
  replaced_at timestamptz,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Recommended checks:

- `minutes between 300 and 720`
- `confidence in ('low','medium','high')`
- `basis` values should align to engine types: `onboarding`, `default`, `sleep_history`, `manual_adjustment`
- `replaced_at is null` when `is_active = true`

Recommended indexes:

- `(user_id, is_active)`
- `(user_id, effective_at desc)`

Recommended uniqueness:

```sql
create unique index sleep_need_estimates_one_active_per_user_idx
on public.sleep_need_estimates(user_id)
where is_active = true;
```

Why historical rows:

- Sleep need should change slowly.
- Future adaptive updates need prior estimates for auditability.
- User corrections and repeated patterns can create a new active row without mutating the meaning of older sessions.

## 6. Delay `circadian_daily_summaries`

Do not implement this table in the first persistence migration.

Reason:

- `CircadianBriefing` is derived from sleep sessions and sleep need.
- Engine tuning would make old cached briefings stale unless versioned carefully.
- V1 has no Morning Briefing UI that needs a stable “what we showed today” record.
- Daily Check-In can call `getMissingDailySignals` from the latest available session and generated briefing without storing the full briefing.

Add later when:

- Morning Briefing is implemented.
- Notifications need stable timing decisions.
- The product needs an audit trail of what guidance was shown to the user on a specific date.

When added, include:

- `engine_version`
- `generated_at`
- `input_snapshot jsonb`
- `sleep_debt_7_day jsonb`
- `sleep_debt_14_day jsonb`
- `energy_curve jsonb`
- `rhythm_plan jsonb`
- `confidence`
- `reason_codes`
- `source_summary jsonb`

## 7. Future `sleep_signal_events` Notes

Do not implement this table in V1.

Future passive tracking may need event-level inputs such as:

- phone stationary periods
- phone interaction markers
- step/activity summaries
- user correction events
- wearable sleep interval imports
- HealthKit or Health Connect sleep intervals

Privacy default:

- Process raw phone motion/activity on-device where possible.
- Store derived `sleep_sessions` first.
- Store raw minute-level events only with explicit consent, clear retention, and a product need.
- Prefer coarse events over minute-by-minute raw streams.

If added later, the table should include:

- `user_id`
- `observed_at`
- `source`
- `source_confidence`
- `event_type`
- `value jsonb`
- `retention_policy`
- `consent_id`
- `created_at`

## 8. RLS Policy Plan

For every user-owned Sleep + Rhythm table:

- `user_id` is required.
- Row Level Security is enabled.
- Authenticated users can select only their own rows.
- Authenticated users can insert only their own rows.
- Authenticated users can update only their own rows.
- Authenticated users can delete only their own rows unless a future audit/retention requirement narrows deletion.

Policy pattern should match the existing project style:

```sql
alter table public.sleep_sessions enable row level security;

create policy "sleep_sessions_select_own"
on public.sleep_sessions
for select using (auth.uid() = user_id);

create policy "sleep_sessions_insert_own"
on public.sleep_sessions
for insert with check (auth.uid() = user_id);

create policy "sleep_sessions_update_own"
on public.sleep_sessions
for update using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sleep_sessions_delete_own"
on public.sleep_sessions
for delete using (auth.uid() = user_id);
```

Do not rely on service-role access in mobile code.

## 9. Privacy and Consent Notes

V1:

- Store manual/demo sleep sessions only.
- Do not store raw passive sensor data.
- Do not request native permissions.
- Do not store raw platform or wearable payloads.
- Keep source and confidence visible so users can understand where estimates came from.

Future passive/device integrations:

- Require explicit consent before any phone motion, HealthKit, Health Connect, or wearable access.
- Store consent records in `user_consents`.
- Connect imported sleep sessions back to a consent/source record when practical.
- Keep user corrections as durable records.
- Use source reliability and correction history to improve confidence over time.
- Allow users to delete or revoke passive/device data paths.

## 10. Manual Correction Flow

Recommended behavior:

1. User edits a sleep session's start time, end time, duration, or quality.
2. App inserts a new `sleep_sessions` row with `source = 'user_corrected'`.
3. New row sets `corrected_by_user = true` and `confirmed_by_user = true`.
4. New row points `correction_of_session_id` to the original row.
5. Original row remains for lineage unless the user explicitly deletes it.
6. Engine source priority selects the corrected row over the original source.

This supports future learning:

- Compare original estimate to corrected session.
- Track repeated offsets in sleep onset or wake time.
- Adjust source confidence slowly.
- Avoid overfitting to one unusual night.

## 11. Daily Check-In Support

Daily Check-In should query the latest relevant `sleep_sessions` row plus the active `sleep_need_estimates` row, then compute:

- current sleep debt
- circadian briefing if needed
- missing daily signals

This lets Daily Check-In skip sleep questions when:

- there is a medium/high confidence session,
- bedtime or wake time is known,
- sleep quality is already present.

It should ask only missing or low-confidence sleep questions, plus subjective signals that cannot be inferred.

## 12. Morning Briefing Support

Morning Briefing can initially recompute from:

- latest `sleep_sessions`
- active `sleep_need_estimates`
- profile timezone
- preferred bedtime/wake fields from `baseline_profiles` or `profiles`
- future Daily Check-In answers

When Morning Briefing needs stable historical display, add `circadian_daily_summaries` or a broader `morning_briefings` table. At that point, store the generated output, engine version, input snapshot, confidence, and reason codes so the app can show exactly what was generated that day.

## 13. Step-by-Step Implementation Plan

1. Confirm whether existing `sleep_logs`, `sleep_debt_history`, `circadian_profiles`, and `circadian_logs` have production data.
2. If no production data exists, create a migration that introduces `sleep_sessions` and `sleep_need_estimates`, then deprecates or replaces the older sleep/circadian tables before they are wired into the app.
3. If production data exists, create `sleep_sessions`, backfill from `sleep_logs`, and leave old tables read-only/legacy until removal is safe.
4. Add enum-style check constraints for source and confidence.
5. Add `updated_at` triggers using existing `public.set_updated_at()`.
6. Add RLS and own-row policies.
7. Add indexes for user/date and active sleep need lookup.
8. Wire onboarding completion to create the initial active `sleep_need_estimates` row from `baseline_profiles.sleep_need_minutes_estimate`.
9. Wire manual/demo sleep entry to insert `sleep_sessions`.
10. Keep sleep debt and circadian briefing recomputed in app code for now.
11. Add tests or migration checks that RLS is enabled and own-row policies exist.

## 14. Acceptance Criteria for Eventual Migration Task

The eventual migration is accepted when:

- `sleep_sessions` exists with engine-aligned fields.
- `sleep_need_estimates` exists with one active estimate per user.
- Both tables have `user_id`, RLS enabled, and own-row policies.
- Source values match `SleepDataSource`.
- Confidence values match `DataConfidence`.
- Reason codes are stored as `text[]`.
- Correction lineage is supported through `correction_of_session_id`.
- Raw passive payload storage is nullable and unused by V1.
- No native permissions, HealthKit, Health Connect, or phone motion code is added.
- No `circadian_daily_summaries` or `sleep_signal_events` table is added yet unless a separate task approves it.
- The app can recompute sleep debt and circadian briefing from stored sessions and the active sleep need estimate.
- The migration does not require service-role access from mobile code.
- Existing tests and typecheck still pass after wiring.

