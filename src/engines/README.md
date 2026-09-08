# Healthi Engines

All product intelligence should live here or in Supabase Edge Functions.

Engines should be:

- Deterministic
- Typed
- Unit tested
- Serializable
- Explainable with reason codes
- Safe by default

Do not hide product logic inside React components.

## Engine folders

- `readiness/`: foundation scores, readiness, allostatic load, day mode
- `circadian/`: sleep debt, sleep need, energy curve, caffeine cutoff, wind-down
- `training/`: movement permissions, progression gate, workout generation, restore sessions
- `food/`: food quality, personal response, food fit, shopping lists, product evaluation
- `safety/`: red flags, language constraints, escalation rules
