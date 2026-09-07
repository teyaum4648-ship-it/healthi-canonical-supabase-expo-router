import type { ProductQualitySnapshot } from './productLookupTypes';

export type ProductQualityScorePresentation = {
  grade: string;
  scoreLine: string;
  stateLine: string;
  rangeLine: string | null;
  confidenceLine: string;
  gradeCertaintyLine: string | null;
  supportedDimensionsLine: string | null;
  contextLine: string | null;
};

function title(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
}

export function buildProductQualityScorePresentation(quality: ProductQualitySnapshot): ProductQualityScorePresentation {
  const state = quality.result_state ?? 'more_data_needed';
  const hasBoundedScore = state === 'final' || state === 'estimated' || state === 'provisional';
  const score = quality.score ?? quality.central_score ?? null;
  const gradeCertainty = quality.grade_certainty ?? null;
  const gradeUnresolved = gradeCertainty?.state === 'unresolved';
  const gradeNotStable = gradeCertainty !== null && gradeCertainty.state !== 'stable';
  const stateLabel = gradeNotStable
    ? 'Provisional'
    : state === 'final' ? 'Final' : state === 'estimated' ? 'Estimated' : state === 'provisional' ? 'Provisional' : 'More data needed';
  const scoreLine = hasBoundedScore && score !== null
    ? quality.score_scope === 'supported_evidence' ? `Supported-evidence score ${score}` : `Score ${score}`
    : 'More data needed';
  const range = quality.estimated_score_range;
  const grades = quality.estimated_grade_range;
  const supportedDimensions = (quality.dimensions ?? []).filter((dimension) => dimension.score !== null);
  return {
    grade: hasBoundedScore
      ? gradeUnresolved && quality.letter_grade ? `${quality.letter_grade}?` : quality.letter_grade ?? '—'
      : '—',
    scoreLine,
    stateLine: stateLabel,
    rangeLine: (state !== 'final' || gradeCertainty?.state !== 'stable') && range
      ? `Deterministic range ${range[0]}–${range[1]}${grades ? ` · Grades ${grades.join('–')}` : ''}`
      : null,
    confidenceLine: `Confidence: ${title(quality.confidence)}`,
    gradeCertaintyLine: gradeCertainty?.state === 'unresolved'
      ? `Grade uncertain: the supported range spans ${gradeCertainty.gradesSpanned[0]} through ${gradeCertainty.gradesSpanned.at(-1)}.`
      : gradeCertainty?.state === 'provisional'
        ? `Grade provisional: ${gradeCertainty.explanation}`
        : null,
    supportedDimensionsLine: hasBoundedScore && supportedDimensions.length > 0
      ? `Supported dimensions: ${supportedDimensions.map((dimension) => dimension.label).join(', ')}`
      : null,
    contextLine: hasBoundedScore && quality.score_scope === 'supported_evidence'
      ? 'This center summarizes supported dimensions only; missing material dimensions remain in the range.'
      : hasBoundedScore && quality.generalized_fallback_used
        ? 'Category-specific comparison is unavailable.'
        : null
  };
}
