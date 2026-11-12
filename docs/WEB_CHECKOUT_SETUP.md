# Daywoven website-first subscriptions (US launch)

**Implementation status:** Pricing Worker and Supabase account-bound handoff code are deployed with checkout **OFF**. No real products, prices, Stripe payouts or RevenueCat production checkout link are configured by this repository. Never set launch flags to true until native test purchases, verified premium access and compliance checks pass.

## Customer flow

1. Sign up for Daywoven on iPhone and finish the **free** onboarding questions.
2. View the **free** baseline, detailed score sheet, and two-week focus.
3. Choose "Choose plans on daywovenapp.com" on the post-results Membership screen.
4. The app calls `POST /functions/v1/web-checkout` with its **Supabase authenticated session**, which checks the profile has completed onboarding.
5. The server issues a **15-minute HMAC-signed browser ticket** tied to that account's Supabase UUID (no email, password, or payment data).
6. Browser opens `https://daywovenapp.com/pricing?session=<signed-ticket>`. Monthly and annual buttons relay through `/pricing/checkout` to the Supabase Edge Function, which validates the signature and redirects to RevenueCat's **production** Web Purchase Link with the same **App User ID** appended.
7. RevenueCat Billing and Stripe complete checkout on RevenueCat's hosted site; the user returns to Daywoven and taps "I've paid on the website · Check my access". The existing `subscription-access` Edge Function verifies the subscription with RevenueCat's REST API; RevenueCat webhooks synchronize renewals, cancellations and refunds.
8. Daywoven unlocks Premium with entitlement `pro` after server verification. The billing database switch is intentionally independent and still OFF until activation.

**Important:** Never send a bare customer UUID to the payment page from an unauthenticated website visitor. Only the authenticated iPhone session may obtain a signed link. Public visitors see an informative pricing page, but cannot buy without first completing onboarding. Anonymous purchases/redemption links are intentionally **not** implemented.

## Technical identifiers

| Item | Value |
|---|---|
| Public pricing page | `https://daywovenapp.com/pricing` |
| Edge Function | `https://lhqpexnepgvuohmhltnr.supabase.co/functions/v1/web-checkout` |
| Primary customer identity | Supabase `auth.users.id`, used as RevenueCat App User ID on mobile **and** web |
| iOS bundle ID | `com.daywovenapp.daywoven` |
| Shared RevenueCat entitlement | `pro` |
| RevenueCat web offering | A live published offering with two web packages (monthly and annual) |
| Website payments | RevenueCat Billing with Stripe as payment gateway, hosted Web Purchase Link |
| In-app payments | Apple StoreKit as a secondary option in the US release |
| Launch availability | **United States storefront only** until other regions' app-store rules are reviewed |

## Owner setup: RevenueCat + Stripe (without sharing credentials in chat)

1. Create/access the existing RevenueCat project, ensure the Apple app is connected and the public Apple SDK key plus private REST key are configured as described in `SUBSCRIPTION_ACTIVATION.md`.
2. In RevenueCat's **Web** area, create a **RevenueCat Billing** web config and connect an existing Stripe account or a claimable Stripe sandbox. Claim a sandbox before it can accept real charges.
3. Create the actual **monthly and annual web products**, with prices, currencies, renewal descriptions and any tax setup. These prices are chosen by the owner; the public page deliberately invents none.
4. Attach both products to the **same `pro` entitlement** used by iOS, and create a published web offering. Review product display, confirmation and receipts.
5. Under **Funnels → Purchase Links**, create a Web Purchase Link for that offering. Get its **Production** URL template, e.g., `https://pay.rev.cat/<your-production-token>` without an App User ID. **Do not use or publish the Sandbox URL**.
6. Copy the real package IDs from the offering. The checkout function can pass them as `package_id` to preselect monthly or annual. Without these optional IDs both buttons land on the hosted package selector, where the customer can choose.
7. Confirm the RevenueCat Billing **Customer Portal** works via links in confirmation, renewal and billing emails. That portal manages cancellations, payment details and invoices.
8. Confirm web and Apple purchases both belong to the same RevenueCat project and `pro` entitlement, using the Supabase UUID as the customer ID.

## Secure secrets and release switches

Configure the following **only** as Supabase Edge Function secrets, not in Git or Expo public variables:

- `WEB_CHECKOUT_SIGNING_SECRET`: generate a new random secret at least 32 characters long. For example, run `openssl rand -base64 48` locally and copy it directly into Supabase Dashboard (do not paste into ChatGPT).
- `REVENUECAT_WEB_PURCHASE_LINK`: **production** Web Purchase Link template starting `https://pay.rev.cat/`; NO App User ID suffix or sandbox link.
- `REVENUECAT_WEB_MONTHLY_PACKAGE_ID` and `REVENUECAT_WEB_ANNUAL_PACKAGE_ID`: optional precise web offering package IDs for preselection.
- `REVENUECAT_SECRET_API_KEY`: RevenueCat REST API v1 server secret for verified premium status, already required by `subscription-access`.
- `REVENUECAT_WEBHOOK_AUTH_TOKEN`: high-entropy webhook bearer secret, already required by `revenuecat-webhook`.
- `WEB_CHECKOUT_ENABLED=true`: **the last** server-side switch to set when production payments are safe to collect; otherwise leave unset/false.

For the EAS **production** iOS build, set `EXPO_PUBLIC_WEB_CHECKOUT_ENABLED=true` *only after* the website checkout flow is validated, and also set `EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true` with the public iOS RevenueCat SDK key. The signed app must be distributed only in the United States storefront while it contains a web-purchase call to action without a regional selector. Real Apple in-app purchase remains available when properly configured.

For premium database writes, the trusted-admin setting `public.billing_gate_settings.enabled` remains **false** until RevenueCat billing, webhooks, App Review, and purchase/restore tests pass. Never turn it on from the client.

## Testing and launch safety

- Confirm website `/pricing` is reachable, has no live checkout when opened without a session, and does not change `/`, `/legal/*`, `/api/food-search` or signup handling.
- Confirm `POST /web-checkout` without a signed-in Supabase user returns unauthorized **after secrets are set**; pre-configuration it returns a safe 503.
- Confirm a session expires after 15 minutes, cannot be forged, cannot be used to redirect to an arbitrary hostname, and cannot reassign purchases to an ID supplied by the browser.
- On a disposable real signed iPhone/RevenueCat test account, verify month/year web checkout, web return, user identity link, customer portal cancellation, renewal, refund, second-device sign-in and expired entitlements. Confirm Apple fallback checkout still works.
- Validate purchase success does **not** silently grant access from a client flag: `subscription-access` must verify it from RevenueCat. A delayed webhook should not recreate deleted accounts.
- Don't paste Stripe credentials, RevenueCat secret keys, or the short-lived checkout URL into bug reports or source control. A signed session is a temporary bearer credential.
- Real payments may require business identity verification, bank details, tax configuration and owner review of the final refund and privacy terms. The support email used by the current public support route, `admin@daywovenapp.com`, has **not** been verified as accepting messages and remains a separate public launch blocker.

Official docs: https://www.revenuecat.com/docs/web/web-billing/web-purchase-links ; https://www.revenuecat.com/docs/web/web-billing/customer-portal ; https://developer.apple.com/app-store/review/guidelines/

**Apple policy:** US storefront apps may include external payment links. App Store multi-platform content rules may still require the in-app purchase option; do not remove StoreKit. Before enabling any non-US storefront, review that region's applicable entitlement/link rules and modify app presentation.
