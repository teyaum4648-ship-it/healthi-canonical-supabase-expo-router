# Dependency review for the SDK 55 release

Reviewed 2026-11-09. See the current JSON audit evidence for exact versions/advisories. Advisory counts include transitive parent packages and do not equal independent vulnerabilities or confirmed exploitable iPhone defects.

## Completed compatibility and security work

- Expo's SDK 55 compatibility check now passes. Expo, camera, constants, linear-gradient, linking, router and SecureStore were moved to the recommended SDK 55 patches; React Native is pinned to 0.83.10.
- `eslint-config-expo` was incorrectly on 57. It now uses the SDK 55-compatible 55.0.1 configuration. Six remaining lint errors were fixed in source; no lint rule was switched off for this work.
- The prior audit's critical shell-quote/transitive patches remain. Vite was patched within its supported dependency range; Vitest was patched to 4.1.12 without a major-version upgrade.
- No forced Expo downgrade, SDK-major upgrade, or untested cross-major override was used to clear the audit report.

## Remaining high findings and observed exposure

### decode-uri-component → query-string → Expo Router

The installed `query-string@7.1.3` depends on `decode-uri-component@0.2.2`. The advisories concern malformed-percent decoding causing denial of service. The inspected Expo Router 55.0.18 call sites in `build/fork/getPathFromState.js` and `getPathFromState-forks.js` use `queryString.stringify` to construct route URLs. No call to this package's `parse`/decoder was found in those sites. This limits the observed app exposure, but is not a proof of every native runtime path.

Do not blindly override the decoder with 0.5.1: it is an ES module, while this query-string version uses CommonJS `require` and expects the module itself to be a function. A naive override changes the interface and can break routing. Resolve with a compatible upstream fix or a separately reviewed, tested backport, then rerun native deep-link and navigation tests. Signed-device review is still pending.

### Zod → Expo CLI

Zod 3.25.76 is introduced by Expo's CLI. Its advisory concerns oversized constrained collections exhausting memory. Inspected uses include development-tool extension schema validation. This CLI is build/development tooling, not a claim that the application's health calculations use Zod. Avoid exposing Metro/development tools publicly or using untrusted development extensions. The audit's suggested forced Expo downgrade is not an acceptable fix. Follow the upstream SDK 55 tooling patch path.

## Other findings

The final audit reports 22 findings (zero critical, five high, sixteen moderate, one low), including tooling chains involving glob, minimatch and deepmerge. The Vitest/mocker findings were removed by the compatible patch. Use trusted fixtures and local-only test/development servers. Native production builds and deployed server bundles have different dependency surfaces; a top-level `npm audit` count alone cannot certify either one.

## Remaining verification

Run native release compilation and actual malformed/long-link, recovery, cold-start and routing tests on a signed iPhone build. Inspect the final shipped bundle and generated archive. Residual advisories must remain visible in the release decision; the app is not declared ready merely because SDK alignment and lint now pass.
