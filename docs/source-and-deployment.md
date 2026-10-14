# Source and deployment workflow

## Reconciled source — September 10, 2026 (Pacific)

Repository: https://github.com/teyaum4648-ship-it/healthi-canonical-supabase-expo-router

The audit branch is now `main`; `codex/backup-2026-09-10` remains a backup. It combines the latest canonical
app, nutrition database fixes, and the six scanner files previously present only
in the published-demo checkout. Both scoring kernels are retained. This backup
was promoted to main with the owner's approval using a fast-forward, preserving
the old history. It does not republish the website, change provider secrets, or
enable account mode. The UI refinement proposal is not implemented by this reconciliation.

## Published version at reconciliation

- URL: https://healthi-demo.teyaum4648.chatgpt.site/
- Sites version: 14
- Published source commit: `a998d08e318df78c27cd1e738c4fdbe780957b03`
- Project: `appgprj_6a9f66f8922c8191b9ab9f601aec0db4`
- Deployment: `appgdep_6aa36fd281ec8191aeaf6b0df70d7552`

The published source used a separate Git history. All its app, asset, and server
source files now exist in this branch. The newer database permissions migration,
security tests, and rollout notes remain preserved. Source parity does not mean
the currently published site's commit has changed.

## Reproduce the demo mode

From the canonical project directory with dependencies installed:

```sh
EXPO_NO_DOTENV=1 EXPO_PUBLIC_DEMO_MODE=true \
EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT=v5_two_axis \
EXPO_PUBLIC_FOOD_SEARCH_URL=/api/food-search \
npx expo export --platform web --output-dir dist/client
node scripts/build-food-search-worker.cjs
```

These are non-secret build settings. `/api/food-search` requires the existing
server Worker; Expo Metro alone does not serve that endpoint. For a local Metro
preview, omit the relative search URL to use the existing provider fallback.
USDA search still requires `USDA_API_KEY` in the server environment, never in
Expo public variables or Git. Demo records stay device-local.

## Automatic demo deploys

Every push to `main` runs `.github/workflows/deploy-demo.yml`: typecheck, the test
suite, `npm run build:demo`, then a Cloudflare deploy. A failing typecheck or test
stops the deploy, so a broken commit cannot reach the demo. Concurrent pushes
supersede rather than race each other.

One Worker serves both halves. `wrangler.jsonc` binds `dist/client` as static
assets and `dist/server/index.js` as the script, with `run_worker_first` scoped to
`/api/*` so only the food-search route costs a Worker invocation and everything
else is served from the edge. `not_found_handling: "single-page-application"`
means a refresh on a deep link resolves to the app shell.

### What has to be configured once

| Where | Name | Purpose |
| --- | --- | --- |
| GitHub repository secrets | `CLOUDFLARE_API_TOKEN` | Token with the *Edit Cloudflare Workers* template. |
| GitHub repository secrets | `CLOUDFLARE_ACCOUNT_ID` | From the Cloudflare dashboard sidebar. |
| Worker secret | `USDA_API_KEY` | Optional. `npx wrangler secret put USDA_API_KEY`. Without it, food search falls back to Open Food Facts alone. Never a GitHub secret and never an Expo public variable — it must not reach the client bundle. |

Until both GitHub secrets exist the workflow still runs and passes; the deploy step
skips and logs a notice saying why.

### On an iPhone

The export already ships a web manifest with `display: standalone`, portrait
orientation, a black background and maskable icons, so **Share → Add to Home
Screen** in Safari gives a full-screen app shell with no browser chrome. It is a
web app, not a native build: no App Store, no TestFlight, and no native camera or
haptics.

### Food search on a phone

The web app reaches the food search server at `/api/food-search` on its own address. A
phone app has no address of its own, so it joins that path to `EXPO_PUBLIC_SITE_URL`.
Once the Worker has deployed, set `EXPO_PUBLIC_SITE_URL` in the phone build's
environment to the Worker's address (`https://healthi-demo.<your-subdomain>.workers.dev`,
shown in the Cloudflare dashboard and in the deploy log). Phone searches then go through
the same server, USDA results included, and the in-app links to the legal pages start
working too. Until it is set, the phone searches the catalogue directly, as before. The
server accepts requests from the app because they carry no `Origin` header; it only
turns away other websites.

### What the demo deliberately does not do

The demo build carries no Supabase credentials, so records stay device-local and
photo estimates report themselves as not configured — they need a signed-in
account. Barcode scanning is limited by browser camera support. Sleep, Move and
the diary work in full.

This Worker publishes to a `workers.dev` subdomain, which is a different address
from the existing hosted demo; pointing a custom domain at the Worker is a
Cloudflare dashboard setting, not a change to this repository.

## Photo estimates

Photo estimates ship switched off and cost nothing until a key exists. The
`photo-estimate` edge function reports `not_configured` whenever
`ANTHROPIC_API_KEY` is unset, and the app renders that as an ordinary refusal, so
the whole capture-review-log path can be exercised without any spend.

To turn it on, set these in the Supabase function environment — never in Expo
public variables or Git, the same rule `USDA_API_KEY` follows:

| Variable | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Absent means the feature stays off. |
| `PHOTO_ESTIMATE_MODEL` | no | Defaults to `claude-opus-5`. Changing the model is a deployment setting, not a code change. |

```sh
supabase functions deploy photo-estimate
supabase secrets set ANTHROPIC_API_KEY=...
```

Estimates require a signed-in account rather than the project anon key, because
each call spends money; the function also caps one account at 25 estimates a day.
Cost is dominated by the image, which the client downscales to 1024 px on its
long edge before upload — roughly 1,000 input tokens instead of 16,000 for a
full-resolution phone photo. Photos are sent for the estimate and are not stored
by Healthi or written to the product library.

`EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT=v5_two_axis` selects
`kernelV5Experimental.ts` and displays the scoring-lab panel. Missing, empty, or
unrecognized values select `kernelV5.ts`. Expo embeds these settings at build
time, so changing them requires a restart/rebuild. No grade recalibration was
performed during this source reconciliation; the experimental model still
requires separate outcome review.

## Future release discipline

1. Make changes only in the canonical project, not a long-lived temporary fork.
2. Run typecheck, relevant tests, and a secret/diff review.
3. With approval, commit and push the exact source to this GitHub repository.
4. Build from that clean commit with explicit non-secret mode settings; put
   secrets only in the deployment service's environment configuration.
5. The Cloudflare demo deploys itself from `main` (see *Automatic demo deploys*).
   This step now applies only to the separate Sites deployment: with approval,
   publish that build using the same commit SHA as its source provenance, and
   verify the terminal deployment result.
6. Record the resulting GitHub SHA, Sites version, and build mode in release notes.

Do not automatically apply every pending Supabase migration as part of a web
release. See [Meal library rollout](meal-library-and-editing.md) for the approved
0015–0017 rollout.

Migration state has moved on since this document was first written: 0014 and
0018 have been applied to the hosted project, and 0013
(`canonical_product_cache`) is still pending — the barcode scanner falls back to
direct provider lookups without it. Photo estimates need no migration; an
estimated item is written through the existing meal-log tables and is never
cached as a product.
