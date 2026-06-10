# Healthi Agent Instructions

You are building Healthi, a holistic adaptive coaching mobile app.

## Source of truth

Read these files before implementation:

- `docs/PRODUCT_REQUIREMENTS.md`
- `docs/ENGINE_RULES.md`
- `docs/DATA_MODEL.md`
- `docs/SAFETY_LANGUAGE.md`
- `docs/AI_RULES.md`
- `docs/BUILD_PHASES.md`

## Non-negotiable rules

1. Do not build the whole app at once.
2. Implement one feature layer per task.
3. Use TypeScript.
4. Use React Native + Expo.
5. Use Expo Router for navigation.
6. Use Supabase for auth, database, and edge functions.
7. Never expose service-role keys, AI API keys, Nutritionix keys, or other backend secrets in the mobile app.
8. Every recommendation must include reason codes.
9. Every score must include confidence.
10. Missing wearable data must reduce confidence, not punish the score.
11. Do not use medical diagnosis language.
12. Do not copy proprietary CHEK, RISE, WHOOP, Oura, Yuka, Bobby Approved, or other branded methodology language.
13. Do not assign loaded exercise patterns when movement permission is blocked.
14. Do not allow AI to override deterministic safety rules.
15. Do not count progression if pain increased, form degraded, or range of motion worsened.
16. Allergies and safety flags override all food and workout recommendations.
17. Write unit tests for deterministic engines before or alongside UI.
18. Prefer pure functions for scoring and decision engines.
19. Keep engine outputs serializable.
20. Use calm, clear, non-shaming consumer copy.

## Product philosophy

The user's goal gives direction. The body's current state gives permission.

## Engineering philosophy

Build deterministic engines first. Use AI only as an explanation and concierge layer grounded in structured data.

## Style

- Keep code simple and testable.
- Prefer explicit types over loose objects.
- Use small functions.
- Use reason codes, not magic strings in UI.
- Never hard-code health claims without a safety review.

## When uncertain

If a task would affect safety, privacy, medical boundaries, food allergies, AI data sharing, payment entitlements, or wearable data permissions, stop and ask for clarification before implementing.
