import type { OnboardingQuestion } from '../../types/onboarding';

export const onboardingQuestions: OnboardingQuestion[] = [
  {
    key: 'primary_goal',
    section: 'Goals',
    prompt: 'What should your plan focus on first?',
    type: 'single',
    options: [
      { value: 'energy_focus', label: 'Energy & focus' },
      { value: 'body_composition', label: 'Body composition' },
      { value: 'sleep_optimization', label: 'Sleep optimization' },
      { value: 'stress_recovery', label: 'Stress & recovery' },
      { value: 'hormone_rhythm_support', label: 'Hormone rhythm support' },
      { value: 'athletic_performance', label: 'Athletic performance' }
    ]
  },
  {
    key: 'blocking_factors',
    section: 'Goals',
    prompt: 'What feels most in the way right now?',
    type: 'multi',
    options: [
      { value: 'low_energy', label: 'Low energy' },
      { value: 'poor_sleep', label: 'Poor sleep' },
      { value: 'brain_fog', label: 'Brain fog' },
      { value: 'digestive_issues', label: 'Digestive issues' },
      { value: 'mood_swings', label: 'Mood swings' },
      { value: 'poor_recovery', label: 'Poor recovery' },
      { value: 'excess_body_fat', label: 'Excess body fat' },
      { value: 'no_clear_issue', label: 'No clear issue' }
    ]
  },
  {
    key: 'result_timeline',
    section: 'Goals',
    prompt: 'How soon do you want to notice change?',
    type: 'single',
    options: [
      { value: '2_to_4_weeks', label: '2-4 weeks' },
      { value: '1_to_3_months', label: '1-3 months' },
      { value: 'long_term_lifestyle', label: 'Long-term lifestyle shift' }
    ]
  },
  {
    key: 'protein_fat_meal_response',
    section: 'Metabolic Fit',
    prompt: 'After a protein-and-fat-forward meal, you usually feel:',
    helper: 'Think eggs, salmon, steak, avocado, or similar meals.',
    type: 'single',
    options: [
      { value: 'energized_satisfied', label: 'Energized and satisfied' },
      { value: 'heavy_sluggish', label: 'Heavy or sluggish' },
      { value: 'neutral', label: 'No strong pattern' }
    ]
  },
  {
    key: 'carb_meal_response',
    section: 'Metabolic Fit',
    prompt: 'After a carb-forward meal, you usually feel:',
    helper: 'Think rice, pasta, bread, oats, or a larger starch serving.',
    type: 'single',
    options: [
      { value: 'light_fine', label: 'Light and fine' },
      { value: 'tired_craving_more', label: 'Tired and craving more' },
      { value: 'neutral', label: 'No strong pattern' }
    ]
  },
  {
    key: 'sweet_food_response',
    section: 'Metabolic Fit',
    prompt: 'When you eat sweet foods, what tends to happen?',
    type: 'single',
    options: [
      { value: 'hard_crash', label: 'Crash within an hour' },
      { value: 'fine', label: 'No noticeable effect' },
      { value: 'rush_then_drop', label: 'Rush, then a drop' }
    ]
  },
  {
    key: 'meal_cadence',
    section: 'Metabolic Fit',
    prompt: 'You function best with:',
    type: 'single',
    options: [
      { value: 'three_larger_meals', label: '3 larger meals' },
      { value: 'smaller_frequent_meals', label: 'Smaller meals more often' },
      { value: 'long_gaps_ok', label: 'Long gaps with no issue' }
    ]
  },
  {
    key: 'post_exercise_craving',
    section: 'Metabolic Fit',
    prompt: 'After intense exercise, you tend to want:',
    type: 'single',
    options: [
      { value: 'protein_fat', label: 'Protein and fat' },
      { value: 'carbs_sugar', label: 'Carbs or something sweet' },
      { value: 'both', label: 'Both equally' }
    ]
  },
  {
    key: 'diet_quality_score',
    section: 'Diet Quality',
    prompt: 'How would you rate your current diet overall?',
    type: 'scale',
    min: 1,
    max: 10
  },
  {
    key: 'processed_food_frequency',
    section: 'Diet Quality',
    prompt: 'How often do you eat processed or fast food?',
    type: 'single',
    options: [
      { value: 'rarely', label: 'Rarely' },
      { value: '1_to_2_weekly', label: '1-2x per week' },
      { value: '3_to_4_weekly', label: '3-4x per week' },
      { value: 'daily', label: 'Daily' }
    ]
  },
  {
    key: 'vegetable_frequency',
    section: 'Diet Quality',
    prompt: 'Do you eat vegetables with most meals?',
    type: 'single',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'rarely', label: 'Rarely' }
    ]
  },
  {
    key: 'water_intake',
    section: 'Diet Quality',
    prompt: 'What is your current water intake?',
    type: 'single',
    options: [
      { value: 'less_than_1l', label: 'Less than 1L' },
      { value: '1_to_2l', label: '1-2L' },
      { value: '2l_plus', label: '2L+ daily' }
    ]
  },
  {
    key: 'breakfast_skipping',
    section: 'Diet Quality',
    prompt: 'Do you skip breakfast regularly?',
    type: 'single',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'most_days', label: 'Most days' }
    ]
  },
  {
    key: 'bedtime',
    section: 'Sleep',
    prompt: 'What time do you typically go to bed?',
    type: 'time'
  },
  {
    key: 'wake_time',
    section: 'Sleep',
    prompt: 'What time do you typically wake up?',
    type: 'time'
  },
  {
    key: 'morning_rested_score',
    section: 'Sleep',
    prompt: 'How rested do you feel most mornings?',
    type: 'scale',
    min: 1,
    max: 10
  },
  {
    key: 'overnight_waking',
    section: 'Sleep',
    prompt: 'Do you wake between 1-4am and struggle to fall back asleep?',
    type: 'single',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'occasionally', label: 'Occasionally' },
      { value: 'most_nights', label: 'Most nights' }
    ]
  },
  {
    key: 'daily_stress_score',
    section: 'Stress',
    prompt: 'Rate your average daily stress level.',
    type: 'scale',
    min: 1,
    max: 10
  },
  {
    key: 'stress_sources',
    section: 'Stress',
    prompt: 'Where does stress mainly come from?',
    type: 'multi',
    options: [
      { value: 'work_finances', label: 'Work or finances' },
      { value: 'relationships', label: 'Relationships' },
      { value: 'health_concerns', label: 'Health concerns' },
      { value: 'family', label: 'Family' },
      { value: 'general_anxiety', label: 'General anxiety' },
      { value: 'low_stress', label: 'Low stress overall' }
    ]
  },
  {
    key: 'daytime_energy_crashes',
    section: 'Stress',
    prompt: 'Do you experience energy crashes during the day?',
    type: 'single',
    options: [
      { value: 'never', label: 'Never' },
      { value: 'post_lunch_only', label: 'Post-lunch only' },
      { value: 'multiple_daily', label: 'Multiple times daily' }
    ]
  },
  {
    key: 'caffeine_dependence',
    section: 'Stress',
    prompt: 'Do you rely on caffeine to function?',
    type: 'single',
    options: [
      { value: 'none', label: 'No' },
      { value: 'one_cup', label: '1 cup' },
      { value: 'two_to_three', label: '2-3 cups' },
      { value: 'four_plus', label: '4+ cups' }
    ]
  },
  {
    key: 'post_meal_discomfort',
    section: 'Digestion',
    prompt: 'Do you experience bloating, gas, or discomfort after eating?',
    type: 'single',
    options: [
      { value: 'rarely', label: 'Rarely' },
      { value: 'sometimes', label: 'Sometimes' },
      { value: 'often', label: 'Often' }
    ]
  },
  {
    key: 'post_meal_energy',
    section: 'Digestion',
    prompt: 'How are your energy levels 1-2 hours after meals?',
    type: 'single',
    options: [
      { value: 'stable', label: 'Stable' },
      { value: 'slight_drop', label: 'Slight drop' },
      { value: 'significant_crash', label: 'Significant crash' }
    ]
  },
  {
    key: 'bowel_regular',
    section: 'Digestion',
    prompt: 'Do you have consistent daily bowel movements?',
    type: 'single',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'irregular', label: 'Irregular' },
      { value: 'no', label: 'No' }
    ]
  },
  {
    key: 'weekly_training_days',
    section: 'Activity',
    prompt: 'How many days per week do you train or exercise?',
    type: 'single',
    options: [
      { value: '0', label: '0' },
      { value: '1_to_2', label: '1-2' },
      { value: '3_to_4', label: '3-4' },
      { value: '5_plus', label: '5+' }
    ]
  },
  {
    key: 'training_types',
    section: 'Activity',
    prompt: 'What type of training do you primarily do?',
    type: 'multi',
    options: [
      { value: 'strength_lifting', label: 'Strength/lifting' },
      { value: 'cardio', label: 'Cardio' },
      { value: 'sports', label: 'Sports' },
      { value: 'yoga_mobility', label: 'Yoga/mobility' },
      { value: 'mixed', label: 'Mixed' },
      { value: 'none_currently', label: 'None currently' }
    ]
  },
  {
    key: 'recovery_between_sessions',
    section: 'Activity',
    prompt: 'How is your recovery between sessions?',
    type: 'single',
    options: [
      { value: 'recovers_well', label: 'I recover well' },
      { value: 'slow_recovery', label: 'Takes longer than it should' },
      { value: 'always_sore_fatigued', label: 'Always sore or fatigued' }
    ]
  },
  {
    key: 'daily_schedule',
    section: 'Lifestyle',
    prompt: 'What is your daily schedule like?',
    type: 'single',
    options: [
      { value: 'standard_9_to_5', label: 'Standard 9-5' },
      { value: 'shift_irregular', label: 'Shift work or irregular hours' },
      { value: 'student', label: 'Student' },
      { value: 'remote_flexible', label: 'Remote/flexible' }
    ]
  },
  {
    key: 'non_fitness_activity',
    section: 'Lifestyle',
    prompt: 'Which best describes you outside of fitness?',
    type: 'single',
    options: [
      { value: 'mostly_sedentary', label: 'Mostly sedentary' },
      { value: 'moderately_active', label: 'Moderately active' },
      { value: 'very_active', label: 'Very active' }
    ]
  }
];
