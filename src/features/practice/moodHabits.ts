import { createScopedLogStore, isRecord } from './scopedLogStore';

/**
 * Things that reliably move mood, as a routine you assemble rather than a list you read.
 *
 * Modelled on the sleep wind-down: a library to pick from, a working set you keep, and a
 * tick per day. Two differences. Nothing is scheduled to a clock — a wind-down runs
 * backwards from bedtime, whereas these are done when there is a gap — and you can add
 * your own, because the seven or eight worth recommending are nowhere near the set of
 * things that work for one specific person. Somebody's ritual is not in any library.
 *
 * Each carries why it is on the list, and the honesty varies on purpose. "Text one
 * person" has better evidence behind it than anything else here. Sauna has an enthusiastic
 * literature and a thin one for mood specifically, and the copy says so. A routine built
 * out of overclaims is one a person abandons the first time it does not deliver.
 */

export type MoodHabit = {
  id: string;
  name: string;
  /** One line under the name. */
  detail: string;
  /** Why it is here. Hedged where the evidence is. */
  why: string;
  minutes: number;
  icon: string;
  /** Present on habits the person wrote themselves. */
  custom?: boolean;
  caution?: string;
};

export const HABIT_LIBRARY: MoodHabit[] = [
  {
    id: 'text_friend',
    name: 'Message one friend',
    detail: 'One person, by name, not a group',
    why: 'This has better evidence behind it than anything else on this list. Not "be more social" — one specific person, one message. The vagueness is what kills the intention, so the habit is deliberately narrow enough to finish in a minute.',
    minutes: 2,
    icon: 'chatbubble-outline'
  },
  {
    id: 'text_family',
    name: 'Call or message family',
    detail: 'The one you keep meaning to',
    why: 'Same mechanism as the above, and usually the harder of the two to start, which is why it is its own item rather than folded in. Whichever name came to mind while reading this is the one.',
    minutes: 5,
    icon: 'people-outline'
  },
  {
    id: 'walk_no_phone',
    name: 'Walk without your phone',
    detail: 'Ten minutes, nothing in your ears',
    why: 'A walk alone helps. A walk with no input is doing something different — it leaves room for the half-formed thought that has been waiting behind the podcast. Leaving the phone is the whole instruction.',
    minutes: 10,
    icon: 'walk-outline'
  },
  {
    id: 'journal',
    name: 'Journaling',
    detail: 'Fifteen minutes on what is actually bothering you',
    why: 'Writing continuously about something that is bothering you, without editing, is one of the better-supported things here. The effect seems to come from the writing being specific and unedited rather than tidy — so a neat list of bullet points is not the exercise.',
    minutes: 15,
    icon: 'create-outline'
  },
  {
    id: 'nsdr',
    name: 'NSDR / deep rest',
    detail: 'Lie still, twenty minutes, awake',
    why: 'Non-sleep deep rest: lying down and running attention slowly through the body without trying to fall asleep. Most useful after a bad night, when a nap would wreck tonight — it recovers something without touching your sleep pressure.',
    minutes: 20,
    icon: 'bed-outline'
  },
  {
    id: 'stretch',
    name: 'Stretch routine',
    detail: 'Where the tension actually is',
    why: 'The tension check on this tab picks the region and paces the movement to your breath. Five minutes, and it is the one habit here that has a specific target rather than being generally good for you.',
    minutes: 5,
    icon: 'body-outline'
  },
  {
    id: 'cold_shower',
    name: 'Cold shower',
    detail: 'Two minutes at the end of a normal one',
    why: 'Brief cold raises noradrenaline sharply, and the lift lasts well past the shower. It is stimulating, not calming — the same axis as the cyclic breathing rounds, and the wrong tool for a panicky evening. Good for a flat morning.',
    minutes: 3,
    icon: 'snow-outline',
    caution: 'Skip it if you have a heart condition or high blood pressure — the gasp reflex and the blood-pressure spike are real. Step in gradually rather than plunging.'
  },
  {
    id: 'sauna',
    name: 'Sauna or a long hot bath',
    detail: 'Fifteen to twenty minutes of real heat',
    why: 'Heat then cooling produces a strong rebound toward the calm side, and regular sauna use is associated with better cardiovascular outcomes in long-running observational work. For mood specifically the evidence is thinner than the enthusiasm around it — worth doing if you like it, not worth forcing.',
    minutes: 20,
    icon: 'flame-outline',
    caution: 'Drink water, never with alcohol, and get out when you want to rather than to hit a number. Not if you are pregnant or have a heart condition without asking a doctor first.'
  },
  {
    id: 'one_thing',
    name: 'Put one thing to bed',
    detail: 'The small task you keep stepping over',
    why: 'An unfinished small thing costs attention every time you notice it, and the cost is out of all proportion to the task. Finishing one is not productivity advice here — it is removing a thing that was quietly taxing you all week.',
    minutes: 15,
    icon: 'checkmark-done-outline'
  }
];

/** What a new person starts with: the two cheapest, and the one with the best evidence. */
export const DEFAULT_HABIT_IDS = ['text_friend', 'walk_no_phone', 'stretch'];

export function habitById(id: string, custom: MoodHabit[] = []): MoodHabit | null {
  return HABIT_LIBRARY.find((habit) => habit.id === id)
    ?? custom.find((habit) => habit.id === id)
    ?? null;
}

/** The routine, resolved from stored ids plus anything the person wrote. */
export function resolveRoutine(ids: string[], custom: MoodHabit[]): MoodHabit[] {
  return ids
    .map((id) => habitById(id, custom))
    .filter((habit): habit is MoodHabit => habit !== null);
}

/** What is still on offer — library minus what is already in the routine. */
export function availableHabits(ids: string[]): MoodHabit[] {
  return HABIT_LIBRARY.filter((habit) => !ids.includes(habit.id));
}

export const CUSTOM_HABIT_MAX_NAME = 48;

export function isUsableHabitName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= CUSTOM_HABIT_MAX_NAME;
}

/**
 * A habit the person wrote. The id is time-based rather than derived from the name, so
 * renaming one later cannot collide with an existing entry or orphan its completions.
 */
export function createCustomHabit(name: string, minutes: number, at: Date = new Date()): MoodHabit {
  return {
    id: `custom-${at.getTime()}`,
    name: name.trim().slice(0, CUSTOM_HABIT_MAX_NAME),
    detail: 'Your own',
    why: 'You added this one, so you already know why.',
    minutes,
    icon: 'star-outline',
    custom: true
  };
}

export type HabitCompletion = {
  id: string;
  date: string;
  habitId: string;
  completedAt: string;
};

export type HabitDay = {
  completedIds: string[];
  /** Of the routine, how many are done. */
  done: number;
  total: number;
};

export function summariseHabitDay(
  completions: HabitCompletion[],
  routine: MoodHabit[],
  date: string
): HabitDay {
  const completedIds = [
    ...new Set(completions.filter((row) => row.date === date).map((row) => row.habitId))
  ];
  return {
    completedIds,
    /* Only routine items count toward the total, so removing a habit cannot leave the
       day reading 4 of 3. */
    done: routine.filter((habit) => completedIds.includes(habit.id)).length,
    total: routine.length
  };
}

export function habitDayLine(day: HabitDay): string {
  if (day.total === 0) return 'No habits in your routine yet.';
  if (day.done === 0) return `None of your ${day.total} done yet today.`;
  if (day.done === day.total) return `All ${day.total} done today.`;
  return `${day.done} of ${day.total} done today.`;
}

function isCompletion(value: unknown): value is HabitCompletion {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.date === 'string'
    && typeof value.habitId === 'string'
    && typeof value.completedAt === 'string';
}

function isHabit(value: unknown): value is MoodHabit {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.detail === 'string'
    && typeof value.why === 'string'
    && typeof value.minutes === 'number'
    && typeof value.icon === 'string';
}

function isRoutineRow(value: unknown): value is { id: string; habitIds: string[] } {
  return isRecord(value) && typeof value.id === 'string' && Array.isArray(value.habitIds);
}

export const localHabitCompletionStore = createScopedLogStore<HabitCompletion>({
  key: 'healthi:practice:habits:completions:v1',
  isRow: isCompletion
});

export const localCustomHabitStore = createScopedLogStore<MoodHabit>({
  key: 'healthi:practice:habits:custom:v1',
  isRow: isHabit,
  cap: 60
});

/**
 * The routine is a single row that gets replaced rather than appended to, which the
 * scoped log supports via `replace`. Using the same store keeps one storage shape
 * instead of introducing a second one for a single list of ids.
 */
export const localRoutineStore = createScopedLogStore<{ id: string; habitIds: string[] }>({
  key: 'healthi:practice:habits:routine:v1',
  isRow: isRoutineRow,
  cap: 1
});
