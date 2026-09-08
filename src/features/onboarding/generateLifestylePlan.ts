import type {
  LifestylePlan,
  LifestylePlanResult,
  MetabolicType,
  OnboardingAnswers,
  OnboardingArchetype,
  OnboardingDimensionScores,
  OnboardingTag
} from '../../types/onboarding';

const macroRatios: Record<MetabolicType, LifestylePlan['macroRatio']> = {
  protein: { protein: 0.4, fat: 0.35, carbs: 0.25 },
  mixed: { protein: 0.33, fat: 0.33, carbs: 0.33 },
  carbo: { protein: 0.25, fat: 0.2, carbs: 0.55 }
};

const archetypeBasePlans: Record<
  OnboardingArchetype,
  Pick<LifestylePlan, 'priorityFocus' | 'weeklyMilestones'>
> = {
  energyOptimizer: {
    priorityFocus: ['Stabilize energy', 'Set sleep timing', 'Build hydration baseline'],
    weeklyMilestones: ['Consistent wake time', 'Protein with most meals', 'Daily water target']
  },
  bodyRecomposition: {
    priorityFocus: ['Protein consistency', 'Resistance training', 'Meal quality awareness'],
    weeklyMilestones: ['Log meals 5 days', 'Complete planned training', 'Add one recovery habit']
  },
  sleepRebuilder: {
    priorityFocus: ['Consistent bedtime', 'Morning light', 'Evening downshift'],
    weeklyMilestones: ['Bedtime window 5 nights', 'Morning light 5 days', 'Screen cutoff most nights']
  },
  stressRecovery: {
    priorityFocus: ['Stress load reduction', 'Lower training intensity', 'Stable meal timing'],
    weeklyMilestones: ['Daily 10-minute downshift', 'Caffeine cutoff', 'No late hard training']
  },
  gutHealer: {
    priorityFocus: ['Simplify meals', 'Track response patterns', 'Support steady digestion'],
    weeklyMilestones: ['Track symptoms after meals', 'Use familiar foods', 'Keep meal rhythm steady']
  },
  performanceAthlete: {
    priorityFocus: ['Training consistency', 'Peri-workout nutrition', 'Recovery monitoring'],
    weeklyMilestones: ['Complete sessions', 'Fuel around training', 'Track recovery daily']
  }
};

function stringAnswer(answers: OnboardingAnswers, key: keyof OnboardingAnswers) {
  const value = answers[key];
  return typeof value === 'string' ? value : null;
}

function numberAnswer(answers: OnboardingAnswers, key: keyof OnboardingAnswers, fallback: number) {
  const value = answers[key];
  return typeof value === 'number' ? value : fallback;
}

function clampScore(score: number) {
  return Math.min(Math.max(Math.round(score), 0), 100);
}

function lookupScore(map: Record<string, number>, key: string | null, fallbackKey: string) {
  return map[key ?? fallbackKey] ?? map[fallbackKey] ?? 0;
}

function computeSleepDuration(bedtime: string | null, wakeTime: string | null) {
  if (!bedtime || !wakeTime) {
    return 7;
  }

  const [bedHour, bedMinute] = bedtime.split(':').map(Number);
  const [wakeHour, wakeMinute] = wakeTime.split(':').map(Number);

  if (
    Number.isNaN(bedHour) ||
    Number.isNaN(bedMinute) ||
    Number.isNaN(wakeHour) ||
    Number.isNaN(wakeMinute)
  ) {
    return 7;
  }

  const bedMinutes = bedHour * 60 + bedMinute;
  let wakeMinutes = wakeHour * 60 + wakeMinute;

  if (wakeMinutes < bedMinutes) {
    wakeMinutes += 1440;
  }

  return (wakeMinutes - bedMinutes) / 60;
}

function trainingDaysToNumber(value: string | null) {
  if (value === '0') {
    return 0;
  }

  if (value === '1_to_2') {
    return 2;
  }

  if (value === '3_to_4') {
    return 4;
  }

  if (value === '5_plus') {
    return 5;
  }

  return 0;
}

function computeStressScore(answers: OnboardingAnswers) {
  let score = 0;
  const stressLevel = numberAnswer(answers, 'daily_stress_score', 5);
  const energyCrashes = stringAnswer(answers, 'daytime_energy_crashes');
  const caffeineUse = stringAnswer(answers, 'caffeine_dependence');
  const nightWaking = stringAnswer(answers, 'overnight_waking');

  score += (stressLevel / 10) * 40;
  score += lookupScore({ never: 0, post_lunch_only: 15, multiple_daily: 30 }, energyCrashes, 'never');
  score += lookupScore({ none: 0, one_cup: 5, two_to_three: 15, four_plus: 25 }, caffeineUse, 'none');
  score += nightWaking === 'most_nights' ? 10 : nightWaking === 'occasionally' ? 5 : 0;

  return clampScore(score);
}

function computeSleepScore(answers: OnboardingAnswers) {
  let score = 0;
  const bedtime = stringAnswer(answers, 'bedtime');
  const bedHour = Number.parseInt(bedtime?.split(':')[0] ?? '23', 10);
  const morningRestedness = numberAnswer(answers, 'morning_rested_score', 6);
  const nightWaking = stringAnswer(answers, 'overnight_waking');
  const durationHours = computeSleepDuration(bedtime, stringAnswer(answers, 'wake_time'));

  if (bedHour >= 23) {
    score += 25;
  } else if (bedHour >= 22) {
    score += 10;
  } else if (bedHour >= 0 && bedHour < 4) {
    score += 30;
  }

  score += ((10 - morningRestedness) / 10) * 35;
  score += lookupScore({ never: 0, occasionally: 10, most_nights: 25 }, nightWaking, 'never');

  if (durationHours < 6) {
    score += 20;
  } else if (durationHours < 7) {
    score += 10;
  }

  return clampScore(score);
}

function computeSleepDebt(answers: OnboardingAnswers) {
  const durationHours = computeSleepDuration(
    stringAnswer(answers, 'bedtime'),
    stringAnswer(answers, 'wake_time')
  );

  return Math.max(0, Math.round((8 - durationHours) * 10) / 10);
}

function computeDietScore(answers: OnboardingAnswers) {
  let score = 0;
  const dietRating = numberAnswer(answers, 'diet_quality_score', 6);
  const processedFood = stringAnswer(answers, 'processed_food_frequency');
  const vegetables = stringAnswer(answers, 'vegetable_frequency');
  const waterIntake = stringAnswer(answers, 'water_intake');
  const skipsBreakfast = stringAnswer(answers, 'breakfast_skipping');

  score += ((10 - dietRating) / 10) * 30;
  score += lookupScore(
    { rarely: 0, '1_to_2_weekly': 10, '3_to_4_weekly': 20, daily: 35 },
    processedFood,
    'rarely'
  );
  score += lookupScore({ yes: 0, sometimes: 10, rarely: 20 }, vegetables, 'yes');
  score += lookupScore({ '2l_plus': 0, '1_to_2l': 10, less_than_1l: 20 }, waterIntake, '2l_plus');
  score += lookupScore({ never: 0, sometimes: 10, most_days: 20 }, skipsBreakfast, 'never');

  return clampScore(score);
}

function computeDigestiveScore(answers: OnboardingAnswers) {
  let score = 0;
  const bloating = stringAnswer(answers, 'post_meal_discomfort');
  const postMealEnergy = stringAnswer(answers, 'post_meal_energy');
  const bowelConsistency = stringAnswer(answers, 'bowel_regular');

  score += lookupScore({ rarely: 0, sometimes: 20, often: 40 }, bloating, 'rarely');
  score += lookupScore(
    { stable: 0, slight_drop: 20, significant_crash: 40 },
    postMealEnergy,
    'stable'
  );
  score += lookupScore({ yes: 0, irregular: 15, no: 25 }, bowelConsistency, 'yes');

  return clampScore(score);
}

function computeActivityScore(answers: OnboardingAnswers) {
  const days = trainingDaysToNumber(stringAnswer(answers, 'weekly_training_days'));
  const recoveryQuality = stringAnswer(answers, 'recovery_between_sessions');
  const dailyMovement = stringAnswer(answers, 'non_fitness_activity');
  let score = 0;

  if (days === 0) {
    score += 60;
  } else if (days <= 2) {
    score += 30;
  } else if (days >= 5) {
    score += 20;
  }

  score += lookupScore(
    { recovers_well: 0, slow_recovery: 20, always_sore_fatigued: 40 },
    recoveryQuality,
    'recovers_well'
  );
  score += lookupScore(
    { very_active: 0, moderately_active: 10, mostly_sedentary: 25 },
    dailyMovement,
    'moderately_active'
  );

  return clampScore(score);
}

function computeMetabolicType(answers: OnboardingAnswers): MetabolicType {
  let proteinSignals = 0;
  let carboSignals = 0;

  if (stringAnswer(answers, 'protein_fat_meal_response') === 'energized_satisfied') {
    proteinSignals += 1;
  } else if (stringAnswer(answers, 'protein_fat_meal_response') === 'heavy_sluggish') {
    carboSignals += 1;
  }

  if (stringAnswer(answers, 'carb_meal_response') === 'tired_craving_more') {
    proteinSignals += 1;
  } else if (stringAnswer(answers, 'carb_meal_response') === 'light_fine') {
    carboSignals += 1;
  }

  if (stringAnswer(answers, 'sweet_food_response') === 'hard_crash') {
    proteinSignals += 1;
  } else if (stringAnswer(answers, 'sweet_food_response') === 'fine') {
    carboSignals += 1;
  }

  if (stringAnswer(answers, 'meal_cadence') === 'long_gaps_ok') {
    proteinSignals += 1;
  } else if (stringAnswer(answers, 'meal_cadence') === 'smaller_frequent_meals') {
    carboSignals += 1;
  }

  if (stringAnswer(answers, 'post_exercise_craving') === 'protein_fat') {
    proteinSignals += 1;
  } else if (stringAnswer(answers, 'post_exercise_craving') === 'carbs_sugar') {
    carboSignals += 1;
  }

  const diff = proteinSignals - carboSignals;

  if (diff >= 2) {
    return 'protein';
  }

  if (diff <= -2) {
    return 'carbo';
  }

  return 'mixed';
}

export function scoreDimensions(answers: OnboardingAnswers): OnboardingDimensionScores {
  return {
    stressScore: computeStressScore(answers),
    sleepScore: computeSleepScore(answers),
    dietScore: computeDietScore(answers),
    digestiveScore: computeDigestiveScore(answers),
    activityScore: computeActivityScore(answers),
    metabolicType: computeMetabolicType(answers),
    sleepDebt: computeSleepDebt(answers)
  };
}

export function tagProfile(
  scores: OnboardingDimensionScores,
  answers: OnboardingAnswers
): OnboardingTag[] {
  const tags: OnboardingTag[] = [];
  const trainingDays = trainingDaysToNumber(stringAnswer(answers, 'weekly_training_days'));
  const bedtime = stringAnswer(answers, 'bedtime');
  const bedHour = Number.parseInt(bedtime?.split(':')[0] ?? '23', 10);

  if (
    scores.stressScore >= 60 &&
    stringAnswer(answers, 'caffeine_dependence') !== 'none' &&
    stringAnswer(answers, 'overnight_waking') !== 'never' &&
    stringAnswer(answers, 'daytime_energy_crashes') === 'multiple_daily'
  ) {
    tags.push('hpaFatigue');
  }

  if (
    stringAnswer(answers, 'post_meal_energy') === 'significant_crash' &&
    stringAnswer(answers, 'sweet_food_response') === 'hard_crash' &&
    stringAnswer(answers, 'breakfast_skipping') !== 'never'
  ) {
    tags.push('bloodSugarDysregulation');
  }

  if (
    (bedHour >= 23 || (bedHour >= 0 && bedHour < 4)) &&
    (stringAnswer(answers, 'daily_schedule') === 'shift_irregular' ||
      stringAnswer(answers, 'overnight_waking') === 'most_nights')
  ) {
    tags.push('circadianDisruption');
  }

  if (scores.sleepScore >= 50) {
    tags.push('poorSleep');
  }

  if (scores.digestiveScore >= 40) {
    tags.push('gutIssues');
  }

  if (
    trainingDays >= 5 &&
    stringAnswer(answers, 'recovery_between_sessions') === 'always_sore_fatigued' &&
    scores.sleepScore >= 40
  ) {
    tags.push('overtraining');
  }

  if (trainingDays <= 1 && stringAnswer(answers, 'non_fitness_activity') === 'mostly_sedentary') {
    tags.push('sedentary');
  }

  if (stringAnswer(answers, 'caffeine_dependence') === 'four_plus') {
    tags.push('caffeineDependence');
  }

  if (scores.dietScore >= 50) {
    tags.push('poorDietQuality');
  }

  if (stringAnswer(answers, 'water_intake') === 'less_than_1l') {
    tags.push('underHydrated');
  }

  return tags;
}

export function resolveArchetype(
  primaryGoal: string | null,
  scores: OnboardingDimensionScores,
  tags: OnboardingTag[]
): OnboardingArchetype {
  const goalMap: Record<string, OnboardingArchetype> = {
    energy_focus: 'energyOptimizer',
    body_composition: 'bodyRecomposition',
    sleep_optimization: 'sleepRebuilder',
    stress_recovery: 'stressRecovery',
    hormone_rhythm_support: 'stressRecovery',
    athletic_performance: 'performanceAthlete'
  };
  let archetype = goalMap[primaryGoal ?? ''] ?? 'energyOptimizer';

  if (scores.sleepScore >= 70 && archetype !== 'sleepRebuilder') {
    archetype = 'sleepRebuilder';
  }

  if (tags.includes('gutIssues') && scores.digestiveScore >= 60) {
    archetype = 'gutHealer';
  }

  if (tags.includes('hpaFatigue') && archetype !== 'stressRecovery') {
    archetype = 'stressRecovery';
  }

  return archetype;
}

function selectMealTiming(archetype: OnboardingArchetype, tags: OnboardingTag[]) {
  if (tags.includes('bloodSugarDysregulation')) {
    return {
      protocol: 'stabilized',
      description: 'Eat soon after waking. Do not skip meals. Pair carbs with protein or fat.',
      mealsPerDay: 3,
      fastingWindow: null
    };
  }

  if (archetype === 'performanceAthlete') {
    return {
      protocol: 'performance',
      description: 'Prioritize pre- and post-training nutrition. Place more carbs near training.',
      mealsPerDay: 4,
      fastingWindow: null
    };
  }

  if (archetype === 'bodyRecomposition') {
    return {
      protocol: 'recomp',
      description: 'Keep protein consistent and use a steady meal window that does not disrupt sleep.',
      mealsPerDay: 3,
      fastingWindow: 'flexible'
    };
  }

  return {
    protocol: 'standard',
    description: 'Three balanced meals. Eat within 1 hour of waking. Stop eating 2 hours before bed.',
    mealsPerDay: 3,
    fastingWindow: null
  };
}

function selectSleepProtocol(tags: OnboardingTag[]): LifestylePlan['sleepProtocol'] {
  const notes: string[] = [];

  if (tags.includes('hpaFatigue')) {
    notes.push('Stress and sleep signals are high, so early wind-down is a priority.');
  }

  if (tags.includes('circadianDisruption')) {
    notes.push('Get outdoor light within 30 minutes of waking when possible.');
  }

  return {
    targetBedtime: tags.includes('hpaFatigue') ? '22:00' : '22:30',
    screenCutoffMinutes: 60,
    morningLight: true,
    notes: notes.length > 0 ? notes.join(' ') : undefined
  };
}

function selectSupplementFocus(
  archetype: OnboardingArchetype,
  tags: OnboardingTag[],
  metabolicType: MetabolicType
): LifestylePlan['supplementFocus'] {
  const focus: LifestylePlan['supplementFocus'] = [
    {
      name: 'Magnesium-rich evening routine',
      timing: 'Evening',
      reason: 'Supports wind-down and sleep quality'
    },
    {
      name: 'Omega-3 food or supplement discussion',
      timing: 'With meals',
      reason: 'Supports general recovery and cognitive function'
    }
  ];

  if (tags.includes('hpaFatigue')) {
    focus.push({
      name: 'Stress-support review',
      timing: 'Discuss before adding',
      reason: 'Stress and sleep signals are currently the main limiter'
    });
  }

  if (tags.includes('bloodSugarDysregulation')) {
    focus.push({
      name: 'Glucose-support basics',
      timing: 'With meals',
      reason: 'Meal stability should come before aggressive dieting'
    });
  }

  if (tags.includes('gutIssues')) {
    focus.push({
      name: 'Digestive support review',
      timing: 'With meals',
      reason: 'Meal response patterns suggest digestion should be tracked closely'
    });
  }

  if (archetype === 'performanceAthlete') {
    focus.push({
      name: 'Creatine suitability review',
      timing: 'Daily',
      reason: 'Common performance support option when appropriate'
    });
  }

  if (metabolicType === 'protein') {
    focus.push({
      name: 'Protein digestion check',
      timing: 'Protein-forward meals',
      reason: 'Protein-forward meals appear to suit this user'
    });
  }

  return focus;
}

function selectExercise(archetype: OnboardingArchetype, tags: OnboardingTag[]) {
  if (tags.includes('overtraining')) {
    return {
      weeklyFrequency: 3,
      intensity: 'low-moderate',
      focus: 'deload',
      notes: 'Reduce volume and rebuild recovery before increasing intensity.'
    };
  }

  if (tags.includes('sedentary')) {
    return {
      weeklyFrequency: 3,
      intensity: 'low',
      focus: 'movement habit',
      notes: 'Start with short sessions and build consistency before intensity.'
    };
  }

  const exerciseMap: Record<OnboardingArchetype, LifestylePlan['exerciseGuidance']> = {
    energyOptimizer: {
      weeklyFrequency: 4,
      intensity: 'moderate',
      focus: 'mixed cardio + strength'
    },
    bodyRecomposition: {
      weeklyFrequency: 4,
      intensity: 'moderate-high',
      focus: 'resistance training primary'
    },
    sleepRebuilder: {
      weeklyFrequency: 3,
      intensity: 'moderate',
      focus: 'morning training preferred'
    },
    stressRecovery: {
      weeklyFrequency: 3,
      intensity: 'low-moderate',
      focus: 'zone 2 cardio + mobility'
    },
    gutHealer: {
      weeklyFrequency: 3,
      intensity: 'low-moderate',
      focus: 'walking + light resistance'
    },
    performanceAthlete: {
      weeklyFrequency: 5,
      intensity: 'high',
      focus: 'periodized strength + conditioning'
    }
  };

  return exerciseMap[archetype];
}

function selectStressProtocol(tags: OnboardingTag[]): LifestylePlan['stressProtocol'] {
  if (!tags.includes('hpaFatigue') && !tags.includes('caffeineDependence')) {
    return { priority: 'low', interventions: [] };
  }

  return {
    priority: tags.includes('hpaFatigue') ? 'high' : 'moderate',
    interventions: [
      tags.includes('caffeineDependence') ? 'Taper caffeine and avoid intake after noon' : null,
      tags.includes('hpaFatigue') ? 'Daily 10-minute breathwork or quiet downshift' : null,
      tags.includes('hpaFatigue') ? 'Avoid high-intensity training until sleep improves' : null,
      'Use a structured wind-down routine before bed'
    ].filter((item): item is string => Boolean(item))
  };
}

function generateWarnings(tags: OnboardingTag[]) {
  const warnings: string[] = [];

  if (tags.includes('hpaFatigue')) {
    warnings.push(
      'Stress, caffeine, night waking, and energy crash signals are stacked. Pushy training or aggressive dieting should wait.'
    );
  }

  if (tags.includes('bloodSugarDysregulation')) {
    warnings.push('Energy swings are likely to worsen if meals are skipped or carbs are eaten alone.');
  }

  if (tags.includes('overtraining')) {
    warnings.push('Recovery is lagging. More training right now may slow progress.');
  }

  return warnings;
}

export function assemblePlan(
  archetype: OnboardingArchetype,
  tags: OnboardingTag[],
  metabolicType: MetabolicType
): LifestylePlan {
  const base = archetypeBasePlans[archetype];

  return {
    archetype,
    metabolicType,
    macroRatio: macroRatios[metabolicType],
    mealTiming: selectMealTiming(archetype, tags),
    sleepProtocol: selectSleepProtocol(tags),
    supplementFocus: selectSupplementFocus(archetype, tags, metabolicType),
    exerciseGuidance: selectExercise(archetype, tags),
    stressProtocol: selectStressProtocol(tags),
    priorityFocus: base.priorityFocus,
    weeklyMilestones: base.weeklyMilestones,
    warningFlags: generateWarnings(tags)
  };
}

export function generateLifestylePlan(answers: OnboardingAnswers): LifestylePlanResult {
  const scores = scoreDimensions(answers);
  const tags = tagProfile(scores, answers);
  const archetype = resolveArchetype(stringAnswer(answers, 'primary_goal'), scores, tags);
  const plan = assemblePlan(archetype, tags, scores.metabolicType);

  return {
    plan,
    scores,
    tags,
    archetype
  };
}
