# Day Schedule Blocks Persistence Plan

## 1. Purpose

This plan defines how Healthi should persist in-app schedule blocks for the Day Plan Engine without overbuilding.

The goal is to store durable user schedule context, then recompute day plan recommendations from:

- schedule blocks
- Sleep + Rhythm timing windows
- readiness context
- nutrition and food response signals
- movement capacity
- wind-down timing

V1 should persist the user's in-app schedule blocks only. Generated day plans should be recomputed from source data until the product needs stable historical snapshots.

## 2. Product Boundary

This persistence plan supports in-app schedule blocks only.

V1 should not include:

- calendar sync
- Google Calendar sync
- Apple Calendar sync
- native calendar permissions
- external calendar imports
- recurring calendar sync
- AI schedule generation
- day plan auto-execution
- push reminders
- cached long-term analytics

Future calendar sync can map into the same model later, but it should remain outside the V1 migration.

## 3. What To Persist In V1

Persist one source-of-truth table:

```sql
day_schedule_blocks
```

This table should store user-created and demo schedule blocks that represent the user's day shape.

Persist now:

- block date
- start and end timestamps
- block type
- title
- optional description
- optional location
- protection/flexibility state
- source
- source confidence
- reason codes
- created and updated timestamps

Use this table as the durable input to `generateDayPlan`.

## 4. What To Recompute

Recompute generated day plan output from current source data.

Recompute:

- open windows
- protected blocks list
- deep work suggestions
- movement suggestions
- meal timing suggestions
- caffeine cutoff recommendation
- wind-down recommendation
- day mode summary
- confidence
- reason codes
- missing data list

Why recompute:

- Day plan output is derived.
- Engine rules will change.
- Cached recommendations can become stale when blocks, rhythm, readiness, food, or movement signals change.
- V1 does not need an audit trail of exactly what recommendation was shown.

## 5. What To Delay

Delay:

- generated day plan result storage
- recommendation feedback
- external calendar sync tables
- recurring-rule expansion cache
- reminder delivery state
- AI-generated plan history
- long-term planning analytics
- cached dashboard day plan summaries

Add these only when a user-facing feature requires them.

## 6. Proposed Table: `day_schedule_blocks`

Recommended V1 shape:

```sql
create table public.day_schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  block_date date not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  block_type text not null,
  title text not null,
  description text,
  location text,
  flexibility text not null default 'fixed',
  is_protected boolean not null default true,
  source text not null,
  source_confidence text not null,
  reason_codes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Delayed fields:

```sql
external_calendar_event_id text
external_calendar_source text
recurrence_rule text
recurrence_parent_block_id uuid
raw_source_payload jsonb
last_synced_at timestamptz
```

## 7. Field Definitions

### `id`

Primary key.

### `user_id`

Owner of the block. Required for RLS.

### `block_date`

The user's local schedule date. Store separately from timestamps for efficient day queries and dashboard loading.

`block_date` should usually be derived from `start_at` in the user's timezone at write time. For overnight sleep blocks, use the date the sleep block begins unless product later chooses a sleep-date convention.

### `start_at` and `end_at`

Use `timestamptz` for exact instants.

Why:

- The Day Plan Engine currently uses ISO timestamps.
- Timezone conversion should happen at the app boundary.
- Overnight blocks are easy because `end_at` can be on the next day.
- Range queries are reliable.

Do not store only `time` in V1. A plain time loses the actual date and makes overnight blocks harder.

### `block_type`

Align with the Day Plan Engine:

- `work`
- `class`
- `commute`
- `exercise`
- `meal`
- `free_time`
- `recovery`
- `social`
- `appointment`
- `sleep`
- `other`

Recommended check:

```sql
block_type in (
  'work',
  'class',
  'commute',
  'exercise',
  'meal',
  'free_time',
  'recovery',
  'social',
  'appointment',
  'sleep',
  'other'
)
```

### `title`

Short user-facing label. Required.

Examples:

- `Work`
- `Class`
- `Commute`
- `Dinner`
- `Wind-down`

### `description`

Optional user note. V1 can keep this nullable.

### `location`

Optional text. Keep nullable. Do not add maps, geocoding, or external location APIs in V1.

### `flexibility`

Maps to the engine's block flexibility:

- `fixed`
- `flexible`
- `preferred`
- `suggested`

Recommended default: `fixed`.

### `is_protected`

Simple boolean for UI and helper ergonomics.

Recommended V1 mapping:

- `true` for fixed work, class, commute, appointment, sleep, and user-entered exercise.
- `false` for flexible, preferred, suggested, and open/free-time blocks.

The engine should still use `flexibility` and `block_type` as the richer source of truth. `is_protected` is a convenience flag.

### `source`

Valid V1 sources:

- `manual`
- `demo`

Future sources:

- `calendar_import`
- `system_suggested`

Recommended check in V1 can include future-safe values:

```sql
source in ('manual','demo','calendar_import','system_suggested')
```

The app should only write `manual` and `demo` until future features are explicitly built.

### `source_confidence`

Align with shared confidence values:

- `low`
- `medium`
- `high`

Manual user-entered blocks can usually be `high`. Demo blocks can be `medium` or `low` depending on whether they are seeded defaults.

### `reason_codes`

Text array for explainability.

Recommended safe values:

- `schedule_blocks_available`
- `demo_schedule_data`
- `user_fixed_block`
- `user_flexible_block`
- `sleep_block_protected`
- `manual_schedule_block`

Do not use medical, proprietary, or diet-culture reason codes.

### `created_at` and `updated_at`

Standard timestamps. Add the existing project `updated_at` trigger pattern if available in the migration step.

## 8. Source And Confidence Model

Source priority for schedule blocks:

1. user-entered manual blocks
2. future user-confirmed imported blocks
3. demo blocks
4. future system-suggested blocks
5. future unconfirmed imported blocks

Confidence guidelines:

- `high`: user entered or user confirmed.
- `medium`: demo block or future imported block with clear timing.
- `low`: estimated default, incomplete block, or future unconfirmed import.

Missing schedule data should lower Day Plan confidence. It should not create punitive output.

## 9. Overnight And Overlapping Block Handling

### Should `date` be stored separately from `start_time` and `end_time`?

Yes. Store:

- `block_date date`
- `start_at timestamptz`
- `end_at timestamptz`

`block_date` supports fast day queries. `start_at` and `end_at` preserve exact timing.

### Should times be `timestamptz`, `time`, or both?

Use `timestamptz` in V1.

Delay separate local `time` columns unless recurrence becomes a first-class feature. Recurrence often needs local wall-clock time, but V1 should not support recurrence.

### How should overnight sleep blocks work?

Allow `end_at` to be on the next date.

Example:

```text
block_date: 2026-07-08
start_at: 2026-07-08T22:30:00.000Z
end_at: 2026-07-09T06:30:00.000Z
block_type: sleep
```

The range helper should include blocks that overlap the requested window, not only blocks whose `block_date` equals the date.

### How should overlapping blocks be allowed or prevented?

Allow overlaps in the database.

Reason:

- Real schedules overlap.
- Commute can overlap with calls.
- Meals can overlap with social events.
- Sleep and wind-down can conflict with late events.
- The Day Plan Engine already handles overlaps safely.

Do not add an exclusion constraint in V1. Use engine conflict handling and UI warnings later.

### Should blocks be allowed without exact times?

No for V1 persistence. Require `start_at` and `end_at`.

Reason:

- The Day Plan Engine needs timed constraints.
- Untimed tasks become task management, which is outside V1.

Later, a separate `day_intentions` or `untimed_tasks` model could support loose intentions.

### Should generated recommendations be persisted or recomputed?

Recompute in V1.

Persist only source schedule blocks. Generated recommendations should remain derived output until Morning Briefing, notifications, or plan history require snapshots.

## 10. Recurrence Decision

Delay recurrence in V1.

Why:

- Recurrence introduces timezone, editing, exceptions, and expansion complexity.
- The Day Plan Engine only needs the blocks for a specific day.
- Manual same-day blocks are enough for the first UI slice.

V1 may include a nullable `recurrence_hint` only in local TypeScript if useful for UI, but the database should avoid full recurrence rules until V2.

Future recurrence design should include:

- parent block
- recurrence rule
- exception dates
- expanded instance cache only if needed
- user-friendly edit options

## 11. Future Calendar Sync Boundary

Future calendar sync should map imported events into `day_schedule_blocks` or into a staging/import table that then creates schedule blocks.

Delayed calendar fields:

- `external_calendar_event_id`
- `external_calendar_source`
- `raw_source_payload`
- `last_synced_at`

Future imported event mapping:

- event start -> `start_at`
- event end -> `end_at`
- event title -> `title`, possibly reduced or user-confirmed
- event category -> inferred `block_type`, with low confidence until confirmed
- source -> `calendar_import`
- confidence -> `low` or `medium`

Privacy default:

- Ask for explicit permission.
- Import the minimum useful data.
- Allow disconnect.
- Avoid storing attendees, notes, or full payloads unless necessary.
- Keep mobile code on user-authenticated access. No service-role assumptions.

V1 should not include this behavior.

## 12. RLS Plan

Enable RLS on `day_schedule_blocks`.

Owner-only policies:

```sql
alter table public.day_schedule_blocks enable row level security;

create policy "day_schedule_blocks_select_own"
on public.day_schedule_blocks
for select
using (auth.uid() = user_id);

create policy "day_schedule_blocks_insert_own"
on public.day_schedule_blocks
for insert
with check (auth.uid() = user_id);

create policy "day_schedule_blocks_update_own"
on public.day_schedule_blocks
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "day_schedule_blocks_delete_own"
on public.day_schedule_blocks
for delete
using (auth.uid() = user_id);
```

Do not add permissive policies.

Do not require service-role writes from mobile code.

## 13. Index Plan

Recommended V1 indexes:

```sql
create index day_schedule_blocks_user_date_idx
on public.day_schedule_blocks(user_id, block_date);

create index day_schedule_blocks_user_start_idx
on public.day_schedule_blocks(user_id, start_at);

create index day_schedule_blocks_user_range_idx
on public.day_schedule_blocks(user_id, start_at, end_at);

create index day_schedule_blocks_user_type_idx
on public.day_schedule_blocks(user_id, block_type);
```

Delayed index:

```sql
create index day_schedule_blocks_external_event_idx
on public.day_schedule_blocks(user_id, external_calendar_event_id)
where external_calendar_event_id is not null;
```

Add the delayed external index only when future calendar import fields exist.

## 14. Persistence Helper Plan

Future helper file:

```text
src/features/dayPlan/scheduleBlockPersistence.ts
```

Suggested helper types:

- `DayScheduleBlockInsert`
- `DayScheduleBlockRow`
- `DayScheduleBlockPersistenceInput`
- `DayScheduleBlockSupabaseClient`

Suggested helpers:

- `toDayScheduleBlockInsert`
- `dayScheduleBlockRowToEngineBlock`
- `saveDayScheduleBlock`
- `updateDayScheduleBlock`
- `deleteDayScheduleBlock`
- `getScheduleBlocksForDate`
- `getScheduleBlocksForRange`

Mapping notes:

- Database `block_type` maps to engine `type`.
- Database `title` maps to engine `label`.
- Database `start_at` maps to engine `start`.
- Database `end_at` maps to engine `end`.
- Database `source` maps to engine `source`.
- Database `source_confidence` maps to engine `confidence`.
- Database `flexibility` maps to engine `flexibility`.
- Database `reason_codes` maps to engine `reason_codes`.

Date helper:

- `getScheduleBlocksForDate` should include overnight blocks that overlap the day.
- Query by range overlap, not only `block_date`.

Example range logic:

```text
start_at < day_end
end_at > day_start
```

## 15. Local Demo Store Plan

Use a small AsyncStorage-backed local/demo store consistent with existing demo patterns.

Suggested key:

```text
healthi:demo:dayPlan:scheduleBlocks
```

Future file:

```text
src/features/dayPlan/localDemoScheduleBlockStore.ts
```

Suggested pure helpers:

- `serializeDemoScheduleBlocks`
- `deserializeDemoScheduleBlocks`
- `toLocalDemoScheduleBlock`
- `getLocalDemoScheduleBlocks`
- `saveLocalDemoScheduleBlocks`
- `appendLocalDemoScheduleBlock`
- `deleteLocalDemoScheduleBlock`

Requirements:

- Preserve nested reason codes.
- Drop invalid blocks safely.
- Return an empty array for missing or invalid storage.
- Keep output serializable.
- Do not silently send demo data to Supabase.

## 16. Testing Plan

Future implementation tests should cover:

- schedule block insert mapping
- row-to-engine mapping
- user_id preservation
- block type checks
- source checks
- confidence checks
- exact date queries
- range queries
- overnight blocks
- overlapping blocks allowed and preserved
- delete helper
- update helper
- serializable output
- local demo serialize/deserialize
- invalid local demo payload fallback
- RLS migration expectations
- no service-role assumptions
- safety-language scan

Do not require a real Supabase connection unless the project already has a migration test pattern for that layer.

## 17. Safety-Language Rules

Use:

- day plan
- schedule block
- energy window
- rhythm support
- fueling signal
- food response
- movement capacity
- readiness support
- wind-down
- confidence
- calibrating
- based on available data
- general wellness guidance

Do not use:

- diagnosis
- diagnose
- treatment
- cure
- prescribe
- prescription
- adrenal
- HPA
- cortisol
- hormone
- clinical
- medical decision
- dysregulated
- dysfunction
- detox
- toxin
- toxic
- cleanse
- cheat meal
- guilt-free
- bad food
- metabolic type
- metabolic typing
- CHEK
- C.H.E.K
- HLC
- 4 Doctors
- Primal Pattern
- Work-In

Schedule guidance should remain optional and editable.

## 18. Open Questions

- Should `block_date` use the user's profile timezone, device timezone, or an explicit block timezone later?
- Should V1 include `timezone` on each block, or derive it from the user/profile at read time?
- Should `is_protected` remain a stored field, or be derived from `flexibility` and `block_type`?
- Should the app allow a block to be marked `suggested` before generated recommendations are persistable?
- Should sleep blocks come from schedule entry, Sleep + Rhythm sessions, or both?
- Should meal blocks become linked to meal logs later?
- Should exercise blocks become linked to movement/training sessions later?
- Should accepted Day Plan recommendations become schedule blocks in V2?
- How should the UI explain overlapping blocks without making the day feel broken?

## 19. Recommended Next Implementation Slice

Next implementation should be narrow:

1. Add migration for `day_schedule_blocks`.
2. Add `src/features/dayPlan/scheduleBlockPersistence.ts`.
3. Add mapping and helper tests.
4. Add local demo schedule block store.
5. Do not build schedule UI until persistence and local demo helpers are verified.

Stop before calendar sync, generated plan persistence, reminders, or AI.
