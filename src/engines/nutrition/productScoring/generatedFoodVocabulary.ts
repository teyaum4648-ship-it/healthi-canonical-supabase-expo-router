/**
 * Food names generated from USDA FoodData Central by scripts/build-food-vocabulary.mjs.
 *
 * Do not edit by hand — run `npm run vocab:build` with USDA_API_KEY set. It is empty in
 * the repository because the environment this was written in cannot reach USDA, not
 * because generation is optional: the curated list in foodVocabulary.ts is a few hundred
 * names chosen by category, and USDA publishes roughly ten thousand as public-domain
 * data. Running it is what takes the table from "the categories someone thought of" to
 * "the foods that exist".
 *
 * Nothing here can lower a score. These names are consulted only after every hand rule
 * has missed, and can move an ingredient from unrecognised to food and nowhere else.
 */
export const GENERATED_FOOD_VOCABULARY: readonly string[] = [];
