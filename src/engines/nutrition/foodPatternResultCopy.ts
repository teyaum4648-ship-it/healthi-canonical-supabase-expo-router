import type { FoodPatternLabel, FoodPatternProfile, FoodPatternResultCopy } from './foodPatternTypes';

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

/** The short name for a pattern, so other surfaces can name it the same way this one does. */
export function foodPatternTitle(label: FoodPatternLabel): string {
  return COPY_BY_LABEL[label].title;
}

/**
 * Where a pattern came from, said plainly.
 *
 * An answer given on a questionnaire and an answer measured from how meals actually went
 * are not the same kind of claim, and the app was presenting them identically. A quiz
 * result is a starting guess about somebody; a pattern that has moved because of logged
 * responses is a reading of them. Saying which one is on screen is what lets a person
 * judge how much to trust it.
 */
function provenanceNote(profile: FoodPatternProfile): string {
  if (profile.source === 'adaptive_update') {
    return 'This has been adjusted by how your logged meals actually went, not only by your answers.';
  }
  if (profile.source === 'manual_adjustment') {
    return 'You set this yourself. Healthi will leave it alone unless you change it.';
  }
  return 'This comes from your answers so far. Logging how meals go will sharpen it into something measured.';
}

export function getFoodPatternResultCopy(profile: FoodPatternProfile): FoodPatternResultCopy {
  const copy = COPY_BY_LABEL[profile.pattern_label];
  const confidenceNote =
    profile.confidence === 'high'
      ? 'Confidence is high, from repeated responses to meals of this kind.'
      : profile.confidence === 'medium'
        ? 'Confidence is medium based on your answers. Healthi will keep refining this as you log meals and responses.'
        : 'Confidence is low for now. Healthi will keep calibrating with meal logs and response check-ins.';

  return {
    ...copy,
    confidence_note: `${confidenceNote} ${provenanceNote(profile)}`
  };
}
