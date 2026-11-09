# Daywoven — Apple App Store readiness

**Updated:** 2026-11-09 (UTC)

**Verdict: NOT READY — MAJOR WORK REQUIRED**

**Readiness score: 60/100**

**Release-pass baseline:** `f5f2797f6181b6ad0d65b32f430ab44d1bfcc46e`

Daywoven is an **Expo SDK 55 / React Native native application with a web target**. It does not need Capacitor or a full rewrite. The source now has substantially stronger release preparation, including account deletion, durable photo quotas and passing compatibility/lint checks. A signed, installable iOS archive has **not** been produced or tested. The release cannot be certified for submission today without the external steps below.

The earlier audit fixes are on GitHub `main`. This report describes the subsequent release-preparation changes; committing source does not deploy Supabase migrations/functions, create Apple signing credentials, finish legal facts, or submit a build. No real customer account or health data was deleted or modified during this work. Database deletion tests used isolated synthetic users only.

## 1. Score and evidence

This is a weighted evidence score, not a prediction of Apple approval. Mandatory blockers override the number. Unverified production and device checks earn no credit.

| Category | Earned / available | Evidence and limits |
|---|---:|---|
| Native packaging/configuration | 11 / 20 | Disposable iOS prebuild succeeds with a clearly synthetic bundle ID; correct inspected permissions/HealthKit; no registered identity, native compilation, signing or archive |
| Correctness/build checks | 18 / 20 | Typecheck, 1,959 tests, web build, browser checks and iOS JS/Hermes export; no release-device acceptance |
| Authentication/account lifecycle | 9 / 15 | Recovery and deletion implemented/tested; real email, deployed deletion and real sessions unverified |
| Backend/data security | 11 / 15 | Owned-parent policies, hard-delete cascades, durable concurrent quota tested on isolated PostgreSQL; deployment and live isolation unverified |
| Privacy/legal/disclosures | 4 / 15 | Explicit photo-AI consent and corrected promises; entity/contact/retention/provider facts and public policy pages unfinished |
| Dependency/security hygiene | 7 / 10 | SDK alignment and Expo Doctor pass; zero lint errors, zero critical advisories; 22 residual advisories require review |
| Apple submission/device acceptance | 0 / 5 | No signed-device/TestFlight/App Store Connect evidence |
| **Total** | **60 / 100** | Sum of earned points |

## 2. Critical blockers

### B1 — Apple/Expo identity, signed build and device testing

The repository now accepts `IOS_BUNDLE_IDENTIFIER`, `EXPO_PROJECT_ID` and optional `EXPO_OWNER` from the real release environment. No real values were supplied. The disposable prebuild used `com.example.daywovenaudit` only to exercise config plugins; it is **not** the release identity and was not inserted into product configuration.

Linux has no Xcode/iOS Simulator here, and no Apple/Expo signing credentials are available. CocoaPods, Swift/C++, Nitro/HealthKit linking, archive signatures/privacy aggregation, Apple processing and physical-device behavior are unverified. A successful Hermes export is not an IPA. `eas.json` provides a production-store scaffold; its new post-install gate blocks incomplete iOS production configuration.

### B2 — Production backend configuration and deployment

Real Supabase URL/public key, approved callback URLs, email service, deployment history and provider configuration are unverified. Missing configuration no longer silently opens demo mode. The preflight correctly fails with missing settings.

Required source changes have **not** been deployed to Supabase: migration 0021, new migration 0022, `delete-account`, updated `photo-estimate`, and shared helpers. Apply only the intended migrations after reviewing hosted history/backups. Then verify signup/confirmation/reset/login/logout, onboarding writes, account isolation, deletion and quota behavior with designated test accounts. Never reset production or test deletion against an ordinary customer's account.

### B3 — Legal facts and public policies

Seven legal HTML documents still contain factual placeholders. The owner must supply actual legal identity/address/contact emails, infrastructure region, backup/log/legal-record retention and provider arrangements. Those facts cannot safely be invented.

A direct curl check on 2026-11-09 confirmed **404** at `https://daywovenapp.com/legal/privacy.html` and `/legal/terms.html`. The older demo policy URL returned 200, but a usable body was not verified. The newsletter policy at the marketing site's `/privacy.html` covers a different data flow. Complete and publish the full application policies and test exact URLs from the signed app and an unauthenticated browser.

The policy no longer promises an in-app export implementation that does not exist; it describes a privacy-contact request and distinguishes local-only records. Unsupported AI-chat/automatic retention promises were corrected. Backup/log/legal retention fields are explicitly unfinished rather than fabricated. The owner must actually be able to fulfill privacy requests.

### B4 — Store disclosures, monetization and operational readiness

The initial free/paid release decision is unanswered. The current source has no StoreKit/RevenueCat purchase or restore flow. A free release does not need an invented paywall; a digital-paid-feature release needs the applicable purchase implementation and testing. Existing conditional subscription/refund terms require review.

Finish App Privacy, age-rating questions, support/copyright, Health & Fitness declarations, encryption/export compliance, reviewer credentials and real iPhone/iPad screenshots. The app still supports iPad. Provider retention, health-data handling and every advertised optional feature must match the deployed release. Real-device testing cannot be replaced by mock browser tests.

### B5 — Residual dependency and platform risk

Current npm audit: **22 findings — 0 critical, 5 high, 16 moderate, 1 low**, down from 40 initially and 29 after the first audit. Counts include transitive parent chains. See [dependency risk review](docs/DEPENDENCY_RISK_REVIEW.md) for the remaining decoder/router and Zod/Expo CLI exposure and why forced incompatible overrides were avoided. Native runtime/deep-link verification and upstream-compatible remediation remain necessary; these advisories have not been hidden.

## 3. Technology and architecture

- TypeScript/TSX, React 19.2, React Native **0.83.10**, Expo **55.0.32**, Expo Router **55.0.18**.
- Supabase email/password auth, Postgres/RLS/RPCs and Deno Edge Functions.
- Camera/barcodes, image picker/manipulation, platform secure token storage, HealthKit/Nitro read-only sleep/steps; Android Health Connect also exists.
- Deterministic readiness/wellness/nutrition engines; optional server-side Anthropic meal-photo estimates; OFF/USDA data lookups.
- Device-local practice/routine/biomarker/preferences/drafts coexist with account-owned backend records. Not all local records sync or export from the server.
- Cloudflare web-demo/search gateway and GitHub Actions deployment on `main`. The previous authorized main deployment completed successfully.

## 4. Fixed in this release pass

| Change | Affected files |
|---|---|
| Password-verified, explicit hard account deletion; bearer-derived target; generic errors/no credential logging | `supabase/functions/delete-account/index.ts`, `tests/functions/deleteAccount.test.ts` |
| Deletion UI reachable before onboarding completion and from Settings; failed requests preserve data; local cleanup result reported | `app/account/delete.tsx`, onboarding/settings screens, `AuthProvider.tsx` |
| Remove only the deleted account's existing local maps/preferences/draft, preserve other accounts/demo; report corrupted/failed cleanup | `accountDataCleanup.ts`, its tests |
| Durable 25-attempt per-account UTC-day quota; concurrent-safe reservation; no provider call if quota fails; reviewer-deletion FK fix | `0022_release_account_and_quota.sql`, `photo-estimate/index.ts`, `release_account_quota.sql`, boundary tests |
| SDK 55 dependency alignment and compatible Vite/Vitest security patches; RN pinned and Vitest kept on major 4 | `package.json`, `package-lock.json` |
| Fix six source lint errors without disabling rules; use the SDK-55-compatible ESLint config | tab layout, Movement/Plan/Settings, MoodHabitsPanel, SleepExperience |
| Fail incomplete production iOS builds early; read actual identity from environment; reject privileged public keys and unfinished legal facts | `app.config.ts`, `.env.example`, release-check scripts and tests |
| Fix Metro reusing account-test environment values in a demo export; public configuration now contributes a hashed cache key | `metro.config.js` |
| Strengthen browser verification to reject login/account-unavailable redirects as well as onboarding bounces | `scripts/verify-ui.mjs` |
| Stop guided breathing on inactive/background transitions, preventing unattended elapsed time/resumed holds | `useStopOnBackground.ts`, PacedBreath, CyclicBreathRounds, lifecycle tests |
| Catch failed policy links; remove misleading blanket refund subtitle | legal URL helper/panels, SideMenu, policy-link tests |
| Correct privacy promises and document unresolved factual retention/contact items | `public/legal/privacy.html`, release/privacy/metadata documents |
| Remove unused Face ID purpose while preserving SecureStore | `app.config.ts`; inspected generated plist |

The first audit also added recovery flows, photo-AI consent, bounded provider handling, demo-reset fixes, child-parent RLS/meal micronutrient integrity, accessibility labels and microphone removal. Its full report and evidence remain in [the previous commit](https://github.com/teyaum4648-ship-it/healthi-canonical-supabase-expo-router/blob/f5f2797f6181b6ad0d65b32f430ab44d1bfcc46e/APP_STORE_READINESS.md) and `docs/app-store-audit/2026-11-09/`.

## 5. Testing results and explicit limits

Current raw logs and structured results are saved under [`docs/app-store-audit/2026-11-09-release/`](docs/app-store-audit/2026-11-09-release/). They include the initially failed checks' resolved outcomes and explicitly identify mock/synthetic verification.

| Check | Result |
|---|---|
| Typecheck | PASS |
| Clean locked install | PASS: `npm ci --no-audit --no-fund` |
| Deno backend type-check | PASS: all six Edge Function entry points, including shared imports; not a deployment/live-service test |
| Full tests | **1,959 passed, six skipped**; 207 files passed/two skipped. Skipped live-provider tests are not verified |
| Lint | PASS command: **0 errors, 180 warnings**. Expo config 57 was corrected to compatible 55; this does not mean every previously reported compiler-style concern was behaviorally repaired |
| Expo compatibility | PASS, dependencies up to date for SDK 55 |
| Expo Doctor | **20/20 PASS** using the configured environment proxy. Initial direct-fetch failures were resolved with `NODE_USE_ENV_PROXY=1` |
| npm audit | 22 residual advisories, zero critical; not a clean security certification |
| Web production export | PASS; separate demo/account environments checked after cache fix |
| Account deletion browser test | PASS at 390×844: available before onboarding, disabled without confirmation, failure preserves data, success removes owner-only local scope and logs out. Backend mocked |
| Demo browser routes | PASS after fixing stale environment cache; Home/Food/Movement/Sleep/Mood, no page errors. Initial cache-contaminated export failed and was corrected |
| SQL migrations and security fixtures | PASS on isolated PostgreSQL 16 with synthetic auth/storage scaffolding; migrations 0001–0022, prior integrity fixtures and new deletion/quota tests |
| Quota concurrency | **50 simultaneous requests: 25 accepted, 25 rejected**; isolated synthetic user |
| iOS native prebuild | PASS in disposable copy using synthetic identity, `--no-install`; no CocoaPods/native compiler/signing |
| Generated native settings | HealthKit enabled/read-purpose present, camera/photos purposes present, microphone/Face ID absent, arbitrary HTTP loads false; AsyncStorage source defaults to excluding its iOS storage from iCloud backup |
| iOS JS/Hermes export | PASS; not native compilation or an installable App Store build |
| iOS production config gate | EXPECTED FAIL: real identity/environment and legal facts missing |
| Live privacy URLs | Marketing-domain `/legal/privacy.html` and `/legal/terms.html` return 404 |
| Real Supabase auth/deletion, email, AI provider, wearable imports | NOT VERIFIED against production |
| Signed release/device/TestFlight/App Store checks | NOT RUN: required account access, native tools/binary and device absent |

The original calibration/search/coverage fixtures passed in the earlier audit; those are not clinical validation or live-provider guarantees. The pgTAP-only suites were not run because the isolated image lacks pgTAP. Source parity against the repository's frozen Sites v14 manifest already failed on the baseline and was not falsified to hide drift.

## 6. Remaining warnings

- EAS identity settings are only plumbing until the owner supplies registered values. The audit's synthetic bundle ID must never be used for the actual app.
- The durable photo quota is per account, not a global business spending budget. Set provider limits/alerts and confirm model availability.
- Local records on other devices cannot be deleted by the current server endpoint. Cleanup errors are explicitly reported; corrupt mixed-account maps are preserved to avoid deleting another account's data. Test this on a device.
- Reviewer-owned storage objects may prevent Supabase hard deletion and need separately reviewed handling; current consumer meal photos are not retained in storage.
- No automatic Settings export exists. Privacy-contact exports require an actual operational process.
- Full native UX, safe areas/keyboards, VoiceOver, HealthKit denied/empty states, performance/crashes and memory still require signed-device tests.
- Existing 180 lint warnings include hook dependencies and unused code. Passing lint is not proof that all runtime risks disappeared.
- Optional FDA ingestion can reset match status to pending on repeated upserts. Keep the existing disabled release flag until review-state behavior and provider permissions are intentionally validated.
- Legal content is still a draft. The source cannot establish business facts, regulatory classification, contractual retention or Apple account eligibility.

## 7. Exact next steps for the owner

1. Supply active Apple Developer/App Store Connect status, registered bundle ID, Expo project/owner and production configuration through the appropriate secure account/environment settings. Do not send credentials in chat.
2. Supply legal identity/address/public contact emails, provider/region/retention facts, and free versus paid launch intent. Finish and publish working full-app legal pages.
3. Authorize and execute the reviewed Supabase deployment, then test two disposable accounts and every live integration. Follow the exact order in [IOS_RELEASE_HANDOFF.md](docs/IOS_RELEASE_HANDOFF.md).
4. Build a signed production iOS binary with a current supported Xcode/SDK, inspect its archive and test it on a physical iPhone (and iPad while supported).
5. Finish [metadata draft](docs/APP_STORE_METADATA_DRAFT.md) and [privacy inventory](docs/APP_PRIVACY_INVENTORY.md), screenshots and reviewer access.
6. After those pass, separately authorize upload/TestFlight and App Store submission. A source push is not an Apple submission.

The linked handoff contains beginner-friendly commands, account locations, deployment order, device acceptance and submission instructions specific to this app.

## 8. Current official requirements consulted

- [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/): current uploads require Xcode 26+/iOS 26 SDK+; minimum deployment target is a separate requirement.
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): completeness, account deletion, privacy, health claims, third-party AI permission and applicable payments/login rules.
- [Account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/).
- [App Privacy](https://developer.apple.com/app-store/app-privacy-details/) and [HealthKit privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy).
- [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/): inspect the actual archive's manifests/reasons/signatures.
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/), [app information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/) and [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

Email/password alone does not itself trigger mandatory Sign in with Apple; qualifying social login would change the analysis. Do not claim “Data Not Collected” for the account-mode release. Existing age minimum 18 must be reconciled with the actual questionnaire and target audience. See the dated official-source notes in `docs/app-store-audit/2026-11-09/apple-requirements.md`.

## Final decision

**NOT READY — MAJOR WORK REQUIRED.** Source fixes and automated evidence have improved substantially. Remaining blockers include actual production/Apple configuration, deployed account deletion/quota/security changes, factual published legal policies, residual risk review, signed native compilation and real-device acceptance. No successful submission, native build or Apple approval is claimed.
