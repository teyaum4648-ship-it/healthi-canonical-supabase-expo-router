import type { LabEvidenceRecord } from './labEvidenceTypes';

export type LabEvidenceLookupIdentity = {
  barcode: string;
  productName: string;
  brand: string | null;
  variant: string | null;
  lotNumber?: string | null;
};

export type LabEvidenceLookupResult =
  | { status: 'found'; records: LabEvidenceRecord[] }
  | { status: 'not_found'; records: [] }
  | { status: 'unavailable'; records: []; reason: 'not_configured' | 'temporarily_unavailable' };

export type LabEvidenceProvider = {
  id: string;
  lookup(identity: LabEvidenceLookupIdentity): Promise<LabEvidenceLookupResult>;
};

export const unavailableLabEvidenceProvider: LabEvidenceProvider = {
  id: 'unconfigured_lab_evidence',
  async lookup() {
    return { status: 'unavailable', records: [], reason: 'not_configured' };
  }
};

export function normalizeLabEvidenceRecord(record: LabEvidenceRecord): LabEvidenceRecord {
  return {
    ...record,
    productCode: record.productCode?.trim() || undefined,
    productName: record.productName.trim(),
    brand: record.brand.trim(),
    variant: record.variant?.trim() || undefined,
    lotNumber: record.lotNumber?.trim() || undefined,
    analytes: record.analytes.map((analyte) => ({ ...analyte, analyte: analyte.analyte.trim() }))
  };
}
