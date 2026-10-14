import type {
  DataConfidence,
  FoodQualitySummary,
  FoodResponseSummary,
  NutrientSummary,
  NutritionReadinessSignal,
  NutritionTargets
} from '../../engines/nutrition';

import {
  MICRONUTRIENTS,
  dailyValueFraction,
  formatMicronutrientAmount
} from '../../engines/nutrition/micronutrients';

/**
 * Coverage as one of the words the lanes already use.
 *
 * The count belongs in the detail rather than the state: the state is a shared vocabulary
 * across every lane, and a lane that invents its own reads as a different kind of thing.
 */
function micronutrientLaneState(summary: NutrientSummary): 'Steady' | 'Building' | 'Underrepresented' | 'Limited data' {
  if (summary.meal_count === 0) return 'Limited data';
  const covered = summary.micronutrient_coverage.fraction;
  if (covered < 0.25) return 'Limited data';
  if (covered < 0.5) return 'Underrepresented';
  if (covered < 0.75) return 'Building';
  return 'Steady';
}

export type AdaptiveDietDestination = 'Build Meal' | 'Log Meal' | 'Response Log' | 'Nutrients';

export type AdaptiveDietPriority = {
  id: string;
  tag: 'Act now' | 'Build' | 'Observe';
  horizon: 'Next meal' | 'Today' | 'This week';
  title: string;
  reason: string;
  action: string;
  destination: AdaptiveDietDestination;
  confidence: DataConfidence;
};

export type AdaptiveDietLane = {
  id: string;
  name: string;
  state: 'Strong' | 'Steady' | 'Building' | 'Underrepresented' | 'Limited data';
  progress: number;
  confidence: DataConfidence;
  horizon: 'Today' | 'This week';
  detail: string;
};

export type AdaptiveDietNutrient = {
  id: string;
  name: string;
  amount: string;
  context: string;
  confidence: DataConfidence;
};

export type AdaptiveDietPresentation = {
  verdict: {
    kicker: string;
    line: string;
    reasons: string[];
    confidence: DataConfidence;
    cta: string;
  };
  priorities: AdaptiveDietPriority[];
  lanes: AdaptiveDietLane[];
  nutrients: AdaptiveDietNutrient[];
  coverage: {
    need: string;
    suggestion: string;
    explanation: string;
    destination: 'Build Meal' | 'Log Meal';
    action: string;
  };
};

function ratio(value: number | null | undefined, target: number | null | undefined): number | null {
  if (typeof value !== 'number' || typeof target !== 'number' || target <= 0) return null;
  return Math.max(0, Math.min(value / target, 1));
}

function lowerConfidence(...values: DataConfidence[]): DataConfidence {
  const rank: Record<DataConfidence, number> = { low: 0, medium: 1, high: 2 };
  return values.reduce((lowest, value) => rank[value] < rank[lowest] ? value : lowest, 'high');
}

function laneState(value: number | null): AdaptiveDietLane['state'] {
  if (value === null) return 'Limited data';
  if (value >= 0.85) return 'Strong';
  if (value >= 0.65) return 'Steady';
  if (value >= 0.4) return 'Building';
  return 'Underrepresented';
}

function percent(value: number | null): number {
  return value === null ? 0 : Math.round(value * 100);
}

function amount(value: number | null | undefined, suffix: string): string {
  if (typeof value !== 'number') return 'Not reported';
  return `${Math.round(value * 10) / 10}${suffix}`;
}

export function buildAdaptiveDietPresentation(input: {
  summary: NutrientSummary;
  targets: NutritionTargets;
  quality: FoodQualitySummary;
  response: FoodResponseSummary;
  readiness: NutritionReadinessSignal;
  responseCount: number;
}): AdaptiveDietPresentation {
  const { summary, targets, quality, response, readiness } = input;
  const hasMeals = summary.meal_count > 0;
  const protein = ratio(summary.protein_g, targets.protein_g_target);
  const carbs = ratio(summary.carbs_g, targets.carbs_g_target);
  const fiber = ratio(summary.fiber_g, targets.fiber_g_target);
  const energyValues = [ratio(summary.calories, targets.calories_target), carbs].filter((value): value is number => value !== null);
  const energy = energyValues.length ? energyValues.reduce((sum, value) => sum + value, 0) / energyValues.length : null;
  const confidence = lowerConfidence(summary.confidence, quality.confidence, response.confidence, readiness.confidence);

  const reasons = !hasMeals
    ? [
        'No meals are logged for today.',
        'Nutrition coverage remains intentionally unscored.',
        'One meal is enough to begin building today’s picture.'
      ]
    : [
        `${summary.meal_count} meal${summary.meal_count === 1 ? '' : 's'} currently inform today’s nutrition picture.`,
        protein === null ? 'Protein coverage is not fully reported.' : `Protein coverage is ${laneState(protein).toLowerCase()}.`,
        response.label === 'unknown'
          ? 'A post-meal response would add personal context.'
          : `Post-meal response is currently ${response.label}.`
      ];

  const verdictLine = !hasMeals
    ? 'Log one meal to begin today’s adaptive nutrition picture.'
    : readiness.label === 'supportive'
      ? 'Today’s meals are supporting your current needs.'
      : readiness.label === 'watch'
        ? 'Today’s meals show a few areas worth supporting next.'
        : readiness.label === 'neutral'
          ? 'Today’s nutrition picture is steady, with room to sharpen the next meal.'
          : 'Today’s picture is still forming from the meals you have logged.';

  const priorities: AdaptiveDietPriority[] = [];
  if (!hasMeals) {
    priorities.push({
      id: 'first_meal',
      tag: 'Act now',
      horizon: 'Today',
      title: 'Log your first meal',
      reason: 'daywoven needs at least one meal before it can describe today’s nutrition coverage.',
      action: 'Log a meal',
      destination: 'Log Meal',
      confidence: 'high'
    });
  } else {
    if (protein !== null && protein < 0.65) priorities.push({
      id: 'protein',
      tag: 'Act now',
      horizon: 'Next meal',
      title: 'Build protein coverage',
      reason: 'Available meal data places protein below today’s working range.',
      action: 'Build the next meal',
      destination: 'Build Meal',
      confidence: summary.confidence
    });
    if (carbs !== null && carbs < 0.65) priorities.push({
      id: 'energy',
      tag: priorities.length ? 'Build' : 'Act now',
      horizon: 'Next meal',
      title: 'Support energy availability',
      reason: 'Available carbohydrate coverage is still building for today.',
      action: 'Build the next meal',
      destination: 'Build Meal',
      confidence: summary.confidence
    });
    if (fiber !== null && fiber < 0.65) priorities.push({
      id: 'fiber',
      tag: 'Build',
      horizon: 'Today',
      title: 'Increase fiber coverage',
      reason: 'Fiber is underrepresented in the meals reported so far.',
      action: 'Review nutrients',
      destination: 'Nutrients',
      confidence: summary.confidence
    });
    if (response.label === 'unknown') priorities.push({
      id: 'response',
      tag: 'Observe',
      horizon: 'Today',
      title: 'Add personal response context',
      reason: 'A brief post-meal check-in can show how today’s food felt for you.',
      action: 'Log a response',
      destination: 'Response Log',
      confidence: 'high'
    });
  }
  if (priorities.length === 0) priorities.push({
    id: 'review',
    tag: 'Observe',
    horizon: 'Today',
    title: 'Review today’s balance',
    reason: 'The available nutrition signals are steady. Keep using personal response as context.',
    action: 'Review nutrients',
    destination: 'Nutrients',
    confidence
  });

  const lanes: AdaptiveDietLane[] = [
    {
      id: 'energy',
      name: 'Energy availability',
      state: laneState(energy),
      progress: percent(energy),
      confidence: summary.confidence,
      horizon: 'Today',
      detail: energy === null ? 'Calories and carbohydrate are not fully reported.' : 'Uses reported calories and carbohydrate in today’s meals.'
    },
    {
      id: 'protein',
      name: 'Protein + recovery',
      state: laneState(protein),
      progress: percent(protein),
      confidence: summary.confidence,
      horizon: 'Today',
      detail: protein === null ? 'Protein is not fully reported.' : 'Uses protein reported across today’s meals.'
    },
    {
      id: 'digestion',
      name: 'Digestion support',
      state: laneState(fiber),
      progress: percent(fiber),
      confidence: lowerConfidence(summary.confidence, response.confidence),
      horizon: 'Today',
      detail: input.responseCount === 0
        ? 'Fiber is available when reported; personal response has not been logged.'
        : 'Combines reported fiber with optional post-meal response context.'
    },
    {
      id: 'hydration',
      name: 'Hydration + electrolytes',
      state: 'Limited data',
      progress: 0,
      confidence: 'low',
      horizon: 'Today',
      detail: 'Water entries are shown separately in your diary. Electrolyte coverage is not measured by the current meal log.'
    },
    {
      id: 'micronutrients',
      name: 'Micronutrient coverage',
      state: micronutrientLaneState(summary),
      progress: summary.micronutrient_coverage.fraction,
      confidence: summary.micronutrient_coverage.fraction >= 0.5 ? summary.confidence : 'low',
      horizon: 'Today',
      detail: summary.meal_count === 0
        ? 'Log a food to begin reading the panel.'
        : `${summary.micronutrient_coverage.reported} of ${summary.micronutrient_coverage.tracked} tracked nutrients reported today. Packaged foods carry the label panel and little else, so coverage runs higher on whole foods. Unreported nutrients lower confidence, not your result.`
    }
  ];

  const nutrients: AdaptiveDietNutrient[] = [
    { id: 'protein', name: 'Protein', amount: amount(summary.protein_g, ' g'), context: targets.protein_g_target ? `Working range context · ${Math.round(targets.protein_g_target)} g` : 'No working range available', confidence: summary.confidence },
    { id: 'carbohydrate', name: 'Carbohydrate', amount: amount(summary.carbs_g, ' g'), context: targets.carbs_g_target ? `Working range context · ${Math.round(targets.carbs_g_target)} g` : 'No working range available', confidence: summary.confidence },
    { id: 'fat', name: 'Fat', amount: amount(summary.fat_g, ' g'), context: targets.fat_g_target ? `Working range context · ${Math.round(targets.fat_g_target)} g` : 'No working range available', confidence: summary.confidence },
    { id: 'fiber', name: 'Fiber', amount: amount(summary.fiber_g, ' g'), context: targets.fiber_g_target ? `Working range context · ${Math.round(targets.fiber_g_target)} g` : 'No working range available', confidence: summary.confidence },
    { id: 'sodium', name: 'Sodium', amount: amount(summary.sodium_mg, ' mg'), context: 'Shown as label context, not a universal quality score', confidence: summary.confidence },
    { id: 'calories', name: 'Energy', amount: amount(summary.calories, ' cal'), context: 'Context only; daywoven is not a calorie-tracking app', confidence: summary.confidence },
    /*
     * The tracked panel. These three rows used to be potassium, calcium and iron with
     * the amount hardcoded to "Not reported" and the context reading "current meal
     * records do not persist this nutrient" — which was true, under a heading that said
     * "Full spectrum, honestly reported". The providers were always sending the panel.
     */
    ...MICRONUTRIENTS.map((definition) => {
      const reported = formatMicronutrientAmount(definition.id, summary.micronutrients[definition.id]);
      const share = dailyValueFraction(definition.id, summary.micronutrients[definition.id]);
      return {
        id: definition.id,
        name: definition.label,
        amount: reported ?? 'Not reported',
        context: reported !== null && share !== null
          ? `${Math.round(share * 100)}% of a day's reference amount`
          : 'None of the foods you logged reported this',
        confidence: reported !== null ? summary.confidence : ('low' as const)
      };
    })
  ];

  const primaryGap = priorities[0]?.id;
  const coverage = primaryGap === 'protein'
    ? {
        need: 'Protein coverage',
        suggestion: 'Add a protein-rich food that fits your preferences.',
        explanation: 'Use the meal builder to preview the label data already available for foods you choose.',
        destination: 'Build Meal' as const,
        action: 'Build the next meal'
      }
    : primaryGap === 'energy'
      ? {
          need: 'Energy availability',
          suggestion: 'Add a carbohydrate source that fits the meal and your preferences.',
          explanation: 'The current signal reflects only foods already logged today.',
          destination: 'Build Meal' as const,
          action: 'Build the next meal'
        }
      : primaryGap === 'fiber'
        ? {
            need: 'Fiber coverage',
            suggestion: 'Consider a fiber-rich whole food you tolerate.',
            explanation: 'Personal digestion response should guide what works well for you.',
            destination: 'Build Meal' as const,
            action: 'Build the next meal'
          }
        : {
            need: hasMeals ? 'More complete context' : 'First meal',
            suggestion: hasMeals ? 'Add the next meal when it happens.' : 'Log one meal to begin.',
            explanation: 'daywoven will update the picture from the information you choose to log.',
            destination: 'Log Meal' as const,
            action: 'Log a meal'
          };

  return {
    verdict: {
      kicker: hasMeals ? 'Nutrition support' : 'Begin today',
      line: verdictLine,
      reasons,
      confidence,
      cta: priorities[0]?.action ?? 'Review nutrients'
    },
    priorities: priorities.slice(0, 3),
    lanes,
    nutrients,
    coverage
  };
}
