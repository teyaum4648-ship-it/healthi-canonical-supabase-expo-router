# App Privacy evidence worksheet

Based on current source, 2026-11-09. These are facts to reconcile with deployed services, not pre-approved App Store Connect answers.

| Source/data flow | Candidate Apple category | Purpose and linkage to verify |
|---|---|---|
| Supabase email/password account, name and user UUID | Contact Info; Identifiers | Account/app functionality, linked to account |
| Onboarding, food/hydration/sleep/workout records, assessments and calculated profiles persisted in Supabase | Health & Fitness; potentially other user content | Core app functionality, linked to account |
| Local practice, biomarker, routine, preference and draft stores | Health & Fitness / User Content where applicable | Some data stays on device. Do not describe it as cloud-collected unless actually transmitted; do not promise cloud export of local-only data |
| Optional photo estimate: selected photo and optional note sent through Edge Function to Anthropic | Photos or Videos; Other User Content | Explicit per-opening consent; provider retention/contracts determine collection/disclosure details. No account UUID is intentionally sent in the Anthropic request, but the app authenticates the caller and stores saved estimates in their diary |
| Read-only HealthKit sleep/steps | Health & Fitness | Permissioned app functionality; inspect which derived/logged records are persisted remotely |
| Food search/barcodes to Cloudflare, OFF, USDA | Search History / Other Data as applicable | Search/barcode request, no explicit account identifier attached by search client; IP/request logs may exist at providers |
| Signup consent metadata and account records | Other Data / User Content as applicable | Account functionality/legal consent; actual server retention must match the policy |
| Durable photo quota | Identifiers / Usage Data as applicable | Account UUID, UTC day, attempted request count. Backend-only access; removed by account deletion |
| Hosting/auth/provider operational logs | Diagnostics / Identifiers as applicable | Confirm fields, retention and linkage in actual service configurations |

No advertising identifier, ad SDK, cross-app tracking flow or implemented payment SDK was found in the reviewed source. This does not prove the absence of provider-side collection or future configuration. ATT is required if tracking is introduced; do not add a tracking prompt solely because HealthKit is used.

The marketing newsletter privacy page covers a different data flow. It cannot replace this application's full policy.

## Owner decisions and external evidence still required

- Legal identity, contacts, hosting region and contracts.
- Anthropic model availability, actual API retention/training terms, and any selected vendor settings.
- Supabase/Cloudflare backup and log retention and actual deletion behavior.
- Whether any diagnostics or analytics are enabled outside the source.
- Final release payment model and any additional third-party SDKs.
- Apple data-type selection, purpose, linkage and tracking answers for each actual flow.

Do not select “Data Not Collected” for account mode based on the local demo. Do not claim automated export from Settings; the current build provides deletion and describes export as a privacy-contact request. Operational fulfillment of such requests remains the owner's responsibility.

SDK privacy manifests and App Privacy questionnaire answers are separate obligations. Generated native settings were inspected; final CocoaPods aggregation, archive manifests and SDK signatures still need a real native build.

## Planned subscription data flow (RevenueCat, gated off until configured)
The iOS purchase integration adds RevenueCat as the processor of App Store transaction receipts, entitlement identifiers, app user identifiers (Supabase UID), offering/product identifiers and subscription status. Before activating billing, update the published Privacy Policy and App Privacy disclosures to describe RevenueCat's role, user linkage, retention and data-handling. No customer payment-card data should be collected by Daywoven. RevenueCat SDK installation is not evidence that actual transactions have begun.
