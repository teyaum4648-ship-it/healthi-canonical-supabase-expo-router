-- RLS policies still determine which rows each signed-in user may access.
grant select, insert, update, delete on table
  public.profiles,
  public.assessment_sessions,
  public.assessment_answers,
  public.baseline_profiles,
  public.onboarding_plan_results,
  public.food_constraints,
  public.meal_logs,
  public.nutrition_targets,
  public.sleep_sessions,
  public.sleep_need_estimates,
  public.day_schedule_blocks,
  public.food_pattern_profiles,
  public.post_meal_response_logs,
  public.meal_log_items,
  public.user_food_products,
  public.exercise_library_items,
  public.workout_sessions,
  public.workout_exercise_entries
to authenticated;
