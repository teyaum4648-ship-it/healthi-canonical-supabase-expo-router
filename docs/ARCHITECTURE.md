# Healthi Architecture

## Overview

Healthi should be built as a mobile-first app with deterministic decision engines and a backend-mediated AI layer.

## Stack

| Layer | Choice |
|---|---|
| Mobile | React Native + Expo |
| Language | TypeScript |
| Navigation | Expo Router |
| Build | EAS Build with custom development client |
| Backend | Supabase |
| Auth | Supabase Auth |
| Database | Supabase Postgres |
| Edge functions | Supabase Edge Functions |
| AI | Backend-only provider call |
| Food data | Backend-only food API calls |
| Barcode | Expo Camera |
| iOS health | Apple HealthKit |
| Android health | Health Connect |
| Payments | RevenueCat |
| Push | Expo Notifications |

## Architecture diagram

```txt
Mobile App
  -> Supabase Auth
  -> Supabase Postgres with RLS
  -> Supabase Storage
  -> Supabase Edge Functions
       -> AI provider
       -> Food database API
       -> Scoring engines
       -> RevenueCat webhooks
       -> Push notification jobs

Native integrations
  -> iOS: HealthKit
  -> Android: Health Connect
```

## Key principle

The mobile app displays and logs. The backend protects secrets and performs sensitive external calls. Pure deterministic engine code may live in the mobile app, backend, or shared package, but all privileged calls must go through backend functions.

## Suggested repository structure

```txt
healthi/
  app/
    (auth)/
    (onboarding)/
    (tabs)/
      dashboard/
      movement/
      food/
      progress/
      settings/
    workout/
    restore/
    shopping/
    ai/
  src/
    components/
    constants/
    engines/
      readiness/
      circadian/
      training/
      food/
      safety/
    hooks/
    lib/
    services/
    types/
  docs/
  supabase/
    migrations/
    functions/
  tests/
```

## Data flow

### Morning briefing

```txt
User opens app
-> fetch latest metrics
-> calculate foundation scores
-> calculate readiness
-> determine daily priority and day mode
-> generate daily protocol
-> store briefing output
-> render dashboard
```

### Workout adaptation

```txt
Planned workout
-> check readiness and allostatic load
-> check movement permissions
-> check posture/mobility restrictions
-> check last session performance
-> evaluate progression gate
-> generate build/maintain/technique/correct/restore session
-> log session outcome
-> update next session targets
```

### Food and shopping

```txt
Food log or product scan
-> score general quality
-> fetch user response history
-> calculate personal response score
-> calculate current fit score
-> store evaluation
-> update meal plan/shopping plan if relevant
```

### AI practitioner

```txt
User asks question
-> build minimal AI context snapshot
-> apply safety constraints
-> call backend AI function
-> AI answers using structured context
-> store message and safety events
```

## Shared engine rules

Any engine must output:

- `score` where relevant.
- `confidence` where relevant.
- `reason_codes`.
- `explanation` or user-facing summary where needed.
- `safety_flags` where relevant.

## Backend secrets

Never expose:

- Supabase service role key.
- AI provider key.
- Food database key.
- RevenueCat webhook secrets.
- App Store / Play Store secrets.

Use Supabase Edge Function secrets.

## App build requirement

Because this product needs native modules for subscriptions, health integrations, and possibly scanner/HealthKit/Health Connect flows, use Expo development builds rather than relying only on Expo Go.
