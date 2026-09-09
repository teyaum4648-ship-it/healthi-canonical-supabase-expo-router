# Supabase Edge Functions

Use Edge Functions for server-side logic that requires secrets or protected operations.

Required functions:

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
