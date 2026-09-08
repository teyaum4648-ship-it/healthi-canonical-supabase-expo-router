import { describe, expect, it } from 'vitest';

import { parseIngredients } from '../../../src/engines/nutrition/productScoring';

describe('shared Product Quality ingredient parser', () => {
  it('preserves top-level order while extracting nested parentheses and brackets', () => {
    const parsed = parseIngredients('Whole grain (oats, barley), oil [olive oil, herbs], sea salt', 'complete');
    expect(parsed.topLevelIngredients).toEqual(['whole grain', 'oil', 'sea salt']);
    expect(parsed.nestedIngredients).toEqual(['oats', 'barley', 'olive oil', 'herbs']);
    expect(parsed.declaredOrder[0]).toBe('whole grain');
    expect(parsed.completeness).toBe('complete');
  });

  it('treats a colon-delimited compound list as nested ingredients through the next semicolon', () => {
    const parsed = parseIngredients('cultures: species alpha, species beta; milk, salt', 'partial');
    expect(parsed.topLevelIngredients).toEqual(['cultures', 'milk', 'salt']);
    expect(parsed.nestedIngredients).toEqual(['species alpha', 'species beta']);
  });

  it('removes percentages and allergen suffixes without losing recoverable ingredients', () => {
    const parsed = parseIngredients('Ingredients: whole grain 62%, water, seed 8%. Contains: milk, soy', 'complete');
    expect(parsed.topLevelIngredients).toEqual(['whole grain', 'water', 'seed']);
    expect(parsed.flatTokens.join(' ')).not.toMatch(/contains|milk|soy|%/i);
  });

  it('reports reconstruction signals consistently for all scoring consumers', () => {
    const parsed = parseIngredients('water, protein isolate (pea protein), modified starch, cellulose gum', 'complete');
    expect(parsed.reconstructionSignals).toEqual(expect.arrayContaining(['isolated_component', 'modified_component', 'texture_system']));
  });
});
