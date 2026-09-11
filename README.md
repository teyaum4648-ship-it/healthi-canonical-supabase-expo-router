# Healthi Repo Package

## Current app and live-demo source

The combined app source is on `codex/backup-2026-09-10`, including the live demo's
optional ZIP-based scanner engine and the newer nutrition database fixes. GitHub's
default `main` branch has not been merged with these changes.

See [Source and deployment workflow](docs/source-and-deployment.md) for the live
version, demo build settings, and the process for keeping GitHub and deployments
aligned. Secrets and personal account data are not part of this source backup.

Healthi is a working codename for a holistic adaptive coaching mobile app. The product connects sleep, circadian rhythm, recovery, allostatic load, food quality, personal food response, digestion, hydration, posture, mobility, flexibility, training performance, stress, motivation, and goals into one daily plan.

This repo package is designed for use with Codex, Cursor, Replit Agent, or another coding agent. It is not the full app yet. It is the source-of-truth documentation, implementation plan, schemas, engine rules, safety language, and starter TypeScript contracts that a coding agent should follow.

## Core product promise

Wake up knowing what your body needs today: restore, nourish, correct, move, or perform, and know exactly why.

## How to use this package

1. Unzip this package.
2. Create a Git repo.
3. Keep `AGENTS.md` at the repo root.
4. Put all docs under `docs/`.
5. Ask Codex to read `AGENTS.md` first.
6. Build one phase at a time. Do not ask an agent to build the whole app in one prompt, unless your goal is to create a TypeScript wildlife preserve.

## Recommended build order

1. Foundation: Expo, TypeScript, Supabase, auth, protected navigation, design system.
2. Onboarding: holistic intake, baseline profile, movement and posture self-screens.
3. Metrics and scoring: metric observations, foundation scores, readiness, confidence, reason codes.
4. Morning Briefing: daily priority, day mode, protocol, dashboard.
5. Movement and training: permissions, progression gate, workout generator, rebalancing sessions.
6. Food response: food logs, response scoring, pattern confidence, food fit score.
7. Shopping and recipes: Costco-style shopping assistant, meal planning, recipes.
8. Barcode scanner: product lookup, ingredient notes, product fit scoring.
9. AI practitioner: explanation and concierge layer grounded in deterministic engine outputs.
10. Wearables and subscriptions: HealthKit, Health Connect, RevenueCat.

## Package contents

- `AGENTS.md` - root instructions for coding agents.
- `docs/PRODUCT_REQUIREMENTS.md` - full product PRD.
- `docs/ARCHITECTURE.md` - system architecture.
- `docs/BUILD_PHASES.md` - step-by-step build plan.
- `docs/DATA_MODEL.md` - database model and entity relationships.
- `docs/ENGINE_RULES.md` - deterministic scoring and adaptation rules.
- `docs/AI_RULES.md` - AI behavior and safety rules.
- `docs/SAFETY_LANGUAGE.md` - allowed and prohibited language.
- `docs/CODEX_PROMPTS.md` - copy/paste prompts for Codex.
- `docs/ACCEPTANCE_TESTS.md` - expected scenarios and outputs.
- `docs/IMPLEMENTATION_CHECKLIST.md` - implementation checklist.
- `supabase/migrations/0001_initial_schema.sql` - starter Supabase schema with RLS.
- `src/types/` - TypeScript contracts.
- `src/constants/` - reason codes, goals, movement patterns.
- `tests/engine_scenarios.json` - scenario fixtures for future unit tests.

## Important boundary

This product is inspired by holistic practitioner-style assessment. It must not copy proprietary questionnaires, branded terminology, diagrams, exercises, course language, or trademarks from any source unless licensed.

Use original names and original language.
