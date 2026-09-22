-- Micronutrient panel on a logged meal.
--
-- Why this column is needed
--   The Nutrients tab has always had a row for potassium, calcium and iron with the
--   amount hardcoded to "Not reported", because meal_logs carries seven macro columns
--   and nothing else. The providers were never the limitation: USDA returns a full
--   nutrient panel on every food in a search response and Open Food Facts returns
--   whatever the label carried. Both were read for nine fields and the rest discarded,
--   so the panel could be shown for a food being logged and then lost on save.
--
-- Why one jsonb column rather than twenty-seven numeric ones
--   The panel is sparse by nature. A branded product reports the fourteen nutrients the
--   FDA requires on a label and nothing else, while a USDA Foundation food may report
--   all of them, so a column-per-nutrient schema would be mostly null and would need a
--   migration every time a nutrient is added to the tracked set. A key that is absent
--   means the provider did not report it, which is deliberately not the same as zero:
--   an unreported nutrient must lower confidence and never a result.
--
-- What writes it
--   toMealLogInsert in src/features/nutrition/persistence.ts, from the panel the
--   product normalisers now read (readUsdaMicronutrients / readOpenFoodFactsMicronutrients).
--
-- What reads it
--   calculateNutrientSummary sums it across the day and reports coverage alongside the
--   totals; the Nutrients tab renders the rows and the coverage lane from that summary.
--
-- What protects it
--   Nothing new. meal_logs already has row level security enabled with owner-only
--   policies, and a column inherits the policies of its table, so this is readable and
--   writable only by the user whose user_id the row carries.

alter table public.meal_logs
  add column if not exists micronutrients jsonb;

comment on column public.meal_logs.micronutrients is
'Sparse micronutrient amounts keyed by Healthi nutrient id, in the unit declared in src/engines/nutrition/micronutrients.ts. An absent key means the provider did not report that nutrient, which is not zero.';

-- An object, never an array or a bare scalar, and bounded so a malformed provider
-- payload cannot be parked here. The tracked set is 27 nutrients; the ceiling leaves
-- room to grow without allowing arbitrary documents.
alter table public.meal_logs
  drop constraint if exists meal_logs_micronutrients_shape;

alter table public.meal_logs
  add constraint meal_logs_micronutrients_shape
  check (
    micronutrients is null
    or (
      jsonb_typeof(micronutrients) = 'object'
      and octet_length(micronutrients::text) <= 4096
    )
  );
