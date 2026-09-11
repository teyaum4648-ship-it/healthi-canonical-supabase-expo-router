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
5. With deployment approval, publish that build through Sites using the same
   commit SHA as its source provenance. Verify the terminal deployment result.
6. Record the resulting GitHub SHA, Sites version, and build mode in release notes.

Do not automatically apply every pending Supabase migration as part of a web
release. See [Meal library rollout](meal-library-and-editing.md) for the approved
0015–0017 rollout and the deliberately pending 0013/0014 migrations.
