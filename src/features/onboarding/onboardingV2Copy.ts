import type { OnboardingV2Domain, OnboardingV2PrimaryFocus } from './onboardingV2Types';

export const onboardingV2Welcome =
  'Healthi learns from your rhythm, nourishment, movement, and schedule so it can guide your day.';

export const onboardingV2DomainLabels: Record<OnboardingV2Domain, string> = {
  recovery_rhythm: 'Recovery rhythm',
  nourishment: 'Nourishment',
  movement_capacity: 'Movement capacity',
  mind_life_load: 'Mind and life load'
};

export const onboardingV2FocusLabels: Record<OnboardingV2PrimaryFocus, string> = {
  ...onboardingV2DomainLabels,
  balanced: 'Balanced starting point'
};
