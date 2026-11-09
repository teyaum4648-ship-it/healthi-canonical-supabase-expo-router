# Supabase Edge Functions

Use Edge Functions for server-side logic that requires secrets or protected operations.

Implemented functions:

- `delete-account`: bearer-authenticated, password-verified hard account deletion.
- `photo-estimate`: optional meal-photo estimates with explicit client consent and durable quota.
- `product-data-resolve`: product lookup.
- `lab-evidence-lookup`, `lab-evidence-review`, `fda-regulatory-sync`: optional evidence workflows.

Deploy migration `0022_release_account_and_quota.sql` before the updated photo function. The quota fails closed when its RPC is absent. Review the earlier migration 0021 and hosted migration history first. The deletion function uses the authenticated user identity, never a caller-supplied target ID. Its service-role key must remain on the server.

See [iOS release handoff](../../docs/IOS_RELEASE_HANDOFF.md) for deployment order and live-account acceptance checks. Source presence does not establish that a function is deployed.

Original roadmap ideas below are **not implemented Edge Functions** and must not be advertised as working services. Some calculations already run locally in deterministic engines; this list is not a list of calls the current app requires:

- calculateMorningBriefing
- calculateFoundationScores
- calculateReadiness
- generateWorkout
- evaluateProgressionGate
- logWorkoutSession
- calculateFoodFit
- evaluateBarcodeProduct
- generateMealPlan
- buildShoppingList
- generateRecipe
- aiPractitionerChat
- processWearableSync
- processRevenueCatWebhook
- sendNotification
- exportUserData
- deleteUserData

Secrets must be set in Supabase, not in the mobile app:

- ANTHROPIC_API_KEY
- NUTRITIONIX_APP_ID
- NUTRITIONIX_API_KEY
- REVENUECAT_WEBHOOK_SECRET
- SUPABASE_SERVICE_ROLE_KEY
