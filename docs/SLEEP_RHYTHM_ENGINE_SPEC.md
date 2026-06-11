# Healthi Sleep + Rhythm Engine Spec

## 1. Purpose

The Sleep + Rhythm Engine helps Healthi infer and organize sleep and rhythm data so future Daily Check-In flows can ask fewer questions.

The engine estimates likely sleep timing, sleep consistency, sleep need, sleep debt, and useful rhythm-based timing windows. It is a general wellness planning engine. It should use cautious wording, expose confidence, and make clear when data is estimated or incomplete.

The engine should support manual entry first, then passive phone signals and platform sleep data later with explicit user permission.

## 2. Product Architecture

Healthi should keep the sleep stack separated into clear layers:

- `Sleep + Rhythm Engine`: inferred or logged sleep and rhythm data.
- `Daily Check-In`: later asks only for missing subjective signals.
- `Daily Readiness`: later interprets today's state using sleep, rhythm, recovery, nourishment, movement, and life-load context.
- `Morning Briefing`: later gives today's plan after readiness and safety logic are available.

This engine does not decide training intensity by itself. It suggests timing windows and rhythm context. Future readiness logic decides whether harder training is appropriate.

## 3. Data Sources

Each source should include `source_type`, `confidence`, `captured_at`, and reason codes.

Supported source types:

- `manual`: user-entered sleep or wake data.
- `estimated`: deterministic estimate from available signals.
- `demo`: seeded data for local/demo flows.
- `phone_motion`: motion signals, only after permission.
- `phone_activity`: activity classification signals, only after permission.
- `healthkit`: platform sleep data, only after permission.
- `health_connect`: platform sleep data, only after permission.
- `wearable`: imported wearable sleep data, only after permission.
- `user_corrected`: user-adjusted sleep or wake data.

Confidence values:

- `low`: sparse, estimated, conflicting, or manually incomplete data.
- `medium`: enough consistent data for useful planning, but still estimated or mixed-source.
- `high`: strong source reliability and stable recent pattern.

Missing data should lower confidence. Missing data should not automatically increase sleep debt, pressure, or rhythm risk.

## 4. Passive Sleep Detection Model

The future passive model should operate over minute-level observations. Each minute can move through a cautious state model:

- `awake`
- `settling`
- `likely_asleep`
- `asleep`
- `waking`
- `awake_after_sleep`

Inputs that may be available later:

- phone motion
- steps
- stationary state
- phone interaction markers
- historical bedtime and wake pattern
- sleep window prior
- platform or wearable sleep data
- manual correction

Source priority:

1. User correction.
2. Platform or wearable sleep session with sufficient confidence.
3. Manual entry.
4. Phone motion/activity estimate.
5. Historical pattern estimate.
6. Demo fallback.

The engine should not claim exact sleep timing. It should return likely sleep onset, likely wake time, confidence, and reason codes.

Confidence logic:

- Manual correction can increase confidence for the corrected session.
- Strong platform or wearable session data can increase confidence.
- Motion-only estimates should usually remain low or medium.
- Conflicting signals should reduce confidence.
- Long signal gaps should reduce confidence.
- Quiet wakefulness should remain uncertain instead of being treated as confirmed sleep.

## 5. Minute-Level Sleep Likelihood

Each minute receives:

```ts
sleep_likelihood: number // 0 to 1
```

Positive signals:

- low motion
- no steps
- no phone interaction
- inside expected sleep window
- phone stationary for a sustained period
- matches historical sleep pattern

Negative signals:

- unlock or screen interaction
- steps
- walking, running, or vehicle activity
- repeated pickups
- inconsistent signal gaps

The score should be deterministic and explainable. Example weighting model:

```text
base likelihood from sleep window prior
+ low-motion score
+ stationary duration score
+ historical pattern match
- interaction penalty
- activity penalty
- signal gap penalty
```

The exact weights should be tuned with tests and real-world validation later. V1 can define the shape without using passive sensors.

## 6. Sleep Session Extraction

Sleep session extraction should use sustained windows, not single events.

Likely sleep start:

- Requires high sleep likelihood sustained for 20 to 30 minutes.
- Should occur inside or near the expected sleep window when pattern data exists.
- Should be adjusted by user correction if provided.

Likely wake time:

- Requires sustained activity, steps, phone interaction, or platform wake event after a sleep-like block.
- Should ignore a single brief wake marker unless it is followed by sustained awake signals.

Awake gaps:

- Short gaps inside a sleep block should be tracked as possible awake periods.
- Gaps with low confidence should be labeled as uncertain.
- Quiet wakefulness should not be automatically converted to sleep.

Session output should include:

```ts
type SleepSessionEstimate = {
  session_id: string;
  user_id: string;
  sleep_start: string;
  wake_time: string;
  duration_minutes: number;
  awake_gap_minutes: number;
  source_type: SleepSourceType;
  confidence: DataConfidence;
  reason_codes: SleepRhythmReasonCode[];
  corrected_by_user: boolean;
  created_at: string;
};
```

## 7. User Correction Learning

Manual corrections should improve the model slowly and transparently.

Corrections can update:

- sleep onset correction offset
- wake time correction offset
- source reliability score
- personal bedtime prior
- personal wake-time prior
- confidence adjustments

Example:

- If the engine often estimates sleep onset 20 minutes too early and the user repeatedly corrects it, future estimates can shift later.
- If phone motion data often conflicts with user corrections, phone-motion confidence should drop for that user.

The engine should avoid overfitting to one unusual night.

## 8. Sleep Need Estimator

V1 behavior:

- Use onboarding `sleep_need_minutes_estimate` if available.
- Otherwise default to 480 minutes.
- Keep the estimate stable during early calibration.

Future updates should happen slowly using:

- sleep quality
- wake ease
- daytime energy
- sleep consistency
- longer sleep rebound response
- user corrections
- future platform or wearable data

The estimate should not swing based on one night. Suggested update rule:

```text
new_sleep_need = prior_sleep_need + small_adjustment
```

Where `small_adjustment` is capped and requires repeated evidence.

## 9. Sleep Debt Model

For each usable night:

```text
debt = max(0, sleep_need - actual_sleep)
repayment = max(0, actual_sleep - sleep_need)
net_debt = debt - repayment_credit
```

Repayment should be conservative. Sleeping longer than need can reduce recent debt, but should not fully erase multiple short nights at once.

7-day sleep debt:

- Used later for readiness and day-mode thresholds.
- Should emphasize the current week.
- Should include confidence based on usable nights and source quality.

14-day sleep debt:

- Used for rhythm trend and energy planning.
- Should weight recent nights more than older nights.

Example recency weighting:

```text
day 1 to 3: weight 1.0
day 4 to 7: weight 0.75
day 8 to 14: weight 0.45
```

Confidence rules:

- Fewer than 3 usable nights: `low`
- 3 to 6 usable nights: `medium`
- 7 or more usable nights: `medium` or `high`, depending on source confidence

Output:

```ts
type SleepDebtSummary = {
  sleep_need_minutes: number;
  debt_7d_minutes: number;
  debt_14d_weighted_minutes: number;
  usable_nights_7d: number;
  usable_nights_14d: number;
  confidence: DataConfidence;
  reason_codes: SleepRhythmReasonCode[];
};
```

## 10. Circadian Energy Model

Healthi should use a practical two-process wellness model:

- Process S: homeostatic sleep pressure
- Process C: circadian rhythm

Estimated energy:

```text
estimated_energy(t) = circadian_drive(t) - sleep_pressure(t) - sleep_inertia(t) - sleep_debt_penalty
```

This is a planning model, not a precise biological measurement.

Energy windows:

- `wake_grogginess`
- `rising`
- `morning_peak`
- `afternoon_dip`
- `second_peak`
- `wind_down`
- `sleep_window`

Suggested V1 window anchors:

- Wake grogginess: first 30 to 90 minutes after wake.
- Morning peak: about 2 to 5 hours after wake.
- Afternoon dip: about 7 to 9 hours after wake.
- Second peak: about 10 to 13 hours after wake.
- Wind-down: about 90 minutes before target bedtime.
- Sleep window: target bedtime range.

Sleep debt should reduce energy amplitude and make recovery-supporting windows more prominent.

## 11. Day Organization Outputs

The rhythm engine should output suggested timing windows:

- best deep work windows
- best exercise windows
- best walk windows
- short nap window
- breathing/reset windows
- caffeine cutoff
- wind-down start
- target bedtime

Example output:

```ts
type RhythmDayPlan = {
  date: string;
  target_bedtime: string;
  target_wake_time: string;
  caffeine_cutoff: string;
  wind_down_start: string;
  windows: Array<{
    type:
      | 'deep_work'
      | 'exercise'
      | 'walk'
      | 'short_nap'
      | 'breathing_reset'
      | 'wind_down'
      | 'sleep';
    start: string;
    end: string;
    confidence: DataConfidence;
    reason_codes: SleepRhythmReasonCode[];
  }>;
  confidence: DataConfidence;
  reason_codes: SleepRhythmReasonCode[];
};
```

Future readiness logic decides exercise intensity. This engine only suggests better timing.

## 12. Reason Codes

Initial reason codes:

- `sleep_data_missing`
- `source_confidence_low`
- `sleep_debt_low`
- `sleep_debt_moderate`
- `sleep_debt_high`
- `wake_time_estimated`
- `sleep_onset_estimated`
- `circadian_phase_estimated`
- `caffeine_cutoff_recommended`
- `wind_down_recommended`
- `nap_window_suggested`
- `deep_work_window_suggested`
- `movement_window_suggested`
- `user_corrected_sleep`

Reason codes should be stable and serializable. User-facing copy should be generated from reason codes by a safe explanation layer.

## 13. Privacy and Permissions

Phone motion and activity signals require explicit user permission.

Healthi should process raw passive signals on-device where possible. The app should store only necessary derived sleep and rhythm events unless the user explicitly consents to more detailed logs.

Healthi should not share raw passive signal logs with AI systems. Future AI explanation layers should receive structured summaries only, after user consent and with safety rules applied.

The user must be able to:

- see what source produced a sleep estimate
- correct sleep and wake times
- revoke passive signal permissions
- use manual entry without passive tracking

## 14. V1/V2/V3/V4 Rollout

V1:

- deterministic engine only
- manual and demo sleep data
- no native permissions
- unit tests for math, windows, confidence, and serialization

V2:

- phone motion and activity integration
- explicit user permission
- manual correction flow
- source reliability and correction offsets

V3:

- HealthKit, Health Connect, and wearable integrations
- adaptive calibration
- stronger source confidence rules

V4:

- Morning Briefing integration
- notification timing integration
- deeper day planning once readiness and safety layers exist

## 15. Tests Required

Required tests:

- sleep duration across midnight
- missing data confidence
- 7-day sleep debt
- 14-day sleep debt
- recency weighting
- repayment credit
- energy windows from wake time
- high debt reducing energy amplitude
- caffeine cutoff
- wind-down start
- nap window
- source confidence
- user correction override
- serializability
- forbidden-language scan for user-facing copy

## Language Boundaries

Use:

- estimated
- likely
- based on your recent pattern
- suggests
- may be a better time
- confidence
- general wellness guidance

Avoid prohibited medical, proprietary, or certainty-heavy language from `AGENTS.md` and `docs/SAFETY_LANGUAGE.md`.

## Open Implementation Notes

- Keep passive sensing out of V1.
- Keep platform integrations out of V1.
- Keep outputs deterministic and serializable.
- Keep confidence separate from score or window quality.
- Keep source attribution visible in every session and day-plan output.
- Store derived events first; avoid raw signal storage unless the user explicitly opts in.
