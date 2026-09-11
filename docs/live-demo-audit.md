# Live demo: third-party audit guide

## Scope and provenance

Audit `main` in `teyaum4648-ship-it/healthi-canonical-supabase-expo-router`.
The user approved making the live demo source the primary repository view.
Old commits and backup branches are preserved; no force-push is required.

The verified live publication is Sites version **14**, source commit
`a998d08e318df78c27cd1e738c4fdbe780957b03`, at
https://healthi-demo.teyaum4648.chatgpt.site/ . That original commit belongs to the
Sites source history. The equivalent runtime files are now in this GitHub history.
`live-demo-source-manifest.json` records their SHA-256 hashes from the published
source tree. This is a source-provenance check, not a guarantee that reinstalling
dependencies produces a byte-identical minified bundle.

```sh
node scripts/verify-live-demo-source.cjs
npm run typecheck
npm run test
```

The manifest covers app code, assets, server code, Supabase function sources, and
build configuration. It does not assert that every included Supabase function is
deployed or active. Documentation, tests, database migrations, and secrets are
outside the runtime-file comparison. Newer nutrition migration 0017 and its
security tests are also included in the repository, not removed to mimic an older
source snapshot.

## Run the same app mode

For a local visual preview (without the hosted search gateway):

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_DEMO_MODE=true \
EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT=v5_two_axis npm run web
```

For the hosted-equivalent web build, use the export command in
[Source and deployment workflow](source-and-deployment.md#reproduce-the-demo-mode).
It additionally sets `EXPO_PUBLIC_FOOD_SEARCH_URL=/api/food-search` and builds the
Worker using `scripts/build-food-search-worker.cjs`. Run that output with a
Cloudflare-compatible runtime and an `ASSETS` binding; a plain static server
cannot provide the search endpoint.

Do not copy a developer's `.env.local` or production secrets into the audit.
`EXPO_NO_DOTENV=1` avoids loading that file but does not clear pre-existing shell
variables; use a clean environment without Supabase credentials or unrelated
`EXPO_PUBLIC_*` overrides. The published demo has no configured Supabase client
credentials and no Lab Evidence opt-in. Demo meals and sleep records are
device-local, not shared production records.

## What is active, and where to inspect it

| Surface | Source / boundary |
| --- | --- |
| Tab navigation and UI | `app/(app)/(tabs)`, `src/components`, `src/styles` |
| Demo lifecycle and storage | `src/features/auth/AuthProvider.tsx`, `demoLifecycle.ts`, feature-local demo stores |
| Product resolution and normalization | `src/features/nutrition/productLookup` |
| Active scanner model | `productScoring/engine.ts` selects `kernelV5Experimental.ts` with `v5_two_axis`; inspect `ingredientLexicon.ts` and `nutrientContribution.ts` too |
| Retained alternative scanner | `productScoring/kernelV5.ts`; selected when the experiment flag is absent/unrecognized, not the published demo mode |
| Food lookup gateway | `src/server/foodSearch.ts`; Open Food Facts plus USDA FoodData Central when configured |
| Meals, hydration, calorie/macro setup | `src/features/nutrition`, including goal engine and meal library/editing |
| Readiness and daily guidance | `src/engines`, `src/features/morningBriefing`, Home composition |
| Sleep and movement | `src/features/sleepRhythm`, `src/features/movement`, related deterministic engines |
| Account-backed code | Included for audit but not activated by the demo build; inspect Supabase migrations/RLS and account-mode paths separately |

Product Quality remains separate from Lab Evidence. Do not assume that an
experimental model has been validated merely because it runs or tests pass.
The full regression suite primarily tests the standard scorer. The mode-selection
tests verify opt-in and deterministic experimental traces; a complete experimental
outcome/calibration review remains the auditor's separate task.

## External infrastructure and limitations

- Sites hosts the built web assets and Worker. Access policy, runtime secrets,
  deployment configuration, provider availability, and CDN caches are not Git files.
- USDA uses a server-only `USDA_API_KEY`. Obtain a separate authorized audit key
  if needed; do not put it in Expo public variables. Provider results can change.
- Supabase project `lhqpexnepgvuohmhltnr` is active. The last verified migration
  history is 0001–0012 plus 0015–0017. 0013 and 0014 remain intentionally pending.
  See [the database verification record](meal-library-and-editing.md#cloud-verification--september-10-2026-pacific).
- No Supabase migration or Edge Function is deployed by this GitHub update.
  Use an isolated audit database for SQL tests; do not reset the live database.
- Dependency ranges are present without a committed package lockfile. Build
  reproducibility and dependency pinning should be reviewed before a production
  release. No dependency changes were made for this handoff.
- Repository visibility remains private. The owner must grant the selected auditor
  repository and, if necessary, demo access separately. No third party was invited.

The live publication itself is unchanged by this audit handoff. GitHub is now
the primary place to inspect its app source; later releases must record the new
source SHA and build mode rather than silently maintaining a temporary fork.
