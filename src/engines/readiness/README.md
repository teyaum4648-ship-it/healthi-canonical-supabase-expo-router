# Readiness Engine

Responsibilities:

- Calculate four foundation scores.
- Calculate readiness, system load, and vitality.
- Determine day mode.
- Determine daily priority.
- Normalize missing data.
- Return confidence.
- Return reason codes.

Do not:

- Treat missing wearable data as negative.
- Use diagnosis language.
- Make recommendations without reason codes.

Required tests:

- high sleep debt -> restore
- good recovery -> build
- pain flag -> correct
- missing HRV -> lower confidence only
- under-fueled -> maintain
