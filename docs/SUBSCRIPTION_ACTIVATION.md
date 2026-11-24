# Daywoven: Apple subscriptions + RevenueCat activation handoff

Updated November 24, 2026. **Billing is NOT live.** Use this checklist to prepare a reviewed iOS release. The native paywall is merged into main; real purchase and restore testing remains outstanding.

## Verified app identifiers and existing Apple products

| Setting | Value |
|---|---|
| Apple bundle identifier | `com.daywovenapp.daywoven` |
| Subscription group display name | `Daywoven Premium` |
| Apple monthly product ID | `11` (reference name `daywoven_pro_monthly`) |
| Apple annual product ID | `22` (reference name `daywoven_pro_annual`) |
| Apple monthly subscription ID | `6836603578` |
| Apple annual subscription ID | `6836604473` |
| US monthly price | $6.99 / month |
| US annual upfront price | $39.99 / year |
| RevenueCat entitlement ID | `pro` |
| RevenueCat offering ID | `default` |
| Offering package mapping | `$rc_monthly` → monthly product; `$rc_annual` → annual product |
| Launch region | United States |
| Purchase type | Auto-renewable subscriptions, free-to-download iOS app |

These product IDs were verified in App Store Connect. Import `11` and `22` into RevenueCat; the longer names are reference names, not purchase identifiers. Do not create duplicate Apple products. The US monthly price was corrected to $6.99 and the US annual upfront price verified at $39.99. Store-returned localized prices remain authoritative in the app. Do not advertise a trial unless its configuration, eligibility and testing are ready.

## Configuration progress (November 24)

- The Supabase secrets `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_ENTITLEMENT_ID=pro`, and `REVENUECAT_WEBHOOK_AUTH_TOKEN` are saved. No private values are stored in this repository.
- The RevenueCat webhook **Daywoven Supabase membership** is active for production and sandbox. Its dashboard test returned HTTP 200 with `{"received":true}`. This checks authenticated delivery and the missing-profile acknowledgement path; it does not prove a purchase has been verified.
- EAS production has entitlement `pro`. The Apple SDK key and subscription release flag still depend on completing the Apple app connection.
- Safari failed to download the Apple purchase key with `WebKitBlobResource error 1`; the Apple app is not yet saved in RevenueCat. Product attachment and native testing remain incomplete.
- The database billing gate remains off. Do not enable it until the sandbox acceptance checks below pass.

**Paywall sequence:** anonymous 16-question questionnaire (locally stored) → free baseline results and two-week focus → signup with health-data consent → explicit save of the preview answers → optional monthly/annual subscription purchase → verified access to ongoing Daywoven tracking, planning, and insights. Restore purchase and account deletion remain accessible without a current subscription.

## Already implemented in GitHub / production

- `react-native-purchases` SDK and a Membership screen (user-bound Apple purchase, restore, plan fetch, entitlement `pro`).
- Post-onboarding navigation guard using the Supabase `subscription-access` Edge Function (checks RevenueCat's server-side customer record).
- `public.subscription_status` cannot be changed by an authenticated app user; only trusted service-role processes can update it.
- `0025_premium_data_write_enforcement.sql` adds a separate **server-owned OFF-by-default** billing switch, and restrictive INSERT/UPDATE policies across 54 premium tables. Premium histories remain readable and deletable to their owners after expiry.
- The `photo-estimate` Edge Function checks the server-side membership state before spending AI quota once paid access is enabled.
- The `revenuecat-webhook` Edge Function has been deployed with `verify_jwt=false` and an **independent high-entropy bearer authorization token** requirement. It does not trust webhook payloads to award access: it re-queries RevenueCat before updating the account state. Until the private secrets are configured it fails closed.
- Public legal URLs: https://daywovenapp.com/legal/privacy.html and https://daywovenapp.com/legal/terms.html. Support email `admin@daywovenapp.com` **must be confirmed to receive mail** before public launch.

## Actions in accounts the owner controls

1. In **App Store Connect**, confirm Paid Apps Agreement, banking and taxes. Complete the existing subscription products above, including localizations, screenshots for subscription review, and relevant availability.
2. In **RevenueCat**, create an iOS app matching the bundle ID, connect App Store Connect credentials, import both products, create entitlement `pro`, and attach them to the `default` offering's monthly/annual packages.
3. In Supabase **Edge Function Secrets**, add `REVENUECAT_SECRET_API_KEY` (RevenueCat server-side REST API v1 secret), `REVENUECAT_ENTITLEMENT_ID=pro`, and a *new random* `REVENUECAT_WEBHOOK_AUTH_TOKEN`. Never commit these, paste them in chat, or put them under `EXPO_PUBLIC_`.
4. Configure the RevenueCat webhook URL as `https://lhqpexnepgvuohmhltnr.supabase.co/functions/v1/revenuecat-webhook`; set HTTP Authorization header to `Bearer <your-secret-token>`, using the same private token configured above. The endpoint verifies that header and independently asks RevenueCat for the account's current entitlement. Test the webhook from RevenueCat and inspect that it succeeds before launch.
5. In Expo EAS **production** (or a separate isolated release-test environment), set `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` to the **public iOS SDK key**, `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=pro`, and only when the native purchase flow is ready `EXPO_PUBLIC_SUBSCRIPTIONS_ENABLED=true`.
6. Complete production `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_DEMO_MODE=false`, `EXPO_PUBLIC_SITE_URL=https://daywovenapp.com`, `EXPO_PUBLIC_FOOD_SEARCH_URL=/api/food-search`, and private `DAYWOVEN_PUBLIC_MAILING_ADDRESS` (used only for checking published legal facts, not committed in public Git).
7. Build a **signed native iOS TestFlight version** (Expo Go cannot run real StoreKit payments). Test onboarding, free results, purchase, cancel, restore, refund, active status, expiry, and account deletion on a disposable test account.
8. **Only after a successful sandbox walkthrough:** activate the server-owned billing switch `public.billing_gate_settings.enabled=true` using a trusted admin SQL session/service-role process. The app flag and server flag are deliberately independent. Once live, never switch the database to paid mode before verified Store products and customer entitlements work.

## Critical security properties

- Never use Expo's public variables, editable user metadata or a client Boolean as proof of payment.
- Direct SQL INSERT/UPDATE of paid tables requires active `subscription_status` with entitlement `pro` and a nonexpired paid period when the server gate is on. It allows existing records to remain readable/deletable for user privacy.
- `subscription-access` refreshes a person's entitlement on app startup/foreground and after purchase/restore. Webhooks keep renewal/refund/cancellation status in sync when the app is closed.
- Since a direct HTTP call can bypass client UI, the catalog `/api/food-search` is public by design, **not** a premium-only endpoint. If a future provider incurs per-request costs there, it will need its own authenticated quota/payment gate.
- Native offline-only features are not enforceable by RLS. Local persistence remains on the device, but the signed app's navigation is subscription-gated. Never promise that local-only software features can be protected by a backend database policy.
- Confirm billing cancellation/expiry rules and consumer rights with Apple and counsel before public charging. No secret key or real payment transaction has been tested by this PR.

## Verification

Read-only production verification:

```sql
select enabled from public.billing_gate_settings where id=1; -- must be false until launch
select policyname, count(*) from pg_policies
where policyname in ('premium_insert_membership','premium_update_membership')
group by policyname; -- 54 policies of each type
```

The production SQL migration was applied, checks found 54 restrictive policies for each operation, no new restrictions on onboarding/consent tables, and `authenticated` has no direct privileges on the billing switch. A transaction-only test confirmed free writes with gate off and blocked non-subscriber writes with gate on. This does **not** replace real subscription purchase/restore testing.
