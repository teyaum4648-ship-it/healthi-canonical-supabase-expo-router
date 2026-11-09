# Native/App Store readiness audit

Source: `282338657d1144bec2aa6c19014fc7faefa82923` (baseline, before this task's config edits).
Scope: actual Expo config, native integration source and installed locked modules. No cloud build, signing, deploy, commit or push.

## Implemented local fixes

- `app.config.ts:52,61`: disable microphone permissions in both expo-camera and expo-image-picker plugins. The app captures still images/barcodes only (`src/features/nutrition/photoEstimate/photoCapture.ts:60-67`).
- `eas.json`: production store distribution, production environment, remote build version source, auto-increment and empty production submit profile. No Apple account/project/bundle identifiers invented.
- Post-change `expo config --type introspect` passes. iOS microphone key absent; Android audio permission is blocked with `tools:node=remove`; camera/photo library/HealthKit purpose strings and HealthKit entitlement retained.

## Outstanding release blockers / decisions

1. App identity/signing is unfinished: `app.config.ts:29-31` has no owned `ios.bundleIdentifier`; introspection supplies `com.placeholder.appid`. Version is 0.1.0 (line 8), default native build 1. New eas.json is a scaffold, not a signed build. Need chosen bundle ID, Apple team/Developer membership, Expo project, App Store Connect app and production environment values. `supportsTablet:true` means iPad validation/screenshots/layout support must be deliberate. No Xcode/native project committed; normal for Expo continuous native generation, but no evidence of an actual compiled iOS archive.
2. Account deletion absent in actual UI/backend: signup is implemented (`app/(auth)/signup.tsx:57-64`, `AuthProvider.tsx:284-304`); Settings account section only logs out (`settings.tsx:363-389`). Policies promise Settings deletion/export (`public/legal/privacy.html:191,206-207`, `terms.html:191`); signup consent also promises it (`SignupConsent.tsx:72,83-86`). No account deletion handler/server function/purchase SDK found. Needs authenticated full-data deletion and export policy/implementation alignment before account-mode public release.
3. Native legal URLs require production EXPO_PUBLIC_SITE_URL (`src/features/legal/legalLinks.ts:23-38`). Otherwise native signup and settings show noninteractive labels. Legal files still contain placeholders (`public/legal/privacy.html:63-65,110,248` and public/legal/terms.html support contacts). Fill factual entity/contact/provider/region details and verify real reachable public policy URLs.
4. Production mode and service setup unverified: `src/features/auth/AuthProvider.tsx:18` reads EXPO_PUBLIC_DEMO_MODE; Supabase public configuration is read by `src/lib/supabase.ts:7-9`. Existing build:demo script is web/demo, not native production. Photo estimates require configured signed-in Supabase backend (`photoEstimateClient.ts:51-56`) and server secrets; preserve server-only keys. Release must select account vs local demo intentionally and have reviewer access.
5. Monetization code is absent: no StoreKit/RevenueCat/purchase/restore-paywall client SDK or implementation; only function README and prospective legal terms mention subscriptions. This is not a blocker for a free release, but paid digital features need an approved product/pricing plan plus native purchase, entitlement, restore/manage and server-validation paths.

## Native capabilities / privacy findings

- HealthKit is real code, not a placeholder: `healthSource.ios.ts:18-27` lazy-loads only outside Expo Go; permission and query APIs lines 44-60 read sleep/steps. Config `app.config.ts:67-73` generates com.apple.developer.healthkit=true and read purpose text; background/write access disabled. Must test authorization denied/empty/import on real signed iPhone; web evidence cannot validate it.
- Locked HealthKit16.2 and core16.2 peer React>=19, RN>=0.79, Nitro>=0.35, satisfied by locked React19.2/RN0.83.6/Nitro0.37.1. HealthKit/core pods pin equal16.2.0 and use RN minimum iOS; RN installed minimum iOS15.1. Nitro Swift/C++ compilation not verified on Linux.
- iOS app icon is actual1024×1024 RGB, no transparency (`public/icons/healthi-icon-1024.png`), suitable source shape. No branded native splash configuration; Expo generates default SplashScreen storyboard.
- Do not call missing top-level privacy manifest a confirmed blocker: generated Podfile properties enable privacy manifest aggregation, React-Core and AsyncStorage ship their own manifests for required-reason APIs. Final archive privacy report/data-use declarations still need review; app-level collection disclosures must match account-mode health data, photos and third-party service processing.
- Generated template includes broad NSAllowsArbitraryLoads=true and default FaceID purpose text. Source uses HTTPS and no SecureStore requireAuthentication. Consider explicit ATS restriction and removing unused FaceID purpose (`faceIDPermission:false`) as separate reviewed hardening, not proven build failures.
- Email/password only auth; no social-login implementation found, so absence of Sign in with Apple is not by itself a blocker for current auth.

## Checks

- Expo config introspection before/after: passed.
- expo install --check: failed compatibility check: expo55.0.26 expected~55.0.32; camera55.0.20~55.0.23; constants55.0.16~55.0.17; gradient55.0.14~55.0.18; linking55.0.15~55.0.17; router55.0.16~55.0.18; secure-store55.0.14~55.0.18; RN0.83.6 expected0.83.10; eslint-config-expo57.0.2 expected~55.0.1.
- expo-doctor1.21.6:17/20 checks passed. Dependency mismatch confirmed; remote Expo schema and React Native Directory checks could not complete due network/response failure. These two failures are verification limits, not evidence of invalid config or unsupported modules.
- Root owns app typecheck/tests/lint and throwaway iOS prebuild.
- No SDK upgrades performed. SDK55 rule remains; any aligned patch update needs an isolated dependency task and regression checks. Replacing package versions wholesale would exceed verified fix scope.
