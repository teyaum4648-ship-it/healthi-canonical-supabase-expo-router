# Lab Evidence V2

Lab Evidence is independent from Product Quality and from Regulatory Status.
Absence, unavailability, certification, or an alert never changes a Product
Quality score.

The client feature is disabled by default. It is included in the scanner only
when `EXPO_PUBLIC_LAB_EVIDENCE_ENABLED=true` is explicitly configured in an
environment whose exact-product lookup has passed standalone and integrated
acceptance. When disabled, the scanner makes no Lab Evidence request and shows
no Lab Evidence state.

## Runtime resolution

The authenticated mobile client sends normalized product identity and optional
lot context to `lab-evidence-lookup`. The Edge Function resolves reviewed
evidence from service-only tables, applies source enablement and rights windows,
filters expired or revoked records, and returns a client-safe terminal
resolution. A successful lookup with no matching records returns
`no_evidence`; provider or registry failure returns `unavailable`; insufficient
identity returns `identity_unresolved`.

Mobile product caching and evidence freshness are intentionally independent.
Saved product rows store only the V2 status, global record identifiers, and
refresh timestamps in `lab_evidence_state`. They never store numeric results,
raw source payloads, document paths, rights notes, or reviewer identities.

## Source activation

`lab_evidence_sources` is the source-level kill switch and rights registry.
`lab_evidence_feature_flags` controls system capabilities without an app
release. A source is eligible only when it is enabled, rights are approved,
client summaries are allowed, and its rights window is current.

Future licensed or credentialed providers remain disabled and make no network
requests until agreements, credentials, and projection rules are configured on
the server. Provider credentials and the Supabase service role must never use
an `EXPO_PUBLIC_` environment variable.

## Review and ingestion

Raw documents belong in the private `lab-evidence-private` Storage bucket.
Draft records, certifications, alerts, and contexts require an active
server-side reviewer membership and an explicit review action before they can
appear in lookup results. Audit events are append-only.

The FDA sync reads the official structured food-enforcement API only when both
its source and feature flag are enabled. Imported alerts remain
`pending_review`; free text does not produce an exact product or lot match.

## Local verification

Run the repository Supabase workflow when the CLI is available:

```sh
supabase start
supabase db reset
supabase test db
supabase functions serve
```

Without the CLI, TypeScript and pure-function tests still verify resolution,
matching, unit conversion, rights, disabled adapters, persistence, and Product
Quality non-regression. Database execution and RLS behavior must be reported as
unverified until the SQL tests run against PostgreSQL.
