import type { FoodPatternProfile, FoodPatternResultCopy } from './foodPatternTypes';

const COPY_BY_LABEL: Record<FoodPatternProfile['pattern_label'], Omit<FoodPatternResultCopy, 'confidence_note'>> = {
  steady_balanced: {
    title: 'Balanced pattern',
    summary:
      'Your current Food Pattern Profile leans balanced. Based on your answers, a moderate meal rhythm may support steady energy.'
  },
  protein_forward: {
    title: 'Protein-forward pattern',
    summary:
      'Your current Food Pattern Profile leans protein-forward. Meals with a clear protein anchor may support steadier appetite and energy.'
  },
  carb_supported: {
    title: 'Carb-supported pattern',
    summary:
      'Your current Food Pattern Profile leans carb-supported. Well-timed carbs may support training, focus, or appetite stability.'
  },
  lighter_frequent: {
    title: 'Lighter, steadier rhythm',
    summary:
      'Your current Food Pattern Profile leans toward lighter, more frequent meals. Smaller meals or planned snacks may feel easier.'
  },
  evening_sensitive: {
    title: 'Evening-sensitive pattern',
    summary:
      'Your current Food Pattern Profile suggests dinner timing may matter. Earlier or lighter dinners may support your wind-down window.'
  },
  calibrating: {
    title: 'Food pattern calibrating',
    summary:
      'Healthi does not have a clear enough food pattern yet. A few meal logs and response check-ins will make this more useful.'
  }
};

export function getFoodPatternResultCopy(profile: FoodPatternProfile): FoodPatternResultCopy {
  const copy = COPY_BY_LABEL[profile.pattern_label];
  const confidenceNote =
    profile.confidence === 'medium'
      ? 'Confidence is medium based on your answers. Healthi will keep refining this as you log meals and responses.'
      : 'Confidence is low for now. Healthi will keep calibrating with meal logs and response check-ins.';

  return {
    ...copy,
    confidence_note: confidenceNote
  };
}
