import type { ProductQualityResultState } from './productLookupTypes';

export type PrimaryScannerState =
  | 'idle'
  | 'resolving_identity'
  | 'resolving_product_data'
  | 'product_available'
  | 'product_not_found'
  | 'provider_temporarily_unavailable'
  | 'product_data_insufficient'
  | 'product_quality_calculating'
  | 'product_quality_available'
  | 'product_quality_more_data_needed'
  | 'fatal_configuration_error';

export function derivePrimaryScannerState(params: {
  lookupState: PrimaryScannerState;
  hasProduct: boolean;
  qualityResultState?: ProductQualityResultState | null;
}): PrimaryScannerState {
  if (!params.hasProduct) return params.lookupState;
  if (!params.qualityResultState) return 'product_quality_calculating';
  if (params.qualityResultState === 'more_data_needed') return 'product_quality_more_data_needed';
  if (params.qualityResultState === 'identity_unresolved') return 'product_not_found';
  if (params.qualityResultState === 'provider_unavailable') return 'provider_temporarily_unavailable';
  return 'product_quality_available';
}

export function primaryScannerStateCopy(state: PrimaryScannerState): string {
  const copy: Record<PrimaryScannerState, string> = {
    idle: 'Scan a barcode or enter its numbers below.',
    resolving_identity: 'Checking the barcode identity…',
    resolving_product_data: 'Looking up available label data…',
    product_available: 'Product found. Calculating Product Quality…',
    product_not_found: 'No exact product was found for this barcode. You can still log it manually.',
    provider_temporarily_unavailable: 'Product data providers are temporarily unavailable. Your saved results remain available.',
    product_data_insufficient: 'The product was found, but essential label evidence is missing.',
    product_quality_calculating: 'Calculating Product Quality…',
    product_quality_available: 'Product Quality is ready.',
    product_quality_more_data_needed: 'Product found. More label data is needed for Product Quality.',
    fatal_configuration_error: 'Product lookup is not configured correctly in this build.'
  };
  return copy[state];
}
