-- User-owned products retain only safe evidence references and terminal status.
-- Global results, raw documents, provider payloads, and reviewer notes remain in
-- the service-only registry and are re-resolved independently of label caching.

alter table public.user_food_products
add column lab_evidence_state jsonb;

alter table public.user_food_products
add constraint user_food_products_lab_evidence_state_shape check (
  lab_evidence_state is null
  or (
    lab_evidence_state->>'schemaVersion' = '2'
    and lab_evidence_state->>'status' in (
      'exact_lot', 'exact_product', 'manufacturer_coa', 'current_certification',
      'regulatory_alert', 'related_variant', 'brand_evidence', 'category_context',
      'no_evidence', 'unavailable', 'identity_unresolved'
    )
    and jsonb_typeof(coalesce(lab_evidence_state->'evidenceIds', '[]'::jsonb)) = 'array'
    and jsonb_typeof(coalesce(lab_evidence_state->'certificationIds', '[]'::jsonb)) = 'array'
    and jsonb_typeof(coalesce(lab_evidence_state->'regulatoryAlertIds', '[]'::jsonb)) = 'array'
    and jsonb_typeof(coalesce(lab_evidence_state->'contextIds', '[]'::jsonb)) = 'array'
  )
);

comment on column public.user_food_products.lab_evidence_state is
'Client-safe Lab Evidence V2 terminal status, timestamps, and global record identifiers only; never raw evidence.';
