export type ProductEvidenceRef = {
  id: string;
  title: string;
  source: string;
  year?: number;
  url?: string;
  summary: string;
};

export const PRODUCT_EVIDENCE_REFERENCES: Record<string, ProductEvidenceRef> = {
  fda_sweeteners_safety: {
    id: 'fda_sweeteners_safety',
    title: 'High-intensity sweeteners overview',
    source: 'FDA',
    url: 'https://www.fda.gov/food/food-additives-petitions/high-intensity-sweeteners',
    summary: 'FDA-authorized high-intensity sweeteners are reviewed for safety under their intended conditions of use.'
  },
  who_nss_weight_control: {
    id: 'who_nss_weight_control',
    title: 'Non-sugar sweeteners guideline',
    source: 'WHO',
    year: 2023,
    url: 'https://www.who.int/publications/i/item/9789240073616',
    summary: 'WHO advises against relying on non-sugar sweeteners for long-term weight control or risk reduction.'
  },
  fda_daily_values: {
    id: 'fda_daily_values',
    title: 'Daily Values on Nutrition Facts labels',
    source: 'FDA',
    url: 'https://www.fda.gov/food/nutrition-facts-label/daily-value-nutrition-and-supplement-facts-labels',
    summary: 'Daily Values provide consistent label anchors for nutrients including sodium, added sugars, fiber, and saturated fat.'
  },
  bmj_ultraprocessed_umbrella_review: {
    id: 'bmj_ultraprocessed_umbrella_review',
    title: 'Ultra-processed food exposure and health outcomes',
    source: 'BMJ',
    year: 2024,
    url: 'https://www.bmj.com/content/384/bmj-2023-077310',
    summary: 'This umbrella review reports associations between greater ultra-processed food exposure and adverse health outcomes.'
  },
  fda_sugar_alcohol_notice: {
    id: 'fda_sugar_alcohol_notice',
    title: 'Sugar alcohols on food labels',
    source: 'FDA',
    year: 2021,
    url: 'https://www.accessdata.fda.gov/scripts/InteractiveNutritionFactsLabel/assets/InteractiveNFL_SugarAlcohols_October2021.pdf',
    summary: 'Sugar alcohols are labeled separately and individual tolerance can vary with the amount consumed.'
  }
};

export function resolveProductEvidence(ids: string[]): ProductEvidenceRef[] {
  return [...new Set(ids)].flatMap((id) => {
    const reference = PRODUCT_EVIDENCE_REFERENCES[id];
    return reference ? [{ ...reference }] : [];
  });
}
