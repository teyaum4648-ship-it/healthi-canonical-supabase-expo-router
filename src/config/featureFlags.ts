export function featureEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}

export const featureFlags = Object.freeze({
  labEvidence: featureEnabled(process.env.EXPO_PUBLIC_LAB_EVIDENCE_ENABLED)
});
