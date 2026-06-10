# Healthi Engine Rules

This file defines deterministic rules for Healthi's adaptation engine. These rules are the source of truth for scoring, day mode decisions, workout adaptation, food fit, and shopping recommendations.

## 1. Core output requirements

Every engine output must include:

- `confidence`
- `reason_codes`
- `explanation`
- `created_at`

Where relevant, outputs must include:

- `score`
- `zone`
- `day_mode`
- `daily_priority`
- `safety_flags`

## 2. Missing data

Missing data must reduce confidence, not punish the user.

Bad:

```ts
if (!hrv) score -= 5;
```

Good:

```ts
if (!hrv) confidence = reduceConfidence(confidence);
```

## 3. Foundation score inputs

### Recovery + Rhythm

- Sleep debt.
- Sleep quality.
- Sleep duration.
- Bedtime consistency.
- Wake consistency.
- Current circadian phase.
- Morning sunlight.
- Caffeine timing.
- RHR deviation.
- HRV trend.

### Nourishment

- Hydration.
- Digestion.
- Meal consistency.
- Under-fueling.
- Food response.
- Food quality.
- Alcohol/caffeine timing.

### Movement

- Pain flags.
- Soreness.
- Movement permissions.
- Posture restrictions.
- Mobility restrictions.
- Last performance.
- Warm-up feedback.
- Training load.

### Mind + Life Load

- Motivation.
- Stress proxies.
- Irritability.
- Mental fog.
- Schedule pressure.
- Emotional load.
- Values alignment.

## 4. Day mode decision

Order matters.

1. Safety flags.
2. Recovery overload.
3. Movement restriction.
4. Nourishment limitation.
5. Mind/life load.
6. Build if all clear.

Pseudocode:

```ts
function determineDayMode(ctx: DailyContext): DayDecision {
  if (ctx.safety.medical_red_flag_present) {
    return {
      day_mode: 'professional_guidance',
      daily_priority: 'balanced',
      training_allowed: false,
      reason_codes: ['professional_guidance_needed']
    };
  }

  if (
    ctx.sleep.debt_hours_7d >= 5 ||
    ctx.sleep.quality_score <= 3 ||
    ctx.recovery.rhr_deviation_bpm >= 10 ||
    ctx.recovery.hrv_status === 'very_low' ||
    ctx.stress.flags_count >= 6
  ) {
    return {
      day_mode: 'restore',
      daily_priority: 'recovery_rhythm',
      training_allowed: false,
      progressive_overload_allowed: false,
      reason_codes: ['high_sleep_debt', 'high_system_load']
    };
  }

  if (
    ctx.movement.pain_flags.length > 0 ||
    ctx.movement.blocked_patterns.length > 0
  ) {
    return {
      day_mode: 'correct',
      daily_priority: 'movement_capacity',
      training_allowed: true,
      progressive_overload_allowed: false,
      reason_codes: ['movement_pattern_blocked']
    };
  }

  if (
    ctx.nourishment.digestion_score <= 4 ||
    ctx.nourishment.hydration_percent < 50 ||
    ctx.nourishment.under_fueled_yesterday
  ) {
    return {
      day_mode: 'maintain',
      daily_priority: 'nourishment',
      training_allowed: true,
      progressive_overload_allowed: false,
      reason_codes: ['nourishment_limited']
    };
  }

  if (
    ctx.mind.emotional_stress_score >= 8 ||
    ctx.mind.motivation_score <= 2 ||
    ctx.mind.burnout_flags_count >= 3
  ) {
    return {
      day_mode: 'maintain',
      daily_priority: 'mind_life_load',
      training_allowed: true,
      progressive_overload_allowed: false,
      reason_codes: ['life_load_high']
    };
  }

  return {
    day_mode: 'build',
    daily_priority: 'movement_capacity',
    training_allowed: true,
    progressive_overload_allowed: true,
    reason_codes: ['recovery_supports_progression']
  };
}
```

## 5. Training progression gate

Before allowing progression, check:

1. Safety flags.
2. Readiness zone.
3. Allostatic load.
4. Sleep debt.
5. RHR/HRV.
6. Movement permission.
7. Pain.
8. Soreness.
9. Hydration.
10. Fuel status.
11. Warm-up feedback.
12. Last session outcome.

Rules:

- Red/restore day: no progression.
- Blocked movement pattern: no loaded exercise for that pattern.
- Corrective-only permission: no progression.
- Under-fueled/hydration low: maintain.
- Warm-up mismatch: technique or maintain.
- Good recovery and allowed pattern: one progression target.

## 6. One More Rule

When ready, the user only needs one small improvement.

Valid progressions:

- More reps.
- More load.
- Same work with lower RPE.
- Better form.
- Better range.
- More volume.
- Better tempo control.

Progression does not count if:

- Pain increased.
- Form worsened.
- Range shortened.
- Tempo was not comparable.
- Rest time was much longer.
- RPE exceeded target badly.

## 7. Food fit engine

Food Fit Score = General Quality + Personal Response + Current Fit.

Allergies override everything.

General quality considers:

- Ingredient simplicity.
- Processing level.
- Added sugar.
- Artificial dyes.
- Artificial sweeteners.
- Highly processed oils.
- Preservatives.
- Protein quality.
- Fiber.
- Sodium.
- Organic/whole-food status.

Personal response considers:

- Energy.
- Digestion.
- Mood.
- Mental clarity.
- Cravings.
- Satiety.
- Sleep impact.
- Training impact.

Current fit considers:

- Goal.
- Day mode.
- Daily priority.
- Digestion today.
- Sleep debt.
- Training today.
- Circadian timing.
- Meal plan slot.

Pattern confidence:

- 1 log: single_response.
- 3 logs: early_signal.
- 5 logs: emerging_pattern.
- 8+ logs: consistent_pattern.

## 8. Shopping engine

Shopping recommendations must use:

- Goal.
- Meal plan.
- Day mode.
- Daily priority.
- Food constraints.
- Food response patterns.
- Budget.
- Store context.
- Cooking time.
- Training schedule.

Rules:

- Emphasize consistent high-response foods.
- Avoid consistent low-response foods.
- Avoid new foods on restore days or poor digestion days.
- Respect allergies absolutely.
- Include why for each major recommendation.

## 9. AI rules

AI may explain outputs. AI may not decide safety overrides. AI may not invent data. AI may not override allergies, movement blocks, or red flags.
