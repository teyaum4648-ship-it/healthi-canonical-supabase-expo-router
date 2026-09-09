# Training Engine Acceptance Tests

## recovered bench example

Previous:
- Bench Press 225 x 5
- DB Bench 70s x 8
- Smith Incline 185 x 10

Current:
- green readiness
- no pain
- horizontal push allowed
- hydration adequate
- fuel adequate

Expected:
- progression_allowed true
- training_state build
- one progression target such as DB Bench 70s x 9

## under-recovered bench example

Current:
- sleep debt 5 hours
- RHR +10 bpm
- readiness red

Expected:
- progression_allowed false
- training_state restore
- recommended adjustment restore

## false progression

Previous:
- Bench 225 x 5, good form, full range, pain 0

Current:
- Bench 225 x 6, poor form, shortened range, pain 3

Expected:
- progression invalid
- outcome movement_constraint or recovery_mismatch
