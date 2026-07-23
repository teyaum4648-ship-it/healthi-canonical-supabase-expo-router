import type { LabEvidenceResolution } from './labEvidenceTypes';
import type { LabEvidenceLookupIdentity } from './labEvidenceProvider';

export type ResolutionProviderResult =
  | { status: 'resolved'; resolution: LabEvidenceResolution }
  | { status: 'not_found' }
  | { status: 'unavailable'; reason: 'not_configured' | 'temporarily_unavailable' | 'rights_expired' | 'source_disabled' };

export type ResolutionProvider = {
  id: string;
  enabled: boolean;
  lookup(identity: LabEvidenceLookupIdentity): Promise<ResolutionProviderResult>;
};

export function disabledResolutionProvider(id: string): ResolutionProvider {
  return {
    id,
    enabled: false,
    async lookup() {
      return { status: 'unavailable', reason: 'not_configured' };
    }
  };
}

export const futureLabEvidenceProviders = {
  consumerLab: disabledResolutionProvider('consumerlab'),
  cleanLabelProject: disabledResolutionProvider('clean_label_project'),
  nsf: disabledResolutionProvider('nsf'),
  usp: disabledResolutionProvider('usp'),
  manufacturerCoa: disabledResolutionProvider('manufacturer_coa'),
  independentLabs: disabledResolutionProvider('independent_labs')
} as const;
