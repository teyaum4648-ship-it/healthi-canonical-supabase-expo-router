# Meal library and food-level editing

The Diet diary links to **Your foods & meals**, with All/Foods/Meals and Recent/Saved filters.
Stars pin a meal in Recent; bookmarks preserve its foods and portions as a reusable template.
Repeated logs with the same normalized meal name and food identities share a pin. Portion
differences do not create duplicate pinned cards. Saved templates do not change when a later
diary entry is edited. Removing a bookmark never deletes a diary entry.

Use meal opens a new unsaved meal draft for review and meal-type selection. It never copies
the old log identity, timestamp, or personal response. Existing unsaved drafts are protected.
Edit foods & portions retains the original log identity, date/time and personal response.
It allows adding/searching/scanning foods, removal with Undo, and decimal portion edits.
Cancel discards the draft. Missing nutrients remain null; totals sum available values with
an explicit partial-data explanation. Historical item nutrition is divided by its original
servings, so reuse never silently adopts a newly fetched label. Older aggregate-only logs
remain editable as totals, but cannot be reused as food templates without food details.

## Persistence and rollout

Migration `0016_meal_library_and_item_editing.sql` adds `user_meal_library` because food
bookmarks and diary logs cannot safely represent independent meal templates. Food UI writes
the owner-keyed payload via an invoker RPC and reads it through an invoker RPC. Owner-only
RLS and authenticated-only grants protect every operation. No supplied user ID is trusted.

`replace_meal_items` locks the owned meal, validates food ownership, replaces its rows and
recalculates aggregate nutrition inside one transaction. Any constraint failure rolls back
the entire edit. `search_meal_history` searches all owned meals and foods by literal terms;
it includes contained-food names and provides 50-row pages instead of limiting search to
the displayed day. No Product Quality or readiness engine is changed.

The existing demo stays explicitly device-local. Meal bookmarks have a separate resettable
storage key. A durable edit journal is committed before the two legacy local diary keys are
materialized; reads replay interrupted writes before returning data. Account errors never
fall back to this demo library.

## Cloud verification — September 10, 2026 (Pacific)

After the owner resumed project `lhqpexnepgvuohmhltnr` and approved the database rollout,
migrations 0015 (goal setup), 0016 (meal library/editing), and 0017 (nutrition persistence
permissions) were applied together in one transaction and recorded in migration history.
The previous cloud baseline was 0001–0012. The unrelated 0013 scanner-cache and 0014 Move
migrations remain pending; do not run a blanket migration push to resolve that gap without
reviewing and obtaining approval for those features. No Edge Functions were deployed.

Migration 0017 admits the existing USDA provider/source identifier without fabricating
provenance. It repeats only the compatible constraint changes from 0013 so the cache itself
need not be deployed. It removes inherited broad grants from PUBLIC, anon, and authenticated
on the five nutrition tables, then grants only SELECT/INSERT/UPDATE/DELETE to authenticated.
RLS remains enabled, owner policies remain unchanged, and service-role permissions are
preserved. Global default privileges and other feature tables are outside this correction.

Both `supabase/tests/meal_library_security.sql` and
`supabase/tests/nutrition_persistence_security.sql` passed locally and against the cloud
database. Cloud fixture identities were randomized in memory; both suites rolled back all
fixtures and a subsequent query confirmed zero remaining test users. The checks cover
owner isolation, anonymous denial, least-privilege grants, USDA persistence/search, goal
history and failed-write rollback, atomic meal edits, and missing-versus-zero nutrition.

This verifies the database contract, not a signed-in browser session. The published phone
demo remains device-local and was not redeployed or switched to account mode. Connecting
the hosted account experience and testing a real sign-in/save/reload flow is a separate
follow-up. Do not present local demo storage as cross-device sync. No package or scoring
changes are required.
