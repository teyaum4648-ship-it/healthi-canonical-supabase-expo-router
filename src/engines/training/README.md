# Training Engine

Responsibilities:

- Evaluate progression gate.
- Choose One More progression targets.
- Generate adaptive workouts.
- Generate restore sessions.
- Classify session outcomes.
- Protect against false progression.

Core rule:

Progress only when recovery and mechanics support adaptation.

Required tests:

- recovered bench example -> one target
- under-recovered bench example -> maintain/restore
- blocked pattern -> no loaded exercise
- pain during session -> progression invalid
- under-fueled -> no PR attempt
