import type { CanonicalAnalyteId } from './labEvidenceTypes';

export type CanonicalAnalyte = {
  id: CanonicalAnalyteId;
  label: string;
  aliases: readonly string[];
  distinctFrom: readonly CanonicalAnalyteId[];
};

export const canonicalAnalytes: readonly CanonicalAnalyte[] = [
  { id: 'lead', label: 'Lead', aliases: ['lead', 'pb'], distinctFrom: [] },
  { id: 'cadmium', label: 'Cadmium', aliases: ['cadmium', 'cd'], distinctFrom: [] },
  { id: 'total_arsenic', label: 'Total arsenic', aliases: ['arsenic', 'total arsenic', 'as total'], distinctFrom: ['inorganic_arsenic'] },
  { id: 'inorganic_arsenic', label: 'Inorganic arsenic', aliases: ['inorganic arsenic', 'ias'], distinctFrom: ['total_arsenic'] },
  { id: 'mercury', label: 'Mercury', aliases: ['mercury', 'total mercury', 'hg'], distinctFrom: ['methylmercury'] },
  { id: 'methylmercury', label: 'Methylmercury', aliases: ['methylmercury', 'methyl mercury', 'mehg'], distinctFrom: ['mercury'] },
  { id: 'microplastics', label: 'Microplastics', aliases: ['microplastic', 'microplastics'], distinctFrom: [] },
  { id: 'other', label: 'Other analyte', aliases: [], distinctFrom: [] }
] as const;

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function canonicalAnalyteFor(value: string): CanonicalAnalyte {
  const candidate = normalized(value);
  return canonicalAnalytes.find((item) => item.aliases.some((alias) => normalized(alias) === candidate))
    ?? canonicalAnalytes[canonicalAnalytes.length - 1]!;
}
