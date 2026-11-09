# Daywoven — Apple App Store readiness

**Audit date:** 2026-11-09 (UTC)

**Verdict: NOT READY — MAJOR WORK REQUIRED**

**Readiness score: 46/100**

**Repository:** `teyaum4648-ship-it/healthi-canonical-supabase-expo-router`

**Audited starting commit:** `282338657d1144bec2aa6c19014fc7faefa82923`

**Local working branch:** `codex/app-store-readiness-20261109`

The application has a substantial working codebase and a passing automated suite. It is an **Expo/React Native application with a web target**, rather than a website that needs to be wrapped for iOS. Its iOS JavaScript/Hermes bundle exports successfully. A signed, installable App Store binary has **not** been built or verified. Native project generation currently stops because the required bundle identifier is missing.

At the conclusion of the initial audit, all fixes were local source changes and no deployment or publication had occurred. **Publication follow-up:** the owner subsequently authorized putting these fixes on `main`, including its previously explained automatic web-demo workflow. This commit contains the audit fixes and the explicit demo/account configuration follow-up. Backend migration/function deployment, Apple builds/uploads, TestFlight and App Store submission remain separate outstanding actions. Publishing source does not make the app ready to submit.

## 1. Score calculation

This is a weighted score of available release evidence, not a prediction of Apple's decision. Mandatory blockers override the number. Unverified production/device checks earn no credit.

| Category | Earned / available | Basis |
|---|---:|---|
| Native packaging and release configuration | 8 / 20 | Native Expo architecture, valid icon and inspected permissions; no owned bundle ID, signed archive, or signing verification |
| Functional correctness and build checks | 16 / 20 | Typecheck, unit/regression tests, web build, iOS JS export and browser route checks pass; lint and native acceptance remain unresolved |
| Authentication and account lifecycle | 5 / 15 | Native SecureStore session path and source-tested email recovery; live account flows, deletion and export unverified/missing |
| Backend and data security | 9 / 15 | Input fixes and isolated SQL ownership/transaction tests; deployment state, durable paid quotas and real service integration unverified |
| Privacy, legal and data disclosures | 4 / 15 | Explicit photo-AI permission and accurate local consent wording; legal placeholders, deletion promises and App Privacy answers unfinished |
| Dependency/security hygiene | 4 / 10 | Critical advisory removed through compatible leaf patches; 29 advisories and SDK-alignment failure remain |
| Apple submission and device acceptance | 0 / 5 | No signed-device/TestFlight/App Store Connect evidence |
| **Total** | **46 / 100** | Sum of earned points |

## 2. What the app actually is

| Layer | Verified implementation |
|---|---|
| Language/UI | TypeScript, TSX, React 19.2, React Native 0.83.6, Expo SDK 55; Expo Router file-based navigation |
| Native features | Camera/barcode scanning, image picker/manipulation, secure session storage, native gesture/Reanimated UI, read-only Apple Health sleep/steps integration; Android Health Connect code also exists |
| Product | Readiness/foundation calculations, onboarding, nutrition diary/search/scoring/photo estimates, hydration, sleep/rhythm, movement sessions, mood/practices, plans and progress |
| Data/auth | Supabase email/password auth, PostgreSQL migrations/RLS/RPCs and Deno Edge Functions; separate local demo lifecycle; some records such as routines/practices remain device-local |
| Scoring | Deterministic engines under `src/engines`; experimental food kernel selected separately by environment flag |
| Web/server | Metro single-page web export; Cloudflare Worker food-search gateway and static assets; Open Food Facts/optional USDA; server-only Anthropic photo estimation |
| Delivery | `npm run build:demo` exports the web demo and Worker; `.github/workflows/deploy-demo.yml` can deploy on `main`; added `eas.json` supplies a production-store scaffold |

No Capacitor migration or complete rebuild is needed. Expo's native build path is the appropriate starting point. Expo Go and browser testing cannot validate HealthKit/Nitro/CocoaPods/signing.

The audit inventoried the repository and reviewed the release configuration, auth/account flows, permissions, legal documents, backend inputs, SQL policies/RPCs and representative UI paths. Automated tests cover many engine cases. This does **not** mean every UI combination, every native hardware path, external service or historical Git commit was executed.

## 3. Critical blockers, in order

### B1 — No verified iOS release identity or signed archive

`app.config.ts` lacks `ios.bundleIdentifier`; there is no owned Apple team/App Store record or Expo project configuration verified in this environment. A throwaway `expo prebuild --platform ios --no-install` failed requesting a bundle ID. No fake ID was inserted into the application.

`eas.json` now defines a production store profile, production environment and remote build-number auto-increment. This is configuration scaffolding, **not** proof that EAS can sign/build this project. The Linux executor has no Xcode/iOS Simulator, signing certificates, provisioning profile or Apple session. Native Swift/C++ compilation, HealthKit/Nitro linking and archive validation remain untested.

**Required:** choose/register the actual bundle ID and Apple team, associate the Expo project, configure the production environment, select a builder with the required Xcode/SDK, create an authorized signed build and inspect Apple's processing results.

### B2 — Account creation exists; account deletion does not

Signup is implemented. `app/(app)/(tabs)/settings.tsx` offers logout but no account-deletion initiation. `supabase/functions/README.md` lists `deleteUserData`/`exportUserData` as desired functions; they are not implementations. The privacy/terms/signup-consent text promises deletion/export that the current product does not provide.

Apple requires in-app deletion initiation when account creation is supported; ordinary deactivation or “email support” alone is insufficient for this app. Implement authenticated ownership verification, intentional confirmation, account/data removal or a direct deletion completion flow, local-cache/session cleanup, and documented lawful retention exceptions. Test that a user cannot delete another account. Export is separately needed to reconcile this app's promises and applicable obligations; it is not asserted here as a universal App Store requirement.

**No account or user data was deleted during this audit.** A destructive account service was not invented or deployed as an audit shortcut.

### B3 — Legal content and native policy links are unfinished

`public/legal/*.html` contains real placeholders for entity, address, effective date, contacts and infrastructure facts. Examples include `privacy.html:63–65` and the contact section of `terms.html`. Native `legalUrl()` in `src/features/legal/legalLinks.ts` returns `null` without `EXPO_PUBLIC_SITE_URL`, leaving policy labels noninteractive.

Supply the true legal identity/contact details and actual retention/deletion/provider arrangements. Review unsupported promises about export, deletion, subscriptions and other planned services. Verify the exact public URLs on an unauthenticated browser **and in the signed app**. The landing page's `/privacy.html` describes its email signup list; it is not a substitute for the application's full health/account privacy policy under `/legal/`.

The photo-AI paragraph was corrected locally to match the new per-opening permission behavior; other unfinished legal facts were deliberately not fabricated.

### B4 — Production service/account mode has not been exercised

The audit found that `AuthProvider` silently fell back to the local demo when Supabase configuration was missing, even with `EXPO_PUBLIC_DEMO_MODE=false`. **Fixed in the follow-up:** demo now requires explicit `true`; missing backend configuration renders a branded account-unavailable screen without mounting account routes or demo stores. The six-case regression matrix covers explicit/omitted mode and configured/unconfigured backend selection. Actual production settings and live account behavior remain unverified; a successful bundle export alone does not establish functioning production login or cloud persistence.

Configure and verify:

- `EXPO_PUBLIC_DEMO_MODE=false` intentionally for account-mode release.
- Actual `EXPO_PUBLIC_SUPABASE_URL` and the public anon/publishable key.
- `EXPO_PUBLIC_SITE_URL` and food-search endpoint behavior on native devices.
- Supabase redirect allow-list and email delivery for the generated `healthi://auth/callback` and approved web callback, including the recovery query. Preserve the existing scheme.
- Email confirmation, signup, sign-in/out, expired/wrong links, password reset, profile/onboarding writes and cross-user isolation against the deployed backend.
- Actual deployed migration/function inventory. Repository SQL is not proof of hosted migration state.

Never put an Anthropic/USDA/service-role/private signing credential in `EXPO_PUBLIC_*`. `npm run check:ios-release-config` now reports incomplete release configuration without printing values; it intentionally fails here. Its success would still not certify App Store compliance.

### B5 — Backend security/data fixes must be deployed and verified separately

New migration `0021_account_data_integrity.sql` strengthens child-row INSERT/UPDATE policies and fixes `replace_meal_items` micronutrient persistence. Before the fix, an owner-controlled child row could refer to another owner's known parent UUID; this was an integrity weakness, **not a demonstrated cross-user data-read exploit**. Portion/removal edits could also leave old micronutrient totals on account meal rows.

The new migration preserves tables/data and checks owned meal/product/workout/exercise parents. It updates micronutrients in the same transaction as meal items/macros; absent values become unknown rather than retaining stale values. The client supplies the recomputed panel. Three isolated PostgreSQL test scripts pass after all migrations 0001–0021.

**The production database remains unchanged.** After explicit deployment approval, review actual hosted schema/history and backup arrangements, apply only the intended migration, then verify RLS/RPCs using two dedicated test accounts. Do not blindly reset production or apply unrelated pending migrations.

### B6 — Paid photo-estimate quota is not durable

`supabase/functions/photo-estimate/index.ts` uses an in-memory Map for a 25-request per-user/day guard. Parallel isolates/restarts have separate counters. The source cannot enforce a global account/day cost ceiling. The public product-resolver limiter is also per instance.

The audit added bounded request/response reads and a 30-second upstream deadline and removed raw provider error-body logging. These are useful protections, but they do not solve distributed quota enforcement. Add an atomic durable quota/abuse budget before enabling paid photo estimates at production scale. Confirm the configured model/provider is available. Leave unconfigured optional functionality accurately described to users; do not advertise unavailable functionality as working.

### B7 — Dependency alignment and lint remain failing release checks

- `npm audit`: **29 remaining findings: 0 critical, 8 high, 20 moderate, 1 low**. Baseline was 40, including one critical. Advisory counts include build/test dependencies and transitive chains; they are not a count of confirmed exploitable iPhone flaws.
- Remaining high chains include Expo CLI, Expo Router/React Navigation, decode-uri-component/query-string, image-size, Vite and Zod. Document each affected use/mitigation and perform controlled compatible upgrades. Audit's suggested Expo downgrade or forced cross-major overrides were **not** applied.
- Expo compatibility check flags nine mismatches: Expo/camera/constants/linear-gradient/linking/router/secure-store SDK-55 patches, RN 0.83.6 versus expected 0.83.10, and `eslint-config-expo` 57 versus expected 55. Stay on the approved SDK 55 unless a separate upgrade is authorized; check native compatibility after patch alignment.
- Final lint still has **86 errors and 181 warnings**. Baseline was 86 errors/180 warnings. Most errors are React refs/effect-state/purity/immutability checks, plus display-name and unescaped JSX text. No rules were disabled to conceal failures. Refactor and verify affected behavior rather than applying a broad unsafe rewrite during the audit.

## 4. Fixed issues and affected files

Follow-up after the initial audit: explicit demo/account selection now fails closed on missing backend configuration. Changed `src/features/auth/AuthProvider.tsx`, added `src/features/auth/AccountUnavailable.tsx` and `tests/features/auth/authConfiguration.test.ts`, and adapted the existing auth-provider/signup-metadata tests. Typecheck and all 52 auth tests passed. Before publication, typecheck, the web-demo production build and the full suite passed again: **1,926 tests passed, six skipped; 202 files passed, two skipped**. This fix does not change the readiness score or replace the production-service/native verification requirements. The original ZIP and evidence logs below represent the initial audit snapshot, before this follow-up.

| Fix | Source/test files |
|---|---|
| Password-reset request/new-password screens, verified callback parsing/session exchange, recovery route guards and signup redirect | `src/features/auth/authLinks.ts`, `AuthProvider.tsx`; `app/(auth)/forgot-password.tsx`, `login.tsx`, `_layout.tsx`; `app/auth/callback.tsx`, `reset-password.tsx`; protected/onboarding layouts; auth helper/provider/signup tests |
| Fresh demo now clears its breath/biomarker scopes and saved demo routines while preserving account records | `src/features/auth/demoLifecycle.ts`, `tests/features/auth/demoLifecycle.test.ts` |
| Catch rejected SideMenu sign-out instead of leaving an unhandled promise | `src/features/navigation/SideMenu.tsx` |
| Explicit unchecked photo-AI permission before camera/library callbacks, with recipient/purpose/search alternative | `src/features/nutrition/photoEstimate/PhotoEntrySheet.tsx` and its tests; `public/legal/privacy.html` paragraph aligned to actual behavior |
| Correctly classify genuine Supabase non-2xx photo errors, including 429; bounded response parsing | `photoEstimateClient.ts`, `tests/features/nutrition/photoEstimateClient.test.ts` |
| Validate nullable lookup-identity fields before string operations | `supabase/functions/_shared/labEvidence.ts`, `tests/functions/labEvidenceInput.test.ts` |
| Bound photo request/provider bodies, abort upstream after 30 seconds, reject malformed provider content, avoid logging raw provider bodies | `_shared/requestLimits.ts`, `photo-estimate/index.ts`; `tests/functions/requestLimits.test.ts`, `photoEstimateBoundary.test.ts`; quota limitation documented in `docs/source-and-deployment.md` |
| Strengthen child-parent ownership and atomically persist edited micronutrients | `supabase/migrations/0021_account_data_integrity.sql`, `supabase/tests/account_data_integrity_security.sql`, `src/features/nutrition/mealCollectionStore.ts`, meal-library tests |
| Shared fields expose their visible label to assistive technology; callers can override it | `src/components/TextInput.tsx`, `tests/features/accessibility/TextInput.test.tsx` |
| Remove fabricated personalized sleep-pattern conclusion when no history exists | `src/features/sleepRhythm/SleepExperience.tsx`; neutral logged-times guidance replaces the unconditional comparison |
| Remove unused microphone permission from both camera/photo plugins | `app.config.ts`; Expo introspection confirms microphone key absent, camera/photos/HealthKit retained |
| Production build scaffold and read-only configuration gate | `eas.json`, `scripts/check-ios-release-config.cjs`, `package.json` script |
| Portable resolution of available Playwright for existing UI verifier | `scripts/verify-ui.mjs`; existing command now runs with the installed browser |
| Compatible transitive security patches, including critical shell-quote fix | `package-lock.json`: 21 leaf updates; no direct dependency ranges or Expo major version changed |

The source changes preserve the existing app design/branding, scheme and production values. No old migrations were rewritten. Deployment is still required before server/SQL changes affect a hosted service. Recovery UI is implemented and source-tested; real email links remain an external verification task.

## 5. Testing results and limits

| Check | Result |
|---|---|
| Clean dependency installation, `npm ci --no-audit --no-fund` | PASS on the starting locked tree |
| `npm run typecheck` | PASS after fixes |
| `npm test` | PASS: **1,920 tests passed, six skipped** across 201 passing/two skipped files; skipped live-provider tests are not counted as verified |
| `npm run calibrate` | PASS command; its illustrative corpus reports 34/52 in target bands and rank correlation 0.932—this is **not clinical validation** |
| `npm run lexicon:coverage`, `npm run search:quality` | PASS; fixture coverage does not guarantee current upstream catalogue responses |
| `npm run build:demo` | PASS: web export and Worker build |
| `EXPO_NO_DOTENV=1 EXPO_PUBLIC_DEMO_MODE=false npx expo export --platform ios ...` | PASS: approximately 11 MB Hermes bundle; no signed IPA/native compilation and no configured remote-service acceptance |
| `CHROMIUM_PATH=/usr/bin/chromium VERIFY_UI_PORT=8136 npm run verify:ui` | PASS on built demo routes: Home/Food/Movement/Sleep/Mood; browser console clean |
| Additional local browser route audit | 11 routes rendered at 390×844 with no JS page errors or horizontal document overflow: Home, Food, Movement, Sleep, Mood, Settings, Progress, Plan, Closeout, Load Check, Protocol |
| Entry-form browser checks | Water/food entry, manual food path, workout start, sleep adjustment, mood practices and schedule block entry opened; no page errors. Checks exercised entry surfaces, not every save/network/permutation |
| Callback/recovery/legal route rendering | PASS in local demo mode; does not verify remote auth or actual email delivery |
| PostgreSQL 16 isolated tests | PASS: all 0001–0021 migrations applied with minimal synthetic Supabase auth/storage schema; nutrition persistence, meal library and new account-integrity fixtures pass with synthetic users and rollback |
| pgTAP-only SQL suites | NOT RUN: pgTAP unavailable in the isolated PostgreSQL image; this does not replace real Supabase integration testing |
| Expo config introspection | PASS after permission changes; 1024×1024 RGB icon source valid; HealthKit entitlement/read-purpose present |
| Expo doctor | 17/20 checks passed; dependency alignment fails; two remote schema/React Native Directory checks could not complete. Those two are verification limits, not confirmed source defects |
| iOS prebuild | BLOCKED in throwaway directory by missing bundle identifier; no canonical `ios/` tree generated |
| Lint | FAIL: 86 errors/181 warnings; not suppressed |
| `npm audit --json` | FAIL: 29 remaining advisories, zero critical |
| `npm run check:ios-release-config` | EXPECTED FAIL: missing identity/production config and unfinished legal facts |
| Published-demo source parity checker | FAIL already on baseline: many files differ from frozen Sites version 14 manifest; later app history has evolved. It is not an iOS build gate; frozen historical hashes were not falsified to make it green |
| Current tracked-source credential-pattern scan | No high-confidence private-key/token-pattern hits in 821 text files; only `.env.example` tracked. Limited regex scan, not full-history/remote-secret assurance |

No real login/signup/reset email, account deletion, payment, photo-AI request, wearable import, cloud database write or native permission dialog was performed. No signed-device crash/memory/thermal/network/keyboard/background test was possible here. No simulator screenshots or native archive privacy report were produced. Optional generation/server-start scripts are not acceptance tests; data vocabulary was not regenerated as an audit side effect.

## 6. Warnings and required product decisions

- **Native UX:** `supportsTablet:true`; test iPhone small/large/Dynamic Island and iPad layouts, safe areas, modals, keyboard dismissal/avoidance, Dynamic Type and VoiceOver. Web viewport checks cannot establish these.
- **Background behavior:** paced breathing uses elapsed wall-clock time without an AppState pause; background time can be included. Test interruptions/locking and define intended session behavior before release.
- **Data lifecycle:** some practice/routine/biomarker features are device-local. Explain sync/export/deletion scope accurately; do not promise all records sync across devices.
- **Performance:** web entry is about 4.7 MB and a generated food/menu chunk about 2.2 MB; iOS Hermes export about 11 MB. These are bundle observations, not measured native memory/launch-time results. Profile a release build on an older supported iPhone.
- **Native hardening:** inspected generation includes broad ATS configuration and unused Face ID purpose text. Review actual production Info.plist, HTTPS-only behavior, backup/data-protection behavior and unused permissions before changing them; no ATS vulnerability was demonstrated here.
- **Food/lab accuracy:** scoring is general wellness, not clinical validation. Experimental scoring, inferred ingredient shares and limited confidence must remain disclosed. The disabled-by-default lab registry has a sync-review-state concern: FDA upsert can revert matches to pending; test the reviewer workflow before enabling it.
- **Free versus paid:** no working IAP/paywall/restore/entitlement implementation was found. A free release does not need invented subscriptions. Paid digital access requires a separate reviewed StoreKit/IAP design and policy check; prospective legal subscription language must match the shipped product.
- **Login:** own email/password auth alone does not trigger Sign in with Apple; adding qualifying social login can change that obligation.
- **Privacy:** no tracking SDK was established by this audit. Do not add ATT just because health data exists; determine whether actual production behavior meets Apple's definition of tracking. App Privacy, permission strings and SDK privacy manifests are separate requirements.

## 7. Current Apple requirements checked

Official sources were consulted on 2026-11-09. Recheck immediately before upload.

- Uploads currently require **Xcode 26+ and the iOS 26 SDK+**; SDK version is separate from minimum supported iOS. Current uploads must target iOS 13+; installed RN's native minimum is newer. [Apple upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)
- In-app account-deletion initiation, accurate policy/data handling, explicit permission before personal data goes to third-party AI, applicable IAP rules, app completeness and truthful functionality apply. This native feature set is substantial, but a successful demo does not prove completeness. [Review guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/)
- App Privacy answers must reflect the real account-mode release and third parties, not only the device-local demo. [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/)
- HealthKit purpose/capability/denied-data behavior and native SDK privacy manifests/signatures must be reviewed in the actual archive. React-Core/AsyncStorage include manifests; Hermes is on Apple's covered SDK list. Missing a handwritten top-level manifest alone was not treated as a proven rejection. [HealthKit privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy) · [SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/)
- Prepare screenshots in the current App Store Connect required device slots. Apple's current table includes iPhone Dynamic Island medium portrait 1179×2556 or 1206×2622 and 13-inch iPad requirements when iPad is supported. Verify the slots actually presented for the app; the landing's 780×1688 web captures are not verified native submission assets. [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)
- Complete the age-rating questionnaire and applicable Health & Fitness regulated-medical-device declaration accurately. The latter does not itself establish that Daywoven is a regulated device. Future age descriptors announced for Nov 16, 2026 / Jan 12, 2027 are not already-past requirements on this audit date. [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/) · [Age-rating announcement](https://developer.apple.com/news/?id=yxkh08us)

Extended official-source notes: [apple-requirements.md](docs/app-store-audit/2026-11-09/apple-requirements.md).

## 8. Owner's step-by-step release path

### A. Finish the release blockers

1. Review the local diff/report. Keep the app on SDK 55 for this task. Approve a controlled patch-alignment/lint-remediation task and resolve/document remaining advisories; repeat tests and native checks.
2. Implement and test account deletion and reconcile export/retention promises. Finish true entity/contact/legal content. Decide which optional services are actually included in v1; preserve existing functionality while making unavailable paths honest.
3. Review migration 0021 against the actual hosted migration inventory, backup and test-account plan. Only after separate approval deploy the needed migration/function fixes and verify them on the intended backend. Do not run `supabase db reset` against production.
4. Choose free versus paid v1. Implement proper purchases only if monetization is in scope; finish durable paid-AI quotas before enabling paid estimates broadly.

### B. Establish Apple/Expo identity and production settings

5. Enroll/verify your Apple Developer Program membership. Choose the correct individual/organization legal seller identity. In Apple Developer/App Store Connect register your real unique Bundle ID and create the app record; use exactly the same ID in `app.config.ts`.
6. Set the public release name/version deliberately (`daywoven`, currently `0.1.0`). The existing 1024px source icon is valid in size/alpha; visually approve icon/splash in an actual build. Do not rename `healthi` scheme/storage keys casually. Decide whether iPad support stays enabled, with corresponding QA/screenshots.
7. Sign in to your Expo account and associate this project (`eas login`, `eas init` through the approved CLI). Keep the returned project ID; do not copy IDs from another app. `eas.json` is already scaffolded.
8. Configure the Expo production environment and backend endpoints. The Supabase URL/anon key are public app configuration; privileged backend/API keys remain in server secret stores. Set `EXPO_PUBLIC_DEMO_MODE=false`; set actual site/search URL and test it on a phone. Do not copy a developer's entire `.env` or expose private values in chat/Git.
9. Configure Supabase's approved native/web redirect URLs and real transactional email; test confirmation/recovery/logout with dedicated accounts. Run `npm run check:ios-release-config`; resolve each output. This command never creates a build or changes services.

### C. Build and validate a real iOS app — requires your approval/account

10. After the blockers and environment are addressed, authorize `eas build --platform ios --profile production` (or a macOS/Xcode build). Allow EAS/Apple to manage signing only under your account's approval. Verify the selected image uses Apple's current required Xcode/SDK. A Linux Metro export is not a replacement for this step. [Expo production build guide](https://docs.expo.dev/deploy/build-project/) · [iOS build process](https://docs.expo.dev/build-reference/ios-builds/)
11. Inspect the signed archive/build logs: Bundle ID, version/build number, deployment target, HealthKit entitlement, camera/photo purposes, microphone absence, ATS, required-reason manifests, covered SDK signatures, export-compliance declarations and provider configuration. Resolve any native compiler/CocoaPods/Nitro issues rather than assuming Expo Go success is sufficient.
12. On a signed physical iPhone, test new/returning accounts, deletion and reset, offline/slow/failing networks, persistence/reinstall expectations, denied camera/photos/Health permissions, manual alternatives, real barcode/photo flow, sleep/steps denial/empty states, keyboard/safe areas, large text/VoiceOver, background/locking interruptions and launch/crash/memory behavior. Add iPad tests while support remains enabled. Use a release build, not only debug mode.

### D. Prepare App Store Connect and TestFlight

13. Prepare name/subtitle/description/keywords, category, copyright, support URL and the full app privacy URL, content rights, territories/pricing, age-rating answers, encryption/export compliance and applicable medical-device declaration. Describe shipped capabilities only. Current signup minimum-age constant is 18; reconcile onboarding/terms and age-rating answers intentionally rather than claiming a child audience.
14. Complete App Privacy from the actual data flow. Likely review categories include account email/name/user ID; health/fitness/profile and nutrition records; photos/other submitted content; diagnostics/request metadata. Decide linkage, purpose, retention and third-party handling factually. Do not select “Data Not Collected” merely because a demo is local. Confirm Anthropic's actual current terms/retention before making vendor guarantees.
15. Capture genuine signed-build iPhone/iPad screens in required current sizes. Use controlled demo data and truthful screens; do not present unsupported functionality. Capture permission/empty/error states for internal QA as well.
16. Separately authorize upload using EAS Submit or Transporter. An upload goes to App Store Connect/TestFlight processing; it is not automatically a public release. Check processing, compliance and capability warnings. Test internally, then authorize external TestFlight testing if desired; external testing may need Beta App Review. Keep backend services available.

### E. Submit only after the evidence is complete

17. Provide a stable reviewer account and instructions for login, optional permissions and non-obvious features. Use controlled review data and working external services. Explain health estimates/limitations and third-party AI permission clearly. Supply privacy/support/deletion URLs and any relevant evidence.
18. Select the tested processed build, finish all metadata/privacy/compliance fields and App Review notes, choose a deliberate release method, and obtain explicit submission approval. Only then submit for review. Address actual review feedback and retest any replacement build. [Apple before-submission guidance](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/) · [TestFlight](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)

## Final decision

**NOT READY — MAJOR WORK REQUIRED.** The native app foundation is viable and several source defects are fixed, but account deletion, legal/production configuration, security/lint remediation, signed native compilation, real-device acceptance and Apple submission evidence remain. No successful App Store submission or approval can be claimed from this audit.

## Appendix — source and audit file inventory

The grouped fixes above correspond to these files (including report/evidence):

- `APP_STORE_READINESS.md`
- `app.config.ts`
- `app/(app)/_layout.tsx`
- `app/(auth)/_layout.tsx`
- `app/(auth)/forgot-password.tsx`
- `app/(auth)/login.tsx`
- `app/(onboarding)/_layout.tsx`
- `app/auth/callback.tsx`
- `app/auth/reset-password.tsx`
- `docs/app-store-audit/2026-11-09/apple-requirements.md`
- `docs/app-store-audit/2026-11-09/auth-route-rendering.json`
- `docs/app-store-audit/2026-11-09/browser-interactions.json`
- `docs/app-store-audit/2026-11-09/browser-routes.json`
- `docs/app-store-audit/2026-11-09/browser-verifier.log`
- `docs/app-store-audit/2026-11-09/ios-export.log`
- `docs/app-store-audit/2026-11-09/ios-prebuild.log`
- `docs/app-store-audit/2026-11-09/native-readiness.md`
- `docs/app-store-audit/2026-11-09/npm-audit.json`
- `docs/app-store-audit/2026-11-09/release-config.log`
- `docs/app-store-audit/2026-11-09/secret-scan.json`
- `docs/app-store-audit/2026-11-09/sql-tests.log`
- `docs/app-store-audit/2026-11-09/tests.log`
- `docs/app-store-audit/2026-11-09/typecheck.log`
- `docs/app-store-audit/2026-11-09/verification.json`
- `docs/app-store-audit/2026-11-09/web-build.log`
- `docs/source-and-deployment.md`
- `eas.json`
- `package-lock.json`
- `package.json`
- `public/legal/privacy.html`
- `scripts/check-ios-release-config.cjs`
- `scripts/verify-ui.mjs`
- `src/components/TextInput.tsx`
- `src/features/auth/AuthProvider.tsx`
- `src/features/auth/AccountUnavailable.tsx`
- `src/features/auth/authLinks.ts`
- `src/features/auth/demoLifecycle.ts`
- `src/features/navigation/SideMenu.tsx`
- `src/features/nutrition/mealCollectionStore.ts`
- `src/features/nutrition/photoEstimate/PhotoEntrySheet.tsx`
- `src/features/nutrition/photoEstimate/photoEstimateClient.ts`
- `src/features/sleepRhythm/SleepExperience.tsx`
- `supabase/functions/_shared/labEvidence.ts`
- `supabase/functions/_shared/requestLimits.ts`
- `supabase/functions/photo-estimate/index.ts`
- `supabase/migrations/0021_account_data_integrity.sql`
- `supabase/tests/account_data_integrity_security.sql`
- `tests/features/accessibility/TextInput.test.tsx`
- `tests/features/auth/authLinks.test.ts`
- `tests/features/auth/authConfiguration.test.ts`
- `tests/features/auth/authProvider.test.ts`
- `tests/features/auth/demoLifecycle.test.ts`
- `tests/features/auth/signupMetadata.test.ts`
- `tests/features/nutrition/PhotoEntrySheet.test.tsx`
- `tests/features/nutrition/mealLibrary.test.ts`
- `tests/features/nutrition/photoEstimateClient.test.ts`
- `tests/functions/labEvidenceInput.test.ts`
- `tests/functions/photoEstimateBoundary.test.ts`
- `tests/functions/requestLimits.test.ts`

Publication commit message: `Prepare Daywoven iOS release audit and fix verified security and account-flow defects`.
