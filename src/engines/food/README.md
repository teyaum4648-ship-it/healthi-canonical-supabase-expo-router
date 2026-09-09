# Food Engine

Responsibilities:

- Analyze food patterns.
- Score general food quality.
- Score personal response.
- Score current fit.
- Generate meal plans.
- Build shopping lists.
- Evaluate barcode products.

Core rule:

Personal response can override general food quality, but allergies override everything.

Required tests:

- clean food + poor response -> not today
- allergy -> blocked
- high response + build day -> strong fit
- poor digestion + new food -> lower fit
- Costco list uses high-response foods and avoids low-response foods
