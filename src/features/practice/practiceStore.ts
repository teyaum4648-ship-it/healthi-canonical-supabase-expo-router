import { createScopedLogStore, isRecord } from './scopedLogStore';
import type { PracticeSession } from './practiceModel';

/** Local persistence for breathing sessions. */

function isSession(value: unknown): value is PracticeSession {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.date === 'string'
    && typeof value.rhythmId === 'string'
    && typeof value.seconds === 'number'
    && typeof value.finishedAt === 'string';
}

export const localPracticeStore = createScopedLogStore<PracticeSession>({
  key: 'healthi:practice:breath:v1',
  isRow: isSession
});
