# Food search and one-time nutrition setup

## Deployment

The hosted web build uses `EXPO_PUBLIC_FOOD_SEARCH_URL=/api/food-search`.
Export Expo web into `dist/client`, then run `node scripts/build-food-search-worker.cjs`.
The Worker serves the same app assets and proxies only fixed public food-search APIs.
It uses Cloudflare's `ASSETS` binding and optional `caches.default` catalog cache.
No quiz answers, meals, auth tokens, or provider secrets go into this cache.
USDA is enabled only by a server runtime `USDA_API_KEY`; never expose this key in Expo.
Without that key, search uses Open Food Facts modern full-text search with one legacy fallback.
Native/local Expo without a configured gateway retains the existing OFF search path.
Do not use a relative gateway URL for a native build or assume it is deployed by Expo Metro.

USDA expands generic and branded-food coverage, not a promise of every retailer SKU.
Source: https://fdc.nal.usda.gov/api-guide/ . USDA search nutrients are per 100 g;
missing serving weights and photos remain missing. Sources are never merged by name.
OFF source: https://openfoodfacts.github.io/search-a-licious/users/ref-openapi/ .

## Targets

No generic calorie/macro target is shown for a new user. Intake logging remains usable.
The one-time quiz is saved in existing `nutrition_targets.goal_setup` (migration 0015).
The Food tab writes the setup and active numeric targets through one owner-scoped atomic RPC;
existing target consumers read that same active row. Existing owner RLS is unchanged.
Account failures do not fall back to device storage. Explicit demo mode uses device-only
storage, which is included in Reset demo. The quiz can be reopened intentionally.
Apply and verify migration 0015 before enabling account saves. It is not auto-deployed.

The versioned engine uses Mifflin–St Jeor for a resting estimate:
https://pubmed.ncbi.nlm.nih.gov/2305711/ . Activity multipliers (1.2, 1.375, 1.55,
1.725) and conservative goal offsets are Healthi starting policies, not measured expenditure.
Loss offset is 10%, at most 300 kcal; gain is 5%, at most 200 kcal. Targets round to 25 kcal.
Protein is 20% (25% for active/gain), fat 30%, carbohydrate the remainder. These fall within
adult AMDR ranges; see https://www.nal.usda.gov/human-nutrition-and-food-safety/food-composition/macronutrients .
The displayed ±10% range is illustrative, not a statistical confidence interval.
Confidence remains low; no automatic recalibration, daily quiz, or readiness score is added.

The estimator abstains for under-18s, over-78s, pregnancy/breastfeeding or nutrition-care
concerns, eating-disorder history, unspecified equation, BMI outside 18.5–45, or estimates
outside conservative scope (below resting estimate, below 1500 or above 4500 kcal).
These are scope guards, not universal intake recommendations or a diagnosis.
See https://www.niddk.nih.gov/health-information/weight-management/body-weight-planner .
This initial policy needs qualified nutrition review before wider beta use.
