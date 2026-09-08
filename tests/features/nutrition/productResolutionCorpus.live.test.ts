import { describe, expect, it } from 'vitest';

import { resolveProductData } from '../../../supabase/functions/_shared/productDataResolver';
import { calculateProductQuality } from '../../../src/features/nutrition/productLookup/productQuality';
import type { HealthiProductSnapshot } from '../../../src/features/nutrition/productLookup/productLookupTypes';

const corpus = [
  '052159531003', '052159531010', '016000275287', '016000275270', '013764027053',
  '013764027220', '037600105064', '048001006430', '048500301029', '048500301395',
  '042272005833', '042272005147', '888849000272', '888849000302', '041331024792',
  '041331123327', '016000264694', '016000450769', '042272001620', '042272001033'
] as const;

const runLiveCorpus = process.env.HEALTHI_LIVE_PRODUCT_CORPUS === '1';
const usdaApiKey = process.env.USDA_FDC_API_KEY?.trim() || null;
const requestedBarcodes = new Set(
  (process.env.HEALTHI_LIVE_PRODUCT_FILTER ?? '')
    .split(',')
    .map((value: string) => value.trim())
    .filter(Boolean)
);
const activeCorpus = requestedBarcodes.size > 0
  ? corpus.filter((barcode) => requestedBarcodes.has(barcode))
  : [...corpus];

describe.skipIf(!runLiveCorpus)('live exact-GTIN product-resolution regression corpus', () => {
  it('records every terminal state through the canonical exhaustion trace', async () => {
    if (!usdaApiKey) {
      throw new Error('USDA_FDC_API_KEY must be supplied to the server-only live acceptance harness.');
    }
    if (activeCorpus.length === 0) {
      throw new Error('HEALTHI_LIVE_PRODUCT_FILTER did not match any acceptance-corpus barcode.');
    }

    const rows: Array<Record<string, unknown>> = [];
    for (const barcode of activeCorpus) {
      const startedAt = Date.now();
      const resolution = await resolveProductData({ barcode, timeoutMs: 8_000, usdaApiKey });
      const durationMs = Date.now() - startedAt;
      const sourceBRecord = resolution.sources.find((source) => source.provider === 'usda_food_data_central');
      const trace = resolution.trace;
      if (resolution.status === 'resolved') {
        const quality = calculateProductQuality(resolution.product as unknown as HealthiProductSnapshot);
        rows.push({
          barcode,
          name: resolution.product.name,
          duration_ms: durationMs,
          source_a: trace?.source_a.result,
          source_a_attempts: trace?.source_a.attempt_count,
          source_a_http: trace?.source_a.http_statuses ?? [],
          source_a_failure: trace?.source_a.failure_reason,
          source_a_evidence_level: trace?.sufficiency_before_source_b?.level ?? null,
          source_a_supports_bounded_interpretation: trace?.sufficiency_before_source_b?.supports_bounded_interpretation ?? false,
          source_b_reason: trace?.source_b.invocation_reason,
          source_b: trace?.source_b.result,
          source_b_attempts: trace?.source_b.attempt_count,
          source_b_http: trace?.source_b.http_statuses ?? [],
          source_b_failure: trace?.source_b.failure_reason,
          source_b_record_id: sourceBRecord?.record_id ?? null,
          source_b_exact_gtin_match: trace?.source_b.result === 'found' && trace.merge.exact_identity_compatible,
          fields_selected_from_a: trace?.merge.selected_fields.open_food_facts ?? [],
          fields_rejected_from_a: trace?.merge.rejected_fields.open_food_facts ?? [],
          fields_selected_from_b: trace?.merge.selected_fields.usda_food_data_central ?? [],
          fields_rejected_from_b: trace?.merge.rejected_fields.usda_food_data_central ?? [],
          recovered_fields: trace?.source_b.selected_fields ?? [],
          conflicts: trace?.merge.conflicts ?? [],
          evidence_level: trace?.sufficiency_after_source_b?.level,
          supported_evidence_domains: trace?.sufficiency_after_source_b?.supported_evidence_domains ?? [],
          unsupported_evidence_domains: trace?.sufficiency_after_source_b?.unsupported_evidence_domains ?? [],
          evidence_reasons: trace?.sufficiency_after_source_b?.reasons ?? [],
          terminal_state: quality.result_state,
          score: quality.central_score,
          public_score: quality.score,
          grade: quality.letter_grade,
          score_range: quality.estimated_score_range ?? null,
          supported_dimensions: quality.review_trace?.product_resolution?.supported_dimensions ?? [],
          unsupported_dimensions: quality.review_trace?.product_resolution?.unsupported_dimensions ?? [],
          abstention_reason: quality.review_trace?.product_resolution?.abstention_reason
            ?? trace?.abstention_reason
            ?? null
        });
      } else {
        rows.push({
          barcode,
          name: null,
          duration_ms: durationMs,
          source_a: trace?.source_a.result,
          source_a_attempts: trace?.source_a.attempt_count,
          source_a_http: trace?.source_a.http_statuses ?? [],
          source_a_failure: trace?.source_a.failure_reason,
          source_a_evidence_level: trace?.sufficiency_before_source_b?.level ?? null,
          source_a_supports_bounded_interpretation: trace?.sufficiency_before_source_b?.supports_bounded_interpretation ?? false,
          source_b_reason: trace?.source_b.invocation_reason,
          source_b: trace?.source_b.result,
          source_b_attempts: trace?.source_b.attempt_count,
          source_b_http: trace?.source_b.http_statuses ?? [],
          source_b_failure: trace?.source_b.failure_reason,
          source_b_record_id: sourceBRecord?.record_id ?? null,
          source_b_exact_gtin_match: trace?.source_b.result === 'found' && trace.merge.exact_identity_compatible,
          fields_selected_from_a: trace?.merge.selected_fields.open_food_facts ?? [],
          fields_rejected_from_a: trace?.merge.rejected_fields.open_food_facts ?? [],
          fields_selected_from_b: trace?.merge.selected_fields.usda_food_data_central ?? [],
          fields_rejected_from_b: trace?.merge.rejected_fields.usda_food_data_central ?? [],
          recovered_fields: [],
          conflicts: trace?.merge.conflicts ?? [],
          evidence_level: 'abstain',
          supported_evidence_domains: [],
          unsupported_evidence_domains: ['identity', 'ingredients', 'nutrition', 'serving', 'category_context'],
          evidence_reasons: [],
          terminal_state: resolution.status,
          score: null,
          public_score: null,
          grade: null,
          score_range: null,
          supported_dimensions: [],
          unsupported_dimensions: [],
          abstention_reason: trace?.abstention_reason ?? resolution.message
        });
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }

    console.info(`HEALTHI_PRODUCT_RESOLUTION_CORPUS=${JSON.stringify(rows)}`);
    expect(rows).toHaveLength(activeCorpus.length);
    expect(rows.every((row) => typeof row.terminal_state === 'string')).toBe(true);
  }, 240_000);
});
