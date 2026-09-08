import type { DataConfidence } from '../../types/common';
import { protocolHeadline, protocolSummary } from './protocolCopy';
import type {
  DailyProtocol,
  DailyProtocolAction,
  GenerateDailyProtocolInput,
  ProtocolDayMode,
  ProtocolPrimaryFocus,
  ProtocolStatus
} from './protocolTypes';

const PRIORITY_RANK: Record<DailyProtocolAction['priority'], number> = { high: 0, medium: 1, low: 2 };

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

type ActionSeed = Omit<DailyProtocolAction, 'status'>;

function seed(action: ActionSeed): DailyProtocolAction {
  return { ...action, status: 'pending', reason_codes: unique(action.reason_codes) };
}

function combineConfidence(list: DataConfidence[]): DataConfidence {
  if (list.length === 0) return 'low';
  if (list.includes('low')) return 'low';
  if (list.every((value) => value === 'high')) return 'high';
  return 'medium';
}

function isConfidence(value: unknown): value is DataConfidence {
  return value === 'low' || value === 'medium' || value === 'high';
}

/**
 * Deterministic daily protocol generator. Turns available readiness, rhythm,
 * nourishment, movement, schedule, and baseline signals — reviewed first by the
 * Safety Engine — into 3–5 practical daily actions. Never uses medical,
 * diagnostic, or diet-culture language; missing data lowers confidence and
 * produces honest calibration copy rather than pushing the user.
 */
export function generateDailyProtocol(input: GenerateDailyProtocolInput): DailyProtocol {
  const date = input.date.slice(0, 10);
  const safety = input.safety;
  const safetyProfessional = safety?.status === 'professional_guidance';
  const trainingAllowed = safety ? safety.training_allowed : true;
  const progressionAllowed = safety ? safety.progression_allowed : true;

  const requestedMode: ProtocolDayMode =
    input.readiness?.day_mode ?? input.baseline?.baseline_mode ?? 'maintain';
  const dayMode: ProtocolDayMode = safetyProfessional ? 'professional_guidance' : requestedMode;

  const primaryFocus: ProtocolPrimaryFocus =
    input.readiness?.primary_focus ?? input.baseline?.primary_focus ?? 'balanced';

  // ── Data presence + missing-data honesty ───────────────────────────────────
  const present = {
    readiness:
      input.readiness != null &&
      (typeof input.readiness.score === 'number' ||
        Boolean(input.readiness.label) ||
        Boolean(input.readiness.day_mode)),
    circadian:
      input.circadian != null &&
      (Boolean(input.circadian.current_phase) ||
        Boolean(input.circadian.wind_down_start) ||
        Boolean(input.circadian.caffeine_cutoff) ||
        typeof input.circadian.sleep_debt_minutes === 'number'),
    nourishment:
      input.nourishment != null &&
      (Boolean(input.nourishment.nutrition_readiness_label) ||
        input.nourishment.hydration_low != null ||
        input.nourishment.under_fueled != null ||
        input.nourishment.digestion_off != null),
    movement:
      input.movement != null &&
      (Boolean(input.movement.movement_readiness_label) ||
        input.movement.pain_present != null ||
        typeof input.movement.soreness_level === 'number'),
    schedule:
      input.schedule != null &&
      (typeof input.schedule.open_windows_count === 'number' ||
        typeof input.schedule.protected_blocks_count === 'number' ||
        Boolean(input.schedule.day_load_label)),
    baseline:
      input.baseline != null && (Boolean(input.baseline.baseline_mode) || Boolean(input.baseline.primary_focus))
  };
  const missingData = Object.entries(present)
    .filter(([, value]) => !value)
    .map(([key]) => key);
  const presentCount = Object.values(present).filter(Boolean).length;

  const providedConfidence = [
    input.baseline?.confidence,
    input.readiness?.confidence,
    input.circadian?.confidence,
    safety?.confidence
  ].filter(isConfidence);
  let confidence = combineConfidence(providedConfidence);
  if (presentCount <= 2) confidence = 'low';

  // ── Status ─────────────────────────────────────────────────────────────────
  let status: ProtocolStatus;
  if (safetyProfessional) {
    status = 'professional_guidance';
  } else if (safety && (safety.status === 'limit_guidance' || !trainingAllowed)) {
    status = 'limited';
  } else if (confidence === 'low' || presentCount <= 2) {
    status = 'calibrating';
  } else {
    status = 'ready';
  }

  const reasonCodes: string[] = [
    `day_mode_${dayMode}`,
    `protocol_status_${status}`,
    `primary_focus_${primaryFocus}`
  ];
  if (safety) reasonCodes.push(`safety_${safety.status}`);
  if (missingData.length > 0) reasonCodes.push('missing_signals');

  const safetyBlock = {
    status: safety?.status ?? ('clear' as const),
    summary: safety?.summary ?? 'No safety concerns from available signals.',
    training_allowed: trainingAllowed,
    progression_allowed: progressionAllowed
  };

  // ── Professional guidance short-circuit ────────────────────────────────────
  if (status === 'professional_guidance') {
    const actions: DailyProtocolAction[] = [
      seed({
        id: 'protocol_hydration',
        title: 'Hydrate steadily',
        detail: 'Keep water within reach and sip through the day.',
        domain: 'nourishment',
        kind: 'hydration',
        priority: 'medium',
        reason_codes: ['professional_guidance']
      }),
      seed({
        id: 'protocol_meal',
        title: 'Keep meals familiar',
        detail: 'Choose a familiar, comfortable meal that usually sits well.',
        domain: 'nourishment',
        kind: 'meal',
        priority: 'medium',
        reason_codes: ['professional_guidance']
      }),
      seed({
        id: 'protocol_wind_down',
        title: 'Protect a calm wind-down',
        detail: 'Give yourself an unhurried, restful evening.',
        domain: 'recovery_rhythm',
        kind: 'wind_down',
        priority: 'medium',
        reason_codes: ['professional_guidance'],
        time_hint: input.circadian?.wind_down_start ?? null
      }),
      seed({
        id: 'protocol_reflection',
        title: 'Take a few slow breaths',
        detail: 'A short, slow breathing reset can help the body settle.',
        domain: 'mind_life_load',
        kind: 'reflection',
        priority: 'low',
        reason_codes: ['professional_guidance']
      })
    ];
    return {
      id: `protocol_${date}`,
      date,
      status,
      day_mode: dayMode,
      primary_focus: primaryFocus,
      confidence: safety?.confidence ?? 'medium',
      headline: protocolHeadline(status, dayMode),
      summary: protocolSummary(status, dayMode),
      actions,
      safety: safetyBlock,
      reason_codes: unique([...reasonCodes, 'professional_guidance']),
      missing_data: missingData
    };
  }

  // ── Build candidate actions ────────────────────────────────────────────────
  const candidates: DailyProtocolAction[] = [];
  const modeReason = `day_mode_${dayMode}`;
  const movementWindow = input.circadian?.best_movement_window ?? null;

  // Movement / restore
  if (!trainingAllowed) {
    candidates.push(
      seed({
        id: 'protocol_restore',
        title: 'Favor gentle movement',
        detail: 'Easy movement or rest today — nothing that pushes.',
        domain: 'movement_capacity',
        kind: 'restore',
        priority: 'high',
        reason_codes: ['movement_limited_by_safety', modeReason],
        time_hint: null
      })
    );
  } else if (dayMode === 'build' && progressionAllowed && confidence !== 'low') {
    candidates.push(
      seed({
        id: 'protocol_movement_strong',
        title: 'Make one session count',
        detail: 'Capacity looks supportive — put real effort into one focused session.',
        domain: 'movement_capacity',
        kind: 'movement',
        priority: 'high',
        reason_codes: ['build_stronger_movement', modeReason],
        time_hint: movementWindow
      })
    );
  } else if (dayMode === 'restore') {
    candidates.push(
      seed({
        id: 'protocol_restore',
        title: 'Keep movement gentle',
        detail: 'Light, comfortable movement is plenty today.',
        domain: 'movement_capacity',
        kind: 'restore',
        priority: 'medium',
        reason_codes: ['restore_gentle_movement', modeReason],
        time_hint: null
      })
    );
  } else if (dayMode === 'correct') {
    candidates.push(
      seed({
        id: 'protocol_movement_simple',
        title: 'Keep movement simple and clean',
        detail: 'Focus on quality and control rather than adding more.',
        domain: 'movement_capacity',
        kind: 'movement',
        priority: 'medium',
        reason_codes: ['correct_simple_movement', modeReason],
        time_hint: movementWindow
      })
    );
  } else {
    candidates.push(
      seed({
        id: 'protocol_movement_simple',
        title: 'A steady, useful session',
        detail: 'Keep a moderate, practical session — no need to push for more.',
        domain: 'movement_capacity',
        kind: 'movement',
        priority: 'medium',
        reason_codes: ['maintain_moderate_movement', modeReason],
        time_hint: movementWindow
      })
    );
  }

  // Walk (light movement)
  candidates.push(
    seed({
      id: 'protocol_walk',
      title: 'Fit in an easy walk',
      detail: 'A short outdoor walk supports energy and recovery rhythm.',
      domain: 'movement_capacity',
      kind: 'walk',
      priority: dayMode === 'restore' ? 'medium' : 'low',
      reason_codes: ['light_movement_supports_rhythm']
    })
  );

  // Hydration
  const hydrationLow = input.nourishment?.hydration_low === true;
  candidates.push(
    seed({
      id: 'protocol_hydration',
      title: hydrationLow ? 'Catch up on hydration' : 'Hydrate steadily',
      detail: 'Keep water within reach and sip through the day.',
      domain: 'nourishment',
      kind: 'hydration',
      priority: hydrationLow ? 'high' : 'low',
      reason_codes: hydrationLow ? ['hydration_low'] : ['hydration_supports_energy']
    })
  );

  // Meal
  const underFueled = input.nourishment?.under_fueled === true;
  const digestionOff = input.nourishment?.digestion_off === true;
  if (underFueled) {
    candidates.push(
      seed({
        id: 'protocol_meal',
        title: 'Add a steadier, fuller meal',
        detail: 'A balanced, satisfying meal helps energy hold through the day.',
        domain: 'nourishment',
        kind: 'meal',
        priority: 'high',
        reason_codes: ['under_fueled']
      })
    );
  } else if (digestionOff) {
    candidates.push(
      seed({
        id: 'protocol_meal',
        title: 'Keep the next meal simple',
        detail: 'Choose a familiar, easy-to-digest meal that usually sits well.',
        domain: 'nourishment',
        kind: 'meal',
        priority: 'medium',
        reason_codes: ['digestion_off']
      })
    );
  } else {
    candidates.push(
      seed({
        id: 'protocol_meal',
        title: 'Keep meals steady',
        detail: 'Aim for balanced, familiar meals across the day.',
        domain: 'nourishment',
        kind: 'meal',
        priority: 'low',
        reason_codes: ['steady_fueling']
      })
    );
  }

  // Wind-down
  const sleepDebt =
    typeof input.circadian?.sleep_debt_minutes === 'number' ? input.circadian.sleep_debt_minutes : null;
  const rhythmFocus =
    (sleepDebt != null && sleepDebt >= 120) || dayMode === 'restore' || primaryFocus === 'recovery_rhythm';
  candidates.push(
    seed({
      id: 'protocol_wind_down',
      title: 'Protect a calm wind-down',
      detail: input.circadian?.wind_down_start
        ? 'Ease into wind-down and keep the last hour unhurried.'
        : 'Give yourself an unhurried wind-down before bed.',
      domain: 'recovery_rhythm',
      kind: 'wind_down',
      priority: rhythmFocus ? 'high' : 'medium',
      reason_codes: rhythmFocus ? ['recovery_rhythm_focus'] : ['wind_down_supports_sleep'],
      time_hint: input.circadian?.wind_down_start ?? null
    })
  );

  // Caffeine cutoff
  if (input.circadian?.caffeine_cutoff) {
    candidates.push(
      seed({
        id: 'protocol_caffeine_cutoff',
        title: 'Hold caffeine after your cutoff',
        detail: 'Keeping caffeine before the cutoff supports tonight’s sleep.',
        domain: 'recovery_rhythm',
        kind: 'caffeine_cutoff',
        priority: 'low',
        reason_codes: ['caffeine_cutoff_supports_sleep'],
        time_hint: input.circadian.caffeine_cutoff
      })
    );
  }

  // Reflection / reset
  if (dayMode === 'restore' || status === 'limited' || primaryFocus === 'mind_life_load') {
    candidates.push(
      seed({
        id: 'protocol_reflection',
        title: 'Take a short reset',
        detail: 'A few slow breaths or a quiet moment can ease life load.',
        domain: 'mind_life_load',
        kind: 'reflection',
        priority: primaryFocus === 'mind_life_load' ? 'medium' : 'low',
        reason_codes: ['mind_life_load_reset']
      })
    );
  }

  // Schedule
  const openWindows =
    typeof input.schedule?.open_windows_count === 'number' ? input.schedule.open_windows_count : null;
  if (openWindows != null && openWindows > 0) {
    candidates.push(
      seed({
        id: 'protocol_schedule',
        title: 'Protect one open window',
        detail: 'Guard a single open window for the step that matters most.',
        domain: 'mind_life_load',
        kind: 'schedule',
        priority: 'low',
        reason_codes: ['open_window_available']
      })
    );
  }

  // ── Dedupe, order by priority, cap at 5, guarantee at least 3 ──────────────
  const byId = new Map<string, DailyProtocolAction>();
  for (const candidate of candidates) {
    if (!byId.has(candidate.id)) byId.set(candidate.id, candidate);
  }
  const ordered = [...byId.values()].sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const actions = ordered.slice(0, 5);

  return {
    id: `protocol_${date}`,
    date,
    status,
    day_mode: dayMode,
    primary_focus: primaryFocus,
    confidence,
    headline: protocolHeadline(status, dayMode),
    summary: protocolSummary(status, dayMode),
    actions,
    safety: safetyBlock,
    reason_codes: unique(reasonCodes),
    missing_data: missingData
  };
}
