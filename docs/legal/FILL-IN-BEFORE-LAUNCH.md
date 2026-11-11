# Daywoven legal publication handoff

Last reviewed: November 10, 2026. These pages are **drafts**, not published policies or legal advice. Public website routes must not serve them with unresolved placeholders or inaccurate statements.

## Facts provided by owner

| Item | Value | Status |
| --- | --- | --- |
| Operator name | Tiam Anderson | Added throughout the legal drafts. Confirm that this is the actual operating legal person; do not imply an unformed LLC. |
| Contact inbox | admin@daywoven.com | Added as the single contact for support, privacy, security, legal, and accessibility. **Not delivery-tested**; ensure it receives messages. |
| Mailing address | Privately supplied | **Not placed into GitHub or public pages.** Confirm a publicly publishable business/postal address before replacing `{{BUSINESS_ADDRESS}}`. |
| Initial app model | Free App Store download + optional paid in-app subscription | Adjusted Terms and Refunds to Apple billing. The current app does **not** yet implement StoreKit subscription checkout, entitlements, or restore purchases; do not sell or claim working paid access until implemented/tested. |
| Initial market | United States | Privacy draft remains US-only. Canada was discussed as a potential later expansion, not authorized for launch yet. |
| Data hosting | Supabase AWS us-east-2 (Ohio) | Verified from connected production project and filled into privacy draft. |

## Unresolved placeholders and facts

- `{{BUSINESS_ADDRESS}}` — a public mailing address approved for publication. Do not casually publish a personal residential address.
- `{{EFFECTIVE_DATE}}` — set consistently on the actual publication date, not before.
- `{{BACKUP_RETENTION}}` — real provider backup lifecycle and deletion limitations.
- `{{TECHNICAL_LOG_RETENTION}}` — actual log retention and any third-party log processing.
- `{{LEGAL_RECORD_RETENTION}}` — factual legal-record retention process and duration.
- Verify that `admin@daywoven.com` accepts and is monitored for mail, and that the user owns/controls that domain.
- Confirm actual data processors, third-party AI processing, health-data consent and account-deletion behavior; the policy must describe deployed behavior, not aspirational features.
- Decide and review the arbitration clause in `terms.html`, and have qualified counsel assess applicable California health-privacy and consumer terms before public launch.

Check for remaining literal placeholders:

```sh
grep -ro '{{[A-Z_]*}}' public/legal/ | sort -u
```

## US first, Canadian expansion later

Apple App Store Connect can add Canada to app and subscription availability after launch. There is no separate Canadian iOS codebase required. However, because Daywoven processes wellness/health information, launching to Canadian consumers requires reviewing Canadian privacy/consent rules (including PIPEDA and provincial statutes), cross-border US hosting disclosures, and applicable provincial consumer protections. Quebec adds potential French-language commercial/contract requirements and its own privacy regime. App Store territory selection does not provide a Quebec-only exclusion. Obtain jurisdiction-specific legal review and revise the privacy policy before enabling Canadian availability.

## Before making the policies live

- Confirm every factual entry, remove all placeholders, verify customer contact and retention details.
- Update Terms, Privacy and Refunds if the paid subscription implementation or launch territory changes.
- Deploy full app policies to `https://daywovenapp.com/legal/privacy.html` and `https://daywovenapp.com/legal/terms.html` without breaking the existing newsletter site.
- Verify live HTTPS responses with `npm run check:ios-public-services` after EAS `EXPO_PUBLIC_SITE_URL` and the food-search API are configured.
- Complete Apple's App Privacy disclosures using actual connected provider behavior. A public policy URL is not itself an App Review approval.
