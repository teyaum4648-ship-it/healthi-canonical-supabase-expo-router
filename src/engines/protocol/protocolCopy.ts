import type { ProtocolDayMode, ProtocolStatus } from './protocolTypes';

/**
 * Copy for the Daily Protocol. Calm, practical, premium tone — general
 * wellness guidance only. No guilt, no alarm, no diagnostic language.
 */

export function protocolHeadline(status: ProtocolStatus, mode: ProtocolDayMode): string {
  if (status === 'professional_guidance') return 'Keeping today gentle';
  if (status === 'limited') return 'An easy day by design';
  if (status === 'calibrating') return 'Still setting up your day';

  switch (mode) {
    case 'build':
      return 'A day to make one thing count';
    case 'correct':
      return 'A day to keep movement clean';
    case 'restore':
      return 'A recovery-led day';
    case 'maintain':
    default:
      return 'A steady, useful day';
  }
}

export function protocolSummary(status: ProtocolStatus, mode: ProtocolDayMode): string {
  if (status === 'professional_guidance') {
    return 'daywoven is holding stronger guidance until things feel settled. Today is about easy, supportive steps.';
  }
  if (status === 'limited') {
    return 'A few signals point to an easier day, so daywoven is keeping today light and practical.';
  }
  if (status === 'calibrating') {
    return 'daywoven is still learning your baseline. Here are a few steady steps while confidence builds.';
  }

  switch (mode) {
    case 'build':
      return 'Capacity looks supportive. Put your energy into one meaningful effort and keep the rest easy.';
    case 'correct':
      return 'Keep movement simple and well-controlled today, and let the supporting steps carry the rest.';
    case 'restore':
      return 'Lead with recovery rhythm, gentle movement, and steady fueling to set up a cleaner tomorrow.';
    case 'maintain':
    default:
      return 'A moderate, practical day. Keep the useful habits going without pushing for more.';
  }
}
