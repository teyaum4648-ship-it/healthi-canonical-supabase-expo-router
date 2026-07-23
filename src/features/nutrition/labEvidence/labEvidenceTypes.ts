import type { DataConfidence } from '../../../engines/nutrition';

export type LabEvidenceSourceType = 'independent_lab_test' | 'certification' | 'regulatory_alert' | 'manufacturer_coa' | 'category_study';
export type LabEvidenceMatchLevel = 'exact_lot' | 'exact_product' | 'exact_product_different_lot' | 'related_variant' | 'brand_only' | 'category_only';
export type LabSampleAcquisition = 'retail_purchased' | 'manufacturer_submitted' | 'unknown';
export type LabEvidenceResolutionStatus =
  | 'exact_lot'
  | 'exact_product'
  | 'manufacturer_coa'
  | 'current_certification'
  | 'regulatory_alert'
  | 'related_variant'
  | 'brand_evidence'
  | 'category_context'
  | 'no_evidence'
  | 'unavailable'
  | 'identity_unresolved';
export type LabEvidenceCoverageLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type LabEvidenceConfidence = DataConfidence;
export type LabEvidenceFreshness = 'current' | 'aging' | 'expired' | 'revoked' | 'unknown';
export type EvidenceProvenance = 'independent' | 'manufacturer_provided' | 'certification_body' | 'regulator' | 'research';
export type CanonicalAnalyteId =
  | 'lead'
  | 'cadmium'
  | 'total_arsenic'
  | 'inorganic_arsenic'
  | 'mercury'
  | 'methylmercury'
  | 'microplastics'
  | 'other';

export type LabAnalyteResult = {
  analyte: string;
  canonicalAnalyteId?: CanonicalAnalyteId;
  measuredValue?: number;
  unit?: string;
  reportingLimit?: number;
  status: 'detected' | 'below_reporting_limit' | 'above_reference' | 'not_reported';
  comparisonThreshold?: number;
  thresholdUnit?: string;
  thresholdAuthority?: string;
  note?: string;
};

export type LabEvidenceRecord = {
  id: string;
  productCode?: string;
  productName: string;
  brand: string;
  variant?: string;
  lotNumber?: string;
  sourceName: string;
  sourceType: LabEvidenceSourceType;
  laboratory?: string;
  laboratoryAccreditation?: string;
  testingMethod?: string;
  sampleDate?: string;
  publicationDate?: string;
  matchLevel: LabEvidenceMatchLevel;
  sampleAcquisition?: LabSampleAcquisition;
  analytes: LabAnalyteResult[];
  sourceReference?: string;
  evidenceConfidence: DataConfidence;
};

export type LabEvidenceIdentity = {
  barcode: string;
  canonicalBarcode: string | null;
  productName: string;
  brand: string | null;
  variant: string | null;
  size: string | null;
  market: string | null;
  country: string | null;
  lotNumber: string | null;
  productionDate: string | null;
  categoryKeys: string[];
};

export type SafeLabEvidenceSummary = {
  evidenceId: string;
  sourceName: string;
  sourceType: 'independent_lab_test' | 'manufacturer_coa';
  provenance: 'independent' | 'manufacturer_provided';
  matchLevel: Extract<LabEvidenceMatchLevel, 'exact_lot' | 'exact_product' | 'exact_product_different_lot'>;
  matchReason: string;
  sampleDate: string | null;
  publicationDate: string | null;
  freshness: LabEvidenceFreshness;
  laboratory: string | null;
  laboratoryAccreditation: string | null;
  testingMethod: string | null;
  sampleAcquisition: LabSampleAcquisition;
  analytes: LabAnalyteResult[];
  confidence: LabEvidenceConfidence;
};

export type SafeCertificationSummary = {
  certificationId: string;
  certificationName: string;
  certifyingBody: string;
  scope: 'product' | 'facility' | 'brand';
  matchReason: string;
  validFrom: string | null;
  validUntil: string | null;
  freshness: LabEvidenceFreshness;
  confidence: LabEvidenceConfidence;
};

export type SafeRegulatoryAlertSummary = {
  alertId: string;
  authority: string;
  title: string;
  status: 'active' | 'resolved' | 'unknown';
  matchLevel: 'exact_lot' | 'exact_product' | 'related_variant';
  matchReason: string;
  publishedAt: string | null;
  sourceUrl: string | null;
  confidence: LabEvidenceConfidence;
};

export type SafeEvidenceContextSummary = {
  contextId: string;
  title: string;
  sourceName: string;
  scope: 'related_variant' | 'brand' | 'category';
  matchReason: string;
  summary: string;
  publicationDate: string | null;
  confidence: LabEvidenceConfidence;
};

export type LabEvidenceResolution = {
  schemaVersion: 2;
  status: LabEvidenceResolutionStatus;
  identity: LabEvidenceIdentity;
  confidence: LabEvidenceConfidence;
  reasonCodes: string[];
  sourcesChecked: string[];
  resolvedAt: string;
  refreshAfter: string | null;
  retryable: boolean;
  availabilityReason: 'not_configured' | 'temporarily_unavailable' | 'rights_expired' | 'source_disabled' | null;
  labEvidence: SafeLabEvidenceSummary[];
  certifications: SafeCertificationSummary[];
  regulatoryAlerts: SafeRegulatoryAlertSummary[];
  relatedEvidence: SafeEvidenceContextSummary[];
  categoryContext: SafeEvidenceContextSummary[];
};

export type InternalLabEvidenceResolution = LabEvidenceResolution & {
  coverageLevel: LabEvidenceCoverageLevel;
};

export type LabEvidenceReferenceSnapshot = {
  schemaVersion: 2;
  status: LabEvidenceResolutionStatus;
  evidenceIds: string[];
  certificationIds: string[];
  regulatoryAlertIds: string[];
  contextIds: string[];
  resolvedAt: string;
  refreshAfter: string | null;
};
