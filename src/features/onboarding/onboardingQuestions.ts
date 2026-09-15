import type { OnboardingQuestion } from '../../types/onboarding';

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    key: 'primary_goal',
    section: 'Starting point',
    prompt: 'What would you like Healthi to support first?',
    helper: 'Choose the area that would make the biggest difference in your day right now.',
    type: 'single',
    options: [
      { value: 'energy_focus', label: 'Improve daily energy' },
      { value: 'build_consistency', label: 'Build consistency' },
      { value: 'sleep_optimization', label: 'Support recovery rhythm' },
      { value: 'nourishment_habits', label: 'Improve nourishment habits' },
      { value: 'athletic_performance', label: 'Train more intelligently' },
      { value: 'balance_schedule', label: 'Balance a full schedule' },
      { value: 'patterns_over_time', label: 'Understand patterns over time' }
    ]
  },
  {
    key: 'blocking_factors',
    section: 'Starting point',
    prompt: 'Which areas deserve the most support?',
    type: 'multi',
    options: [
      { value: 'low_energy', label: 'Daily energy' },
      { value: 'poor_sleep', label: 'Sleep rhythm' },
      { value: 'digestive_issues', label: 'Meal comfort' },
      { value: 'poor_recovery', label: 'Recovery between training' },
      { value: 'schedule_pressure', label: 'A crowded schedule' },
      { value: 'no_clear_issue', label: 'I want a clearer baseline' }
    ]
  },
  {
    key: 'bedtime',
    section: 'Recovery rhythm',
    prompt: 'What time do you usually start trying to sleep?',
    helper: 'However you write it — 10:30pm, 22:30 or 2230.',
    type: 'time'
  },
  {
    key: 'wake_time',
    section: 'Recovery rhythm',
    prompt: 'What time do you usually wake up?',
    helper: 'However you write it — 6:45am, 06:45 or 645.',
    type: 'time'
  },
  {
    key: 'morning_rested_score',
    section: 'Recovery rhythm',
    prompt: 'How restored do you feel most mornings?',
    type: 'scale',
    min: 1,
    max: 10,
    // 2 clears the model's "under-rested" thresholds (<= 4, and <= 3 for restore mode);
    // 5 and 8 sit clear of both.
    scaleLabels: [
      { value: 2, label: 'Rarely rested' },
      { value: 5, label: 'Some mornings' },
      { value: 8, label: 'Usually rested' }
    ]
  },
  {
    key: 'overnight_waking',
    section: 'Recovery rhythm',
    prompt: 'How often does your sleep get interrupted?',
    type: 'single',
    options: [
      { value: 'never', label: 'Rarely or never' },
      { value: 'occasionally', label: 'Some nights' },
      { value: 'most_nights', label: 'Most nights' }
    ]
  },
  {
    key: 'meal_cadence',
    section: 'Nourishment',
    prompt: 'What meal rhythm feels most natural right now?',
    type: 'single',
    options: [
      { value: 'three_larger_meals', label: 'Three main meals' },
      { value: 'smaller_frequent_meals', label: 'Smaller meals more often' },
      { value: 'long_gaps_ok', label: 'Longer gaps work well for me' }
    ]
  },
  {
    key: 'diet_quality_score',
    section: 'Nourishment',
    prompt: 'How steady do your nourishment habits feel?',
    type: 'scale',
    min: 1,
    max: 10,
    // 3 clears the model's <= 4 threshold for nourishment priority.
    scaleLabels: [
      { value: 3, label: 'Inconsistent' },
      { value: 6, label: 'Mixed' },
      { value: 8, label: 'Fairly steady' }
    ]
  },
  {
    key: 'water_intake',
    section: 'Nourishment',
    prompt: 'What is your usual water intake?',
    type: 'single',
    options: [
      { value: 'less_than_1l', label: 'Less than 1 litre' },
      { value: '1_to_2l', label: 'Around 1 to 2 litres' },
      { value: '2l_plus', label: 'More than 2 litres' }
    ]
  },
  {
    key: 'post_meal_energy',
    section: 'Nourishment',
    prompt: 'How does your energy usually feel after meals?',
    type: 'single',
    options: [
      { value: 'stable', label: 'Generally stable' },
      { value: 'slight_drop', label: 'A slight drop' },
      { value: 'significant_crash', label: 'A noticeable drop' }
    ]
  },
  {
    key: 'weekly_training_days',
    section: 'Movement',
    prompt: 'How many days a week are you moving intentionally?',
    type: 'single',
    options: [
      { value: '0', label: '0 days' },
      { value: '1_to_2', label: '1 to 2 days' },
      { value: '3_to_4', label: '3 to 4 days' },
      { value: '5_plus', label: '5 or more days' }
    ]
  },
  {
    key: 'training_types',
    section: 'Movement',
    prompt: 'What movement do you enjoy or want to return to?',
    type: 'multi',
    options: [
      { value: 'strength_lifting', label: 'Strength' },
      { value: 'cardio', label: 'Cardio' },
      { value: 'sports', label: 'Sports' },
      { value: 'yoga_mobility', label: 'Yoga or mobility' },
      { value: 'mixed', label: 'A mix of movement' },
      { value: 'none_currently', label: 'Nothing consistent yet' }
    ]
  },
  {
    key: 'recovery_between_sessions',
    section: 'Movement',
    prompt: 'How does your body feel between movement sessions?',
    type: 'single',
    options: [
      { value: 'recovers_well', label: 'Ready for the next one' },
      { value: 'slow_recovery', label: 'I need a little more time' },
      { value: 'always_sore_fatigued', label: 'Often worn down' }
    ]
  },
  {
    key: 'non_fitness_activity',
    section: 'Movement',
    prompt: 'What is your day like outside structured movement?',
    type: 'single',
    options: [
      { value: 'mostly_sedentary', label: 'Mostly seated' },
      { value: 'moderately_active', label: 'A mix of sitting and moving' },
      { value: 'very_active', label: 'On my feet most of the day' }
    ]
  },
  {
    key: 'daily_stress_score',
    section: 'Mind and life load',
    prompt: 'How full does your life load feel most days?',
    helper: 'This helps Healthi make plans that fit your actual capacity.',
    type: 'scale',
    min: 1,
    max: 10,
    // The model reads two separate tiers here, >= 7 and >= 8, so both are kept
    // reachable: 7 lands on the first, 9 on the second, 4 on neither.
    scaleLabels: [
      { value: 4, label: 'Manageable' },
      { value: 7, label: 'Busy' },
      { value: 9, label: 'Overloaded' }
    ]
  },
  {
    key: 'daily_schedule',
    section: 'Mind and life load',
    prompt: 'Which schedule sounds most like yours?',
    type: 'single',
    options: [
      { value: 'standard_9_to_5', label: 'A regular workday' },
      { value: 'shift_irregular', label: 'Irregular or changing hours' },
      { value: 'student', label: 'School or study-led' },
      { value: 'remote_flexible', label: 'Flexible or self-directed' }
    ]
  }
];
