# Optional questionnaire

People can choose **Skip questionnaire** on the welcome screen or **Skip for now** on any questionnaire step. Signed-out people continue to account creation with the existing consent requirements. Their explicit skip choice carries across email confirmation and sign-in. Signed-in people continue to membership, or the app when membership is not required/already verified.

Skipping records `profiles.onboarding_status = 'skipped'` for the authenticated account. The existing text column accepts this value; no schema or RLS change is needed. `completed` remains reserved for a submitted questionnaire. Route and membership checks accept either explicit setup choice, while subscription access still requires server verification.

Partial answers and the current step stay in the existing account-scoped on-device draft. A guest handoff is consumed only after its account-scoped copy and skip status are saved. Skipping does not create assessment answers, a baseline, food constraints, scores, or a personalized plan. An existing completed baseline is retained if someone leaves a later edit unfinished. A failed draft or account write is reported instead of navigating as though it succeeded.

**Resume questionnaire** is available in Profile and on the locked membership screen. The authenticated `/questionnaire` route is available without purchasing and restores progress on the same device. It keeps password recovery and session checks. Submitting the resumed questionnaire uses the existing explicit save flow and changes the account to `completed`.

Demo skipping stays local and is cleared by the existing demo reset. Incomplete/unknown setup statuses still route to onboarding. The web-checkout account boundary accepts an explicit skip but retains its authentication and signed handoff checks.

Validate with typecheck and the onboarding, authentication, subscription, profile, and web-checkout boundary tests. Native acceptance checks: skip before answering; skip halfway; create/confirm an account after skipping; reopen the app; resume from Profile or membership; finish/save; verify an unpaid account remains membership-gated. This change requires a newer app build than TestFlight build 11.
