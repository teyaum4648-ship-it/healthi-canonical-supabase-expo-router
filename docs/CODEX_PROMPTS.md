# Codex Prompts

Use these prompts one at a time. Do not paste the entire product vision into one task and expect sane software. That is how bugs gain citizenship.

## Prompt 1: Foundation

```txt
Read AGENTS.md and docs/PRODUCT_REQUIREMENTS.md.

Create the React Native + Expo foundation for Healthi.

Implement:
- Expo Router
- TypeScript
- Supabase client setup
- Environment variable handling
- Auth screens for email/password login and signup
- Logout
- Protected navigation
- Placeholder tabs:
  - Dashboard
  - Movement
  - Food
  - Progress
  - Settings
- Reusable UI components:
  - Screen
  - Card
  - Button
  - TextInput
  - SectionHeader

Create:
- src/lib/supabase.ts
- src/types/profile.ts
- src/components/*
- app/(auth)/*
- app/(tabs)/*

Also apply or create Supabase SQL migration for:
- profiles
- user_settings
- user_consents

Enable RLS on all public tables. Policies must allow users to read/update only their own rows.

Do not implement scoring, workouts, food logging, AI, payments, barcode scanner, or wearables yet.

Return:
- files changed
- setup steps
- test steps
```

## Prompt 2: Onboarding

```txt
Read AGENTS.md and docs/PRODUCT_REQUIREMENTS.md.

Implement the holistic onboarding flow.

Requirements:
- One question per screen
- Progress bar
- Back/next navigation
- Save draft locally
- Submit completed responses to Supabase
- Store answers in assessment_sessions and assessment_answers
- Generate baseline_profiles row after completion

Sections:
1. Goals
2. Sleep and circadian rhythm
3. Stress and life load
4. Digestion
5. Food constraints
6. Hydration and stimulants
7. Training history
8. Injuries and limitations
9. Movement assessment
10. Posture self-screen
11. Equipment and schedule

Use original language only. Do not use proprietary methodology wording.

Do not implement readiness scoring yet.

Add unit tests for baseline profile generation.
```

## Prompt 3: Readiness engine

```txt
Read AGENTS.md, docs/ENGINE_RULES.md, and docs/PRODUCT_REQUIREMENTS.md.

Implement the first version of the Healthi scoring engine.

Create:
- src/engines/readiness/calculateFoundationScores.ts
- src/engines/readiness/calculateReadiness.ts
- src/engines/readiness/determineDayMode.ts
- src/constants/reasonCodes.ts
- src/types/readiness.ts

The engine must calculate:
- recovery_rhythm score
- nourishment score
- movement_capacity score
- mind_life_load score
- readiness_score
- system_load_score
- vitality_score
- day_mode
- daily_priority
- confidence
- reason_codes

Rules:
- Missing data must reduce confidence, not punish score.
- First 7-14 days should return calibration status.
- Every output must include reason codes.
- No medical language.

Add tests for:
- high sleep debt -> restore mode
- good recovery -> build mode
- pain flag -> correct mode
- missing HRV -> lower confidence but no penalty
- under-fueled -> maintain mode
```

## Prompt 4: Morning Briefing

```txt
Read AGENTS.md and docs/PRODUCT_REQUIREMENTS.md.

Implement Morning Briefing generation and dashboard display.

Create:
- src/engines/readiness/generateMorningBriefing.ts
- src/types/dailyProtocol.ts
- dashboard components for readiness, foundation scores, daily priority, movement summary, food strategy, hydration, and sleep debt

Requirements:
- Use readiness output
- Use foundation scores
- Use reason codes
- Display confidence
- Display calibration state if relevant
- Show one primary action for today

Do not implement AI yet.
```

## Prompt 5: Training engine

```txt
Read AGENTS.md, docs/ENGINE_RULES.md, and docs/PRODUCT_REQUIREMENTS.md.

Implement the adaptive training engine.

Create:
- src/engines/training/evaluateProgressionGate.ts
- src/engines/training/chooseProgressionTarget.ts
- src/engines/training/classifySessionOutcome.ts
- src/types/training.ts

Requirements:
- Use movement permissions
- Use readiness
- Use sleep debt
- Use hydration/fuel status
- Use soreness and pain flags
- Use last session performance
- Choose one small progression target only when allowed

Progression types:
- more_reps
- more_load
- same_work_lower_rpe
- better_form
- better_range
- more_volume
- better_tempo_control

Rules:
- Do not chase progression on red/restore days.
- Do not load blocked movement patterns.
- Do not count progression if pain increased.
- Do not count progression if form or range worsened.
- One successful progression target is enough for the session.

Add tests using this scenario:
Previous:
- Bench Press 225 x 5
- DB Bench 70s x 8
- Smith Incline 185 x 10

If recovered:
- Target one small progression, such as DB Bench 70s x 9.

If under-recovered:
- Return maintain or restore mode with reasons.
```

## Prompt 6: Food response engine

```txt
Read AGENTS.md, docs/ENGINE_RULES.md, and docs/PRODUCT_REQUIREMENTS.md.

Implement the food response engine.

Create:
- src/engines/food/scoreFoodFit.ts
- src/engines/food/analyzeFoodPattern.ts
- src/types/food.ts

Food Fit Score must include:
- general_quality_score
- personal_response_score
- current_fit_score
- total_score
- confidence
- reason_codes

Pattern confidence:
- 1 log = single_response
- 3 logs = early_signal
- 5 logs = emerging_pattern
- 8+ logs = consistent_pattern

Rules:
- Personal response can override general food quality.
- Allergies always override everything.
- Poor digestion today should reduce current fit for risky/new foods.
- High sleep debt should favor familiar, high-response foods.
- Do not use moralizing language like bad food.

Add tests:
- clean product + poor personal response -> not recommended today
- allergy -> blocked
- high response food + build day -> strong fit
- poor digestion + new food -> lower score
```

## Prompt 7: Shopping assistant

```txt
Read AGENTS.md, docs/ENGINE_RULES.md, and docs/PRODUCT_REQUIREMENTS.md.

Implement the shopping list engine.

Create:
- src/engines/food/buildShoppingList.ts
- src/types/shopping.ts

User use case:
I am going to Costco. Build my list for 5 days.

Inputs:
- goal
- day_mode
- daily_priority
- meal plan
- food constraints
- food response patterns
- budget
- store type
- servings
- cooking time
- training schedule

Output:
- strategy_summary
- categorized shopping list
- avoid_or_limit list
- recipes
- meal prep plan
- explanation with reason codes

Rules:
- Emphasize consistent high-response foods.
- Avoid consistent low-response foods.
- Avoid new food experiments on restore days or poor digestion days.
- Respect allergies absolutely.
- Include why each major category was chosen.

Add tests for Costco body recomposition scenario.
```

## Prompt 8: AI practitioner

```txt
Read AGENTS.md, docs/AI_RULES.md, and docs/SAFETY_LANGUAGE.md.

Implement AI practitioner scaffolding.

Create:
- src/types/ai.ts
- src/services/aiService.ts
- supabase/functions/aiPractitionerChat/index.ts
- app/ai/chat screen

Requirements:
- User must consent before AI uses personal health data.
- AI receives minimal structured context only.
- AI may explain deterministic engine outputs.
- AI cannot override safety flags, allergies, or blocked movement patterns.
- Store chat sessions and messages.
- Store safety events when triggered.

Do not include real API keys.
Use environment variables for backend secrets.
```
