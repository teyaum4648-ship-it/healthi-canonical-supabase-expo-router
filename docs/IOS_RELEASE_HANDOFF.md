# Daywoven iOS release handoff

Updated 2026-11-09. This is a release worksheet, not submission approval.

## What is ready in source

- Expo SDK 55 packages aligned to Expo's compatibility check; React Native 0.83.10.
- In-app account deletion at `/account/delete`, linked from Settings and unfinished onboarding. Current password and typed DELETE confirmation are required. The Edge Function verifies bearer identity and the password independently, accepts no target user ID, and uses hard deletion.
- Account-owned database records cascade on deletion. Migration 0022 makes reviewer decisions retain their content with the deleted reviewer identity removed.
- Local account cleanup covers the existing account maps/preferences/draft. Other accounts and demo data are preserved. Cleanup failures are reported, not presented as complete deletion. Apple Health originals and device-local records on other devices are outside server deletion.
- Paid photo requests reserve a durable 25-attempt UTC-day quota in PostgreSQL. Missing migration, unavailable quota, or exhausted budget stops the request before the AI provider. Failed upstream attempts consume a reservation.
- Explicit account/demo selection, password recovery, photo-AI consent, bounded request handling, owned-child-row checks, microphone removal and accessibility fixes from the previous audit remain included.
- Production EAS post-install checks reject missing identity, insecure/incomplete endpoint configuration, privileged public keys, and unfinished legal text.
- Metro cache keys include a hash of public build configuration to prevent stale account/demo settings from crossing exports.
- Guided breathing ends on inactive/background transitions instead of counting unattended time or resuming a hold.

## Facts the owner must supply

Do not put secret values in Git or chat.

| Item | Where to obtain it | Where it is used |
|---|---|---|
| Active Apple Developer membership and correct seller identity | developer.apple.com/account | Signing and App Store Connect |
| Registered bundle ID | Apple Developer → Certificates, Identifiers & Profiles → Identifiers | `IOS_BUNDLE_IDENTIFIER` |
| Actual Expo project UUID and owner | expo.dev → your project → Settings | `EXPO_PROJECT_ID`, optional `EXPO_OWNER` |
| Supabase project URL and public anon/publishable key | Supabase project settings | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` |
| Public full-app policy host and search endpoint | Verify your real deployment | `EXPO_PUBLIC_SITE_URL`, `EXPO_PUBLIC_FOOD_SEARCH_URL` (relative search paths can use the HTTPS site origin) |
| Legal person/company, business/contact address, public support/privacy/security/legal/accessibility email(s) | Your actual business details | Remaining `public/legal/*.html` placeholders |
| Hosting region, actual backup/log/legal-record retention, provider contracts | Supabase/Cloudflare/provider configuration and operating policy | Privacy policy and App Privacy answers |
| Free or paid initial release | Product decision | Store pricing; digital paid features require the applicable purchase implementation |

The current source contains no implemented paid subscription checkout, StoreKit purchase or restore flow. A paid-feature release needs that work; do not describe it as already available. The existing legal payment/refund text requires owner review.

## Backend deployment order — separate approval and credentials required

1. Confirm the intended Supabase project and hosted migration history. Review backups and record the current schema. Do not reset production.
2. Apply migration 0021 if it is not already applied, then `0022_release_account_and_quota.sql`. Review the exact changes against hosted schema first; do not blindly apply unrelated migrations.
3. Deploy `delete-account`, the updated `photo-estimate`, and the previously changed shared helpers. Function deployment must include their shared imports. Service-role and Anthropic credentials stay in the backend secret store.
4. Verify the real Supabase Auth settings: correct SMTP/email delivery, confirmation behavior, password requirements, and exact approved native/web callback URLs. The existing scheme is `healthi`; callbacks use `healthi://auth/callback`, including the recovery query. Do not change the scheme casually.
5. With two expendable test accounts, test signup, confirmation, password reset, login/logout, onboarding persistence, and account isolation. Test wrong-password deletion first; only then explicitly delete the designated test account and verify the other account survives. This procedure has not been run against production.
6. Check that no consumer upload/storage ownership can block hard deletion. Current meal-photo flow does not upload retained photo files. Internal reviewer-owned storage objects may need separate handling.
7. Confirm the photo provider model exists for your account, configure provider-level spend alerts/budget, and verify quota failure paths. The quota is per account; it does not cap global spending across newly created accounts.
8. Publish completed legal documents to the actual policy host and check them without authentication. A curl check confirmed `https://daywovenapp.com/legal/privacy.html` and `/legal/terms.html` return 404. The older demo URL returned 200 but no usable policy body was verified. Do not configure a missing page as the App Store privacy URL.
9. With production `EXPO_PUBLIC_SITE_URL` and `EXPO_PUBLIC_FOOD_SEARCH_URL` loaded, run `npm run check:ios-public-services`. This read-only probe checks the published **full-app** privacy and terms pages for 200/HTML/no unfinished placeholders. It also checks that the food-search API responds with its known validation error to an empty query, without calling paid providers. A marketing-site homepage or a generic 404 must not count as a working API. If the public policies and food-search Worker live on different domains, set the food-search URL to an absolute HTTPS endpoint.

## Build and submission steps

1. Finish the owner facts above. Set EAS production environment values; set `EXPO_PUBLIC_DEMO_MODE=false`. Use the registered identifiers, never the disposable test identifier from the audit.
2. Run `npm ci`, `npm run typecheck`, `npm test`, `npm run lint`, `npx expo install --check`, `npm run check:ios-release-config`, and `npm run check:ios-public-services` with the production environment loaded. The two iOS preflight checks currently fail intentionally until required facts/settings are supplied and the public services are actually deployed.
3. Sign into your actual Expo account, associate the project, and authorize a production iOS EAS build: `eas build --platform ios --profile production`. No such build was started here. Apple requires Xcode 26+/iOS 26 SDK+ for current uploads; verify the selected builder's actual version.
4. Inspect native build logs and the archive: correct bundle/version/team, HealthKit capability, camera/photos purpose strings, SDK privacy manifests and required reasons, SDK signatures, export-compliance answers and entitlements. A prebuild or Hermes export is not an archive.
5. Install a signed release build on a real iPhone. Test the checklist below. Test iPad while `supportsTablet` remains true.
6. Create/finish App Store Connect metadata using `APP_STORE_METADATA_DRAFT.md` as a draft. Finish App Privacy using `APP_PRIVACY_INVENTORY.md` and real provider settings.
7. Capture screenshots from the signed app using test data at Apple's current required iPhone/iPad sizes. Browser captures are not signed-device evidence.
8. After upload approval, use EAS Submit or Transporter to upload the tested binary. Wait for Apple's processing and address errors. TestFlight upload is separate from public release.
9. Provide a stable reviewer test account and working backend, add review notes, choose manual release if desired, and explicitly authorize submission. Submit only after the required checks and fields are complete.

## Required real-device acceptance

- Cold start, relaunch, logout, deleted/expired session, offline and slow network.
- New account, confirmation email, recovery deep link, wrong/expired link, changed password, completed/unfinished onboarding.
- Wrong-password deletion preserves data; confirmed deletion removes only that test account. Confirm local cleanup, logout and login rejection afterward.
- Deny camera/photos/Health access; exercise manual food/barcode alternatives. Test a genuine scan and optional photo estimate.
- HealthKit empty versus denied data, sleep/steps import, duplicate import handling, and manual entries remaining intact.
- Safe areas, keyboard dismissal, small iPhone, large text, VoiceOver, iPad layout.
- Guided breathing interruption/lock/background behavior, workout persistence and accidental navigation.
- Launch/crash/memory behavior in the release build; policy links and support email reachable from the actual device.

These checks require a signed binary/device. They cannot be certified by browser or unit tests.
