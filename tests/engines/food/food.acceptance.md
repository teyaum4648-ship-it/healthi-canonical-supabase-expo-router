# Food Engine Acceptance Tests

## clean food with poor personal response

Input:
- general quality score 90
- similar food response average 3.2 across 8 logs
- digestion off today

Expected:
- current fit low
- label not_today
- reason_codes include food_response_negative and digestion_off

## allergy

Input:
- user shellfish allergy
- shrimp product quality 95

Expected:
- product blocked
- reason_codes include allergy_constraint

## Costco list

Input:
- goal body recomposition
- high response foods: salmon, eggs, rice, avocado
- low response foods: whey, milk, sugar alcohol protein bars
- day mode maintain

Expected:
- list includes high-response foods
- avoid_or_limit includes low-response foods
- explanation includes goal and food response reasons
