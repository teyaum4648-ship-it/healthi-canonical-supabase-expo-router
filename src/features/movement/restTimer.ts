/**
 * Rest timer state, kept pure so it can be tested without fake timers and can
 * survive the screen being backgrounded.
 *
 * Remaining time is always derived from wall-clock timestamps rather than
 * counted down by an interval, so a timer started before the phone locked
 * still reads correctly when the app comes back.
 */

export type RestTimer = {
  exercise_id: string;
  set_id: string;
  /** Total rest asked for, after any adjustments. */
  duration_seconds: number;
  /** When the currently running stretch began; null while paused. */
  running_since: string | null;
  /** Seconds already elapsed in previous stretches, before the current one. */
  elapsed_before_pause: number;
};

export const REST_ADJUST_STEP_SECONDS = 15;
const MIN_DURATION = 0;
const MAX_DURATION = 60 * 30;

export function createRestTimer(
  exerciseId: string,
  setId: string,
  durationSeconds: number,
  now: string
): RestTimer {
  return {
    exercise_id: exerciseId,
    set_id: setId,
    duration_seconds: clampDuration(durationSeconds),
    running_since: now,
    elapsed_before_pause: 0
  };
}

function clampDuration(value: number): number {
  if (!Number.isFinite(value)) return 90;
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(value)));
}

export function restElapsedSeconds(timer: RestTimer, now: string): number {
  if (!timer.running_since) return timer.elapsed_before_pause;
  const started = new Date(timer.running_since).getTime();
  const current = new Date(now).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(current)) return timer.elapsed_before_pause;
  return timer.elapsed_before_pause + Math.max(0, (current - started) / 1000);
}

/** Negative once the timer has run past its target, so the UI can show overtime. */
export function restRemainingSeconds(timer: RestTimer, now: string): number {
  return Math.round(timer.duration_seconds - restElapsedSeconds(timer, now));
}

export function isRestComplete(timer: RestTimer, now: string): boolean {
  return restRemainingSeconds(timer, now) <= 0;
}

export function isRestPaused(timer: RestTimer): boolean {
  return timer.running_since === null;
}

export function pauseRestTimer(timer: RestTimer, now: string): RestTimer {
  if (!timer.running_since) return timer;
  return { ...timer, running_since: null, elapsed_before_pause: restElapsedSeconds(timer, now) };
}

export function resumeRestTimer(timer: RestTimer, now: string): RestTimer {
  if (timer.running_since) return timer;
  return { ...timer, running_since: now };
}

export function toggleRestTimer(timer: RestTimer, now: string): RestTimer {
  return isRestPaused(timer) ? resumeRestTimer(timer, now) : pauseRestTimer(timer, now);
}

/** Add or remove rest without losing time already served. */
export function adjustRestTimer(timer: RestTimer, deltaSeconds: number): RestTimer {
  return { ...timer, duration_seconds: clampDuration(timer.duration_seconds + deltaSeconds) };
}

export function formatRestClock(seconds: number): string {
  const overtime = seconds < 0;
  const total = Math.abs(Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainder = total % 60;
  return `${overtime ? '+' : ''}${minutes}:${String(remainder).padStart(2, '0')}`;
}
