# Readiness Engine Acceptance Tests

Implement these as unit tests after the readiness engine exists.

## high sleep debt -> restore

Input:
- sleep debt 5.2 hours
- RHR +9 bpm
- motivation low
- digestion off

Expected:
- day_mode restore
- daily_priority recovery_rhythm
- reason_codes include high_sleep_debt

## good recovery -> build

Input:
- sleep debt 0.5 hours
- RHR baseline
- hydration adequate
- no pain
- movement allowed

Expected:
- day_mode build
- progressive overload allowed
- reason_codes include recovery_supports_progression

## missing HRV -> lower confidence only

Input:
- HRV missing
- manual check-in complete

Expected:
- score calculated from available data
- confidence low or medium
- no penalty reason for missing HRV
