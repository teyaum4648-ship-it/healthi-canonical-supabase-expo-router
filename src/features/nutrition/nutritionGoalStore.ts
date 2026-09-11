import { estimateNutritionGoals, parseGoalSetup, type GoalAnswers, type GoalSetup } from './nutritionGoalEngine';
export const demoGoalKey = 'healthi:demo:nutrition:goalSetup';
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void> };
export type GoalClient = {
  from(table: 'nutrition_targets'): { select(columns: string): GoalQuery };
  rpc(name: 'save_nutrition_goal_setup', args: { setup: GoalSetup }): PromiseLike<{ data: unknown; error: unknown }>;
};
type GoalQuery = { eq(column: string, value: string | boolean): GoalQuery; limit(count: number): PromiseLike<{ data: Array<{ goal_setup?: unknown }> | null; error: unknown }> };
export async function readGoalSetup(userId: string | null, demo: boolean, client: GoalClient | null, storage: Storage) {
  if (demo) {
    const raw = await storage.getItem(demoGoalKey);
    if (!raw) return null;
    const parsed = parseGoalSetup(JSON.parse(raw));
    if (!parsed) throw new Error('Saved goals need to be reviewed.');
    return parsed;
  }
  if (!userId || userId === 'demo-user' || !client) throw new Error('Sign in to load your goals.');
  const { data, error } = await client.from('nutrition_targets').select('goal_setup').eq('user_id', userId).eq('is_active', true).limit(1);
  if (error) throw new Error('Your goals could not load. Try again before setting new goals.');
  const value = data?.[0]?.goal_setup;
  if (value == null) return null;
  const parsed = parseGoalSetup(value);
  if (!parsed) throw new Error('Saved goals need to be reviewed.');
  return parsed;
}
export async function saveGoalSetup(answers: GoalAnswers, userId: string | null, demo: boolean, client: GoalClient | null, storage: Storage) {
  const setup = estimateNutritionGoals(answers);
  if (demo) { await storage.setItem(demoGoalKey, JSON.stringify(setup)); return setup; }
  if (!userId || userId === 'demo-user' || !client) throw new Error('Sign in to save your goals.');
  const { error } = await client.rpc('save_nutrition_goal_setup', { setup });
  if (error) throw new Error('Goals could not be saved. Your previous goals are unchanged.');
  return setup;
}
