import type { DataConfidence } from '../../../engines/nutrition';

export type LabEvidenceSourceType = 'independent_lab_test' | 'certification' | 'regulatory_alert' | 'manufacturer_coa' | 'category_study';
export type LabEvidenceMatchLevel = 'exact_lot' | 'exact_product' | 'exact_product_different_lot' | 'related_variant' | 'brand_only' | 'category_only';
export type LabSampleAcquisition = 'retail_purchased' | 'manufacturer_submitted' | 'unknown';

export type LabAnalyteResult = {
  analyte: string;
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
