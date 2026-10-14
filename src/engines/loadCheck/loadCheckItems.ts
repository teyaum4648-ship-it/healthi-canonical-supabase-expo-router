/**
 * The load check: Healthi's own short questionnaire about the past month.
 *
 * It takes its structure from whole-person health assessment — load read area by area,
 * banded rather than totalled, red-flag symptoms routed to a professional rather than
 * priced into a score — and its words from nowhere else. Every prompt here is written for
 * this app. See docs/readiness-allostatic-load.md for where each area lands and why.
 *
 * Every answer is worth 0 to 3 points of load, and options are listed lightest first, so
 * an answer is stored as its points. Higher always means more load.
 */

export type LoadArea = 'rhythm' | 'food_quality' | 'food_timing' | 'digestion' | 'life_load' | 'exposures';
export type LoadPoints = 0 | 1 | 2 | 3;
export type LoadOption = { label: string; points: LoadPoints };

/** Questions the app can answer from what has been logged, instead of asking. */
export type LoadObservable = 'wake_unrested' | 'late_bedtime' | 'irregular_bedtime' | 'late_first_meal' | 'caffeine_drinks';

export type LoadItem = {
  id: string;
  area: LoadArea;
  prompt: string;
  options: readonly LoadOption[];
  observable?: LoadObservable;
  /** An answer at or above this suggests a professional look, in addition to the score. */
  flag?: { minPoints: LoadPoints; message: string };
};

const FREQUENCY: readonly LoadOption[] = [
  { label: 'Rarely', points: 0 },
  { label: 'Sometimes', points: 1 },
  { label: 'Often', points: 2 },
  { label: 'Most days', points: 3 }
];

const NIGHTS: readonly LoadOption[] = [
  { label: 'Rarely', points: 0 },
  { label: 'Some nights', points: 1 },
  { label: 'Most nights', points: 2 },
  { label: 'Nearly every night', points: 3 }
];

export const LOAD_AREAS: ReadonlyArray<{ id: LoadArea; title: string; blurb: string }> = [
  { id: 'rhythm', title: 'Sleep and rhythm', blurb: 'How your nights and mornings usually go.' },
  { id: 'food_quality', title: 'What you eat', blurb: 'The usual make-up of your meals.' },
  { id: 'food_timing', title: 'When you eat', blurb: 'The timing of meals and drinks across the day.' },
  { id: 'digestion', title: 'Digestion', blurb: 'How food tends to sit with you.' },
  { id: 'life_load', title: 'Life load', blurb: 'What the rest of life is asking of you.' },
  { id: 'exposures', title: 'Everyday exposures', blurb: 'What you are around, and how your head feels.' }
];

export const LOAD_ITEMS: readonly LoadItem[] = [
  { id: 'r_unrested', area: 'rhythm', prompt: 'How often do you wake up still tired?', options: FREQUENCY, observable: 'wake_unrested' },
  { id: 'r_late', area: 'rhythm', prompt: 'How often are you still up after 11 p.m.?', options: NIGHTS, observable: 'late_bedtime' },
  { id: 'r_night_waking', area: 'rhythm', prompt: 'How often do you wake in the night and struggle to get back to sleep?', options: NIGHTS },
  { id: 'r_irregular', area: 'rhythm', prompt: 'How often does your bedtime move by more than an hour from one night to the next?', options: NIGHTS, observable: 'irregular_bedtime' },
  { id: 'r_slump', area: 'rhythm', prompt: 'How often do you hit a heavy slump in the afternoon?', options: FREQUENCY },
  { id: 'r_screens', area: 'rhythm', prompt: 'How often are you on a screen in the last half hour before sleep?', options: NIGHTS },

  { id: 'q_packaged', area: 'food_quality', prompt: 'How often are your meals mostly packaged, takeaway or fast food?', options: FREQUENCY },
  { id: 'q_sugar', area: 'food_quality', prompt: 'How often do you have sugary drinks or sweets through the day?', options: FREQUENCY },
  {
    id: 'q_plants', area: 'food_quality', prompt: 'On a usual day, how many servings of vegetables or fruit do you eat?',
    options: [
      { label: 'Five or more', points: 0 },
      { label: 'Three or four', points: 1 },
      { label: 'One or two', points: 2 },
      { label: 'Hardly any', points: 3 }
    ]
  },
  {
    id: 'q_restrictive', area: 'food_quality', prompt: 'In the past year, how much have you cut out whole food groups or eaten far less than you needed?',
    options: [
      { label: 'Not at all', points: 0 },
      { label: 'Briefly', points: 1 },
      { label: 'For a few months', points: 2 },
      { label: 'Most of the year', points: 3 }
    ]
  },

  { id: 't_late_first', area: 'food_timing', prompt: 'How often is your first meal after 11 a.m., or skipped?', options: FREQUENCY, observable: 'late_first_meal' },
  { id: 't_long_gap', area: 'food_timing', prompt: 'How often do you go five hours or more awake without eating?', options: FREQUENCY },
  { id: 't_late_large', area: 'food_timing', prompt: 'How often is your biggest meal within two hours of bed?', options: FREQUENCY },
  {
    id: 't_caffeine', area: 'food_timing', prompt: 'How many drinks with caffeine do you usually have a day?', observable: 'caffeine_drinks',
    options: [
      { label: 'None or one', points: 0 },
      { label: 'Two', points: 1 },
      { label: 'Three', points: 2 },
      { label: 'Four or more', points: 3 }
    ]
  },

  { id: 'd_bloated', area: 'digestion', prompt: 'How often do you feel bloated or uncomfortably full after eating?', options: FREQUENCY },
  { id: 'd_irregular', area: 'digestion', prompt: 'How often are bathroom trips irregular or uncomfortable?', options: FREQUENCY },
  { id: 'd_heartburn', area: 'digestion', prompt: 'How often do you get heartburn or a burning feeling after meals?', options: FREQUENCY },
  {
    id: 'd_pain', area: 'digestion', prompt: 'How often do you have stomach pain or cramps?', options: FREQUENCY,
    flag: { minPoints: 2, message: 'Stomach pain or cramps that come back often are worth getting checked by a doctor.' }
  },

  { id: 's_too_much', area: 'life_load', prompt: 'How often does it feel like there is more to do than you can manage?', options: FREQUENCY },
  { id: 's_money', area: 'life_load', prompt: 'How often does money worry sit on your mind?', options: FREQUENCY },
  { id: 's_relationships', area: 'life_load', prompt: 'How often do your close relationships feel strained?', options: FREQUENCY },
  { id: 's_switch_off', area: 'life_load', prompt: 'How often do you find it hard to switch off in the evening?', options: FREQUENCY },
  { id: 's_stress_eating', area: 'life_load', prompt: 'How often does stress change how much you eat?', options: FREQUENCY },
  {
    id: 's_own_time', area: 'life_load', prompt: 'How often do you get time that is just for you?',
    options: [
      { label: 'Most days', points: 0 },
      { label: 'Often', points: 1 },
      { label: 'Sometimes', points: 2 },
      { label: 'Rarely', points: 3 }
    ]
  },

  { id: 'e_fumes', area: 'exposures', prompt: 'How often are you around smoke, strong fumes or chemicals at work, at home or travelling?', options: FREQUENCY },
  {
    id: 'e_tap_water', area: 'exposures', prompt: 'How much of the water you drink is unfiltered tap water?',
    options: [
      { label: 'Little or none', points: 0 },
      { label: 'Some', points: 1 },
      { label: 'Most', points: 2 },
      { label: 'Nearly all', points: 3 }
    ]
  },
  { id: 'e_microwave_meals', area: 'exposures', prompt: 'How often do you eat ready meals heated in their packaging?', options: FREQUENCY },
  {
    id: 'e_alcohol', area: 'exposures', prompt: 'How many alcoholic drinks do you have in a usual week?',
    options: [
      { label: 'None', points: 0 },
      { label: 'One to three', points: 1 },
      { label: 'Four to seven', points: 2 },
      { label: 'Eight or more', points: 3 }
    ]
  },
  {
    id: 'e_headaches', area: 'exposures', prompt: 'How often do you get headaches?', options: FREQUENCY,
    flag: { minPoints: 2, message: 'Headaches that come back often are worth getting checked by a doctor.' }
  },
  {
    id: 'e_skin', area: 'exposures', prompt: 'How often do you get skin reactions or rashes with no clear cause?', options: FREQUENCY,
    flag: { minPoints: 2, message: 'Skin reactions without a clear cause are worth having looked at by a doctor.' }
  },
  {
    id: 'e_foggy', area: 'exposures', prompt: 'How often do you feel foggy or forgetful?', options: FREQUENCY,
    flag: { minPoints: 3, message: 'Feeling foggy or forgetful most days is worth raising with a doctor.' }
  }
];
