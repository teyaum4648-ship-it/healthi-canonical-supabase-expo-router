# Acceptance Tests

These are product-level scenarios. Unit tests should be created around them.

## 1. Bad sleep changes the whole day

Input:

```json
{
  "sleepDebtHours7d": 5.2,
  "rhrDeviationBpm": 9,
  "motivationScore": 2,
  "digestionScore": 4,
  "plannedWorkout": "heavy_lower_body"
}
```

Expected:

```json
{
  "dayMode": "restore",
  "dailyPriority": "recovery_rhythm",
  "trainingAllowed": false,
  "requiredActions": ["rebalancing_session", "outdoor_walk", "earlier_wind_down"],
  "reasonCodes": ["high_sleep_debt", "rhr_above_baseline", "digestion_off"]
}
```

## 2. Good recovery allows one progression target

Input:

```json
{
  "readinessZone": "green",
  "sleepDebtHours7d": 0.6,
  "painFlags": [],
  "patternPermission": "allowed",
  "lastSession": [
    { "exercise": "Bench Press", "load": 225, "reps": 5 },
    { "exercise": "DB Bench Press", "load": 70, "reps": 8 },
    { "exercise": "Smith Incline", "load": 185, "reps": 10 }
  ]
}
```

Expected:

```json
{
  "dayMode": "build",
  "progressionAllowed": true,
  "progressionTargetCount": 1,
  "exampleTarget": { "exercise": "DB Bench Press", "load": 70, "reps": 9 }
}
```

## 3. Under-fueled user should not push

Input:

```json
{
  "sleepQuality": "decent",
  "hydrationPercent": 38,
  "underFueledYesterday": true,
  "plannedWorkout": "upper_push"
}
```

Expected:

```json
{
  "dayMode": "maintain",
  "progressionAllowed": false,
  "volumeAdjustment": "reduce",
  "reasonCodes": ["hydration_low", "under_fueled"]
}
```

## 4. Movement restriction blocks exercise

Input:

```json
{
  "pattern": "vertical_push",
  "permission": "blocked",
  "postureFlags": ["thoracic_restriction", "rounded_shoulders"],
  "painFlags": ["shoulder_discomfort"]
}
```

Expected:

```json
{
  "blockedExercises": ["overhead_press"],
  "assignedCorrectives": ["thoracic_mobility", "shoulder_control"],
  "reasonCodes": ["movement_pattern_blocked", "posture_limitation"]
}
```

## 5. Clean product with poor personal response is not recommended

Input:

```json
{
  "generalQualityScore": 90,
  "similarFoodAverageResponse": 3.2,
  "similarFoodLogCount": 8,
  "digestionToday": "off"
}
```

Expected:

```json
{
  "label": "not_today",
  "currentFitScoreMax": 45,
  "reasonCodes": ["food_response_negative", "digestion_off"]
}
```

## 6. Costco list uses goal and personal response

Input:

```json
{
  "prompt": "I am going to Costco. What should I get?",
  "goal": "body_recomposition",
  "highResponseFoods": ["salmon", "eggs", "rice", "avocado"],
  "lowResponseFoods": ["whey", "milk", "sugar_alcohol_protein_bars"],
  "dayMode": "maintain"
}
```

Expected:

```json
{
  "shoppingListIncludes": ["salmon", "eggs", "rice", "avocado"],
  "avoidOrLimitIncludes": ["whey", "milk", "sugar_alcohol_protein_bars"],
  "hasRecipes": true,
  "hasExplanation": true
}
```

## 7. Missing HRV lowers confidence but does not punish score

Input:

```json
{
  "hrv": null,
  "sleepDuration": 480,
  "sleepQualityScore": 8,
  "rhrDeviationBpm": 0,
  "motivationScore": 4
}
```

Expected:

```json
{
  "confidence": "medium",
  "noPenaltyReason": "missing_hrv",
  "scorePenaltyForMissingHrv": 0
}
```
