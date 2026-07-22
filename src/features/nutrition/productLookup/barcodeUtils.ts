export type BarcodeValidation =
  | { valid: true; barcode: string }
  | { valid: false; barcode: string; message: string };

export type BarcodeScanStamp = {
  barcode: string;
  scannedAt: number;
};

export function normalizeBarcode(value: string): string {
  return value.trim().replace(/[\s-]+/g, '');
}

export function canonicalBarcodeIdentity(value: string): string {
  const barcode = normalizeBarcode(value);
  if (barcode.length === 14 && barcode.startsWith('00')) return barcode.slice(2);
  if (barcode.length === 13 && barcode.startsWith('0')) return barcode.slice(1);
  return barcode;
}

export function barcodeLookupCandidates(value: string): string[] {
  const barcode = normalizeBarcode(value);
  if (!barcode) return [];

  const identity = canonicalBarcodeIdentity(barcode);
  const candidates = [barcode, identity];
  if (identity.length === 12) candidates.push(`0${identity}`, `00${identity}`);
  return [...new Set(candidates)];
}

export function validateBarcode(value: string): BarcodeValidation {
  const barcode = normalizeBarcode(value);

  if (!barcode) {
    return { valid: false, barcode, message: 'Enter a barcode to look up a product.' };
  }

  if (!/^\d+$/.test(barcode)) {
    return { valid: false, barcode, message: 'Use the numbers printed beneath the barcode.' };
  }

  if (barcode.length < 8 || barcode.length > 14) {
    return { valid: false, barcode, message: 'Enter a barcode between 8 and 14 digits.' };
  }

  return { valid: true, barcode };
}

export function shouldProcessBarcodeScan(
  previous: BarcodeScanStamp | null,
  nextBarcode: string,
  scannedAt: number,
  debounceMs = 2_000
): boolean {
  const next = normalizeBarcode(nextBarcode);
  if (!next) return false;
  if (!previous) return true;
  return previous.barcode !== next || scannedAt - previous.scannedAt >= debounceMs;
}
