# Healthi — legal and compliance risk register

Written 2026-09-16 against commit `bb0b0fe`. Author: Claude Code, at the owner's request.

**This is not legal advice and I am not a lawyer.** It is an engineer's audit of the
codebase against the rules that plainly apply to it, written so that an attorney can be
pointed at the four items that actually need one instead of being paid to read the whole
thing. Where I am uncertain, I say so rather than rounding to confident.

Jurisdiction assumed: owner in San Diego, California; users in the United States.

---

## Severity key

| | Meaning |
| --- | --- |
| **P0** | Do not take money or launch publicly until this is resolved |
| **P1** | Resolve before public launch |
| **P2** | Resolve before scale, or when a trigger fires |
| **P3** | Worth knowing; no action today |

---

## Things that turned out fine

Worth stating plainly, because each one is a category of risk you do **not** have:

- **No analytics, no ad pixels, no trackers.** Nothing. No Google Analytics, Meta Pixel,
  TikTok tag, Sentry, Mixpanel, Amplitude, PostHog, session recorder or heatmap. This is
  the single biggest reason your exposure is low — see **H2** for why it matters so much
  for a *health* app specifically.
- **No cookies.** Zero `document.cookie` in the codebase. Auth uses a custom storage
  adapter → `localStorage` on web, `expo-secure-store` on native, with
  `detectSessionInUrl: false`. **You do not need a cookie consent banner.** Details in
  `public/legal/cookies.html`, and in **C1** below.
- **No fake reviews, no testimonials, no unsupported health claims.** I grepped for them.
  The engines actively forbid the risky register — `src/engines/readiness/README.md:16`
  literally lists "Use diagnosis language" under *Do not*, and
  `generateDailyProtocol.ts:39` and `safetyCopy.ts:6` say the same. Whoever set that up
  saved you real money. See **F1** for how to keep it.
- **No image copyright exposure.** Four images in the whole repo, all your own app icons
  (`public/icons/`). No stock photography, no scraped product shots bundled. One
  confirmation needed — **R2**.
- **No precise location, no contacts, no microphone, no advertising ID.**
- **No third-party embeds at all.** No YouTube or Vimeo players, no embedded maps, no
  social widgets, no chat bubble, no CDN-loaded fonts — `@expo-google-fonts` bundles Inter
  and Fraunces into the app rather than fetching them from Google at runtime, so not even
  a font request leaks a user's IP to a third party. Nothing on the page can set a cookie
  you did not write.
- **Row-level security is on** across the schema, with dedicated security tests in
  `supabase/tests/`. That is better than most funded startups.
- **Accessibility was already half-done**: 113 `accessibilityLabel`, 186
  `accessibilityRole`, 28 `accessibilityState`. See **A1** for what was actually broken.

---

## P0 — before you take money or launch publicly

### H1 · California's medical-information law may treat you as a healthcare provider
**Severity: P0 · Needs a lawyer · This is the most important item on the page**

California Civil Code § 56.06(b) deems *any business offering software to consumers that
is designed to maintain medical information* to be a "provider of health care" subject to
the Confidentiality of Medical Information Act — regardless of size, revenue or intent.

Your schema maintains `sleep_logs`, `stress_assessments`, `posture_assessments`,
`breathing_assessments`, `movement_assessments`, `baseline_profiles`, `hydration_logs`,
`daily_checkins`, heart-rate check-ins, body weight and height, plus
`allostatic_load_scores` and `readiness_scores` derived from them. Whether that is
"medical information" — statutorily, information about a patient's "medical history,
mental or physical condition, or treatment" — is a genuine legal question I cannot answer.
It is clearly arguable, and the app's own framing of readiness as a movement *diagnostic*
(internal docs) would be used to argue it.

Why it matters: CMIA carries **statutory damages of $1,000 per violation for negligent
disclosure with no proof of harm required** (§ 56.36(b)). Per person. That arithmetic is
what makes this the top item.

**Action:** one hour with a California healthcare-privacy attorney, asking exactly:
*does § 56.06(b) reach this product, and if so what do we have to do?* Bring them the
table in `privacy.html` §2 — it is a complete data inventory, which is most of what they
would otherwise bill you to assemble.

### H2 · The FTC Health Breach Notification Rule already applies to you
**Severity: P0 to understand, P2 to act · No lawyer needed yet**

16 CFR Part 318, as amended in 2024, covers health apps that are *not* HIPAA-covered —
which is you. The trap is the definition of "breach": it includes **any unauthorised
disclosure**, not just a hack. The FTC used this to fine GoodRx $1.5M and to act against
Premom, in both cases for **sending health data to advertising platforms**.

Right now you have no ad tech, so your risk is near zero. The rule matters because of what
it makes expensive later:

> **The day you add Google Analytics, a Meta Pixel, or any marketing tag to the app or to
> a marketing site that touches user health data, you create FTC exposure that did not
> exist the day before.**

**Action:** none today. Treat "add analytics" as a decision that needs a privacy review,
not a ticket. If you want product analytics, self-hosted or a processor under contract
with no ad-network affiliation, and disclose it first.

### L1 · Decide whether you sell in the EEA and UK — before you list, not after
**Severity: P0 as a decision**

Health data is Article 9 "special category" data under GDPR. Offering the app to people in
the EEA or UK triggers: explicit consent or another Article 9 basis, a lawful basis for
each purpose, a Data Protection Impact Assessment (near-certainly required for
large-scale special-category processing), records of processing, data-subject rights
machinery, 72-hour breach notification, a transfer mechanism for US hosting, and an
Article 27 EU representative since you have no EU establishment.

That is months of work and real money.

**Recommendation: launch United States only.** Restrict App Store and Play availability
by territory. This is a normal, respectable de-risking move, and it is the one control
that actually works — a disclaimer on a website does not stop GDPR applying if you are
selling into the EU. The policies I wrote say US-only; if you change that, they need
rewriting first.

### L2 · Form an entity
**Severity: P0 · Not strictly legal compliance, but the cheapest risk reduction here**

Without an LLC or corporation, `{{LEGAL_ENTITY}}` (see the fill-in doc) is your personal name, and a claim
arising from exercise-related injury or a mishandled health record reaches your personal
assets. For an app that prescribes physical activity to strangers, this is the first thing
to fix. California LLC filing is roughly $70 plus the $800 annual franchise tax.

---

## P1 — before public launch

### A1 · Two WCAG failures, in California, the venue for accessibility suits
**Severity: P1 · FIXED in this change — read why it mattered**

California's Unruh Civil Rights Act provides **statutory damages of $4,000 per
violation**, and California is the leading venue for web accessibility litigation. The
construction standard courts and the DOJ look to is WCAG 2.1/2.2 Level AA. Two theme
colours failed it:

| Token | Was | Contrast | Now | Contrast |
| --- | --- | --- | --- | --- |
| `textFaint` / `textSubtle` — captions, 73 usages | `#6E6E73` | **3.06:1** on `surfaceMuted` (needs 4.5) | `#8E8E93` | 4.75:1 worst case |
| `primary` — button fill under white label | `#0A84FF` | **3.65:1** for its own label | `#0071E3` | 4.70:1 |
| `accent` — text and icons | `#0A84FF` | **4.25:1** on `surfaceMuted` | `#1E90FF` | 4.79:1 worst case |

Note the second row: `#0A84FF` is Apple's own dark-mode system blue, and Apple's buttons
have the same problem. That is not a defence — a plaintiff does not care what Apple does.

**Locked in** by `tests/styles/contrast.test.ts`, which computes ratios from the theme
values against all four surfaces and fails the build naming the token, the ratio and the
surface. Reverting a colour now breaks CI.

**Still open** (listed honestly in `public/legal/accessibility.html`): charts are not
screen-reader explorable, the sleep-chart scrubber is drag-only, dark theme only, English
only. Each has a non-visual path to the same information, which is the thing that matters
most; none is a clean AA pass.

### A2 · Accessibility statement with a working contact
**Severity: P1 · DONE**

`public/legal/accessibility.html`. Having one, naming the standard, listing known gaps
honestly and giving a monitored contact with a response commitment is standard
mitigation — it demonstrates good faith and gives a complainant somewhere to go before a
lawyer. The honest "where we fall short" list is deliberate: a false claim of full
conformance is worse than a candid partial one.

### F2 · Never say "HIPAA compliant"
**Severity: P1 · Warning**

You are not a HIPAA covered entity or business associate. Claiming HIPAA compliance —
in marketing, a store listing, or a pitch deck — would be a false statement of a material
fact and actionable under FTC Act § 5. Say what is true: row-level security, encryption in
transit, no data sales, no advertising. `privacy.html` §9 states the HIPAA position
plainly so you never have to improvise it.

### R1 · Open Food Facts is share-alike licensed, and you cache it
**Severity: P1 · Possible lawyer question**

Open Food Facts data is licensed under the **Open Database License (ODbL) v1.0** — a
copyleft licence — with contents under DbCL and product photographs under **CC BY-SA 3.0**.
You have a `canonical_product_cache` table and a `user_food_products` table holding
records derived from it, and `ProductThumbnail.tsx` displays OFF-hosted photos.

Two obligations, one clear and one not:

1. **Attribution — now satisfied.** `public/legal/attributions.html` names the source and
   the licence for the database, contents and photos. `FoodEntryPicker.tsx:121` already
   credited OFF and USDA in the UI, which was a good instinct.
2. **Share-alike — genuinely unresolved.** ODbL § 4.4 requires that if you publicly use a
   *derivative database*, you offer it under ODbL. Whether your cache plus scoring
   constitutes a derivative database that you "publicly use", or merely a produced work
   from it, is a real open question. Many commercial apps rely on the produced-work
   reading. I cannot tell you it is safe.

**Action:** ask the attorney this as a second question in the same hour as **H1**. The
cheap alternative if the answer is uncomfortable: lean harder on USDA FoodData Central,
which is public domain, and treat OFF as display-only without persistent caching.

### R3 · Keep CHEK Institute material out of what ships
**Severity: P1 · Discipline, not a fix**

The repo currently references CHEK concepts **only in code comments**
(`navigationModel.ts:5`, `mood.tsx:21`, `practiceModel.ts:10`, `ingredientLexicon.ts:21`).
That is fine — ideas and methods are not copyrightable, and comments do not ship to users.

What must not happen:

- **Verbatim questionnaire wording** from the HLC Level 1 document. Copy the *structure*,
  write your own questions.
- **Exercise cueing text or illustrations** from the Zone Exercises material.
- **The marks "CHEK", "HLC", "Holistic Lifestyle Coach", "C.H.E.K Institute"** in app copy,
  marketing, or store listings. These are very likely trademarks, and using them implies a
  certification or affiliation you do not have. That is a trademark problem on top of a
  copyright one.

`terms.html` §9 already includes a no-affiliation statement. If you ever want to reference
the framework commercially by name, that is a licensing conversation with the CHEK
Institute, not a fair-use judgement call.

### C2 · CalOPPA — the one that applies to you with no threshold
**Severity: P1 · DONE, but worth naming so your attorney sees it was considered**

Most privacy statutes have size thresholds you do not meet. **CCPA/CPRA almost certainly
does not apply to you yet** — it requires revenue over ~$25M (CPI-adjusted), or buying,
selling or sharing the personal information of 100,000+ consumers a year, or deriving 50%+
of revenue from selling or sharing it. None of those describe you today.

**CalOPPA has no threshold at all.** Cal. Bus. & Prof. Code § 22575 requires any
commercial website or online service collecting personally identifiable information from
California residents to conspicuously post a privacy policy containing: the categories of
PII collected, the categories of third parties it is shared with, the process for a
consumer to review and request changes, how policy changes are announced, the effective
date, and a disclosure of how the service responds to Do Not Track signals.

`privacy.html` was written to satisfy each of those — §2, §6, §8, §15, the date in the
masthead, and §14 respectively. The DNT section is the element most sites miss.

`privacy.html` §9 also answers CCPA's substantive obligations voluntarily, which costs
nothing (you do not sell or share, so there is nothing to build) and means the policy does
not need rewriting on the day you cross a threshold.

### C1 · Cookie consent — the answer is no, and here is why
**Severity: P1 as a documented decision · DONE**

**You do not need a cookie banner.** The reasoning, so you can defend it:

- There are no cookies. Nothing in the codebase writes one.
- What *is* stored — one auth token, an onboarding flag, a weight-unit preference, saved
  routines, breath sessions, demo data — is either strictly necessary or a preference the
  user set. Both are exempt from the ePrivacy consent requirement, which does cover
  `localStorage` as "storage on terminal equipment", not just cookies.
- CCPA does not work through consent banners at all. It is notice plus a right to opt out
  of sale or sharing. You do neither, so there is nothing for a banner to toggle.
- Your host may set Cloudflare's `__cf_bm` bot-management cookie. That is a security
  function, universally treated as strictly necessary. Disclosed in `cookies.html`.

A banner would actively mislead, by implying there is hidden tracking to decline.
`public/legal/cookies.html` lists every stored key by name instead, which is both more
useful and more credible.

**Revisit the moment you add any third-party script.**

---

## P2 — before scale, or when a trigger fires

### H3 · Washington My Health My Data Act — the one with a private right of action
**Severity: P2, rising to P1 if you market outside California**

MHMD applies to entities that do business in Washington *or target Washington consumers*,
and collect "consumer health data" — defined broadly enough to include sleep, exercise,
diet, vital signs **and inferences about health**, which is exactly what your scores are.
It requires a **separate** consumer health data privacy policy, **opt-in consent before
collection**, separate consent before sharing, written authorisation to sell — and,
unusually, it is **enforceable by private lawsuit** through the Washington Consumer
Protection Act. Nevada's SB 370 is similar without the private right of action.

**Mitigated by design rather than by geoblocking.** Rather than run two standards, I built
the signup consent to the MHMD bar for everyone:

- Health-data consent is a **separate, unticked checkbox**, not bundled into the terms
  acceptance — bundling is the specific thing MHMD forbids. See
  `src/features/legal/SignupConsent.tsx`.
- Consent is recorded per item in `user_consents` with a version string, by
  `supabase/migrations/0019_signup_consent_capture.sql`.
- `privacy.html` §10 is the separate consumer-health-data section, stating no sale ever.

**Remaining:** if Washington becomes a meaningful market, have counsel confirm §10 is
sufficient as a standalone policy rather than a section.

### D1 · Food search terms travel in a URL and land in edge logs
**Severity: P2 · Accepted with reasoning, not fixed**

`src/server/foodSearch.ts:56` reads the query from `?q=`, and `wrangler.jsonc` has
`observability: { enabled: true }`, so search terms appear in Cloudflare request logs.
Search terms can be health-adjacent — "gluten free bread", "diabetic snacks".

Why I did not switch it to POST: the endpoint uses the Cloudflare Cache API
(`foodSearch.ts:60`), which only caches GET. Moving to POST would silently drop edge
caching and increase both latency and your USDA quota burn.

Why the current design is defensible: **the endpoint is unauthenticated and receives no
account identifier**, so logs hold an IP and a search term with no user attached. That is
a genuine privacy property of the existing design, not an accident, and it is disclosed in
`privacy.html` §4 and §6.

**Action:** set Cloudflare log retention to the minimum you can operate with. If you later
decide the residual risk is unacceptable, move to POST and accept the cache loss.

### D2 · Data minimisation — two real wins
**Severity: P2 · One done, one pending**

- **Full date of birth.** `profiles.date_of_birth` is a full `date`. Age-adjusting a
  heart-rate range needs a *year*. A full DOB is a strong identifier and a common
  identity-theft input. The policies I wrote say you collect **birth year**, so either
  change the column to `birth_year int` or correct `privacy.html` §2. **I did not migrate
  this** — it touches existing data and onboarding, and it is your call. *Pending.*
- **AI free text.** `ai_messages` and `ai_context_snapshots` are the highest-sensitivity
  rows in the schema. `privacy.html` §7 commits to **90 days**, which currently nothing
  enforces. Needs a scheduled deletion job. *Pending.*

### S1 · Subscriptions — California's auto-renewal law, and who actually holds the money
**Severity: P2 · Fires when you charge**

No payment code exists yet, so nothing is wrong today. Two things to get right:

1. **California's Automatic Renewal Law** (Bus. & Prof. Code § 17600 et seq., amended by
   AB 2863 effective 2025) requires clear pre-purchase disclosure of renewal terms,
   affirmative consent to those terms specifically, a post-purchase acknowledgement with
   cancellation instructions, and — the part people get wrong — **cancellation by the same
   medium used to sign up, in at most a couple of steps, with no retention obstacles.**
   `terms.html` §6 is written to this standard.
2. **A precision worth having:** the FTC's federal "click-to-cancel" Negative Option Rule
   was **vacated by the Eighth Circuit in July 2025**, so it is not in force. Do not rely
   on that. California's ARL is fully in force, the FTC can still act under § 5 and ROSCA,
   and California's requirements are stricter than the vacated federal rule anyway.
3. **You cannot promise refunds on app-store purchases.** With Apple or Google IAP they
   are the merchant of record; they hold the money and their policy governs. A "no
   refunds" clause that Apple overrides is both false and an App Store policy problem.
   `refunds.html` handles this by routing by purchase channel rather than pretending.

### F1 · Claims discipline, and the word "diagnostic"
**Severity: P2 · Ongoing discipline**

The FTC's Health Products Compliance Guidance requires **competent and reliable scientific
evidence** for health claims, generally human clinical evidence for anything
disease-related. Separately, FDA's General Wellness guidance keeps low-risk wellness
products outside device regulation **only while they avoid claims to diagnose, cure,
mitigate, prevent or treat a specific condition**.

The code is disciplined. The risks are in words that have not been written yet:

- **"Diagnostic"** — used in internal docs about the readiness score. It must never reach
  user-facing copy, marketing or a store listing. It is close to the exact phrase that
  moves a wellness app into FDA device territory.
- **"Clinically validated" / "clinically proven"** — you have no clinical trial.
- **The 0.932 rank correlation** in `docs/product-scoring-calibration.md` is an internal
  calibration figure against a reference. It is **not** "93% accurate" and must never be
  marketed as such.
- Avoid: improves sleep, reduces stress, lowers blood sugar, prevents anything, boosts
  immunity, detox.
- Safe register: "general wellness", "guidance", "estimate", "based on what you logged".

### F3 · Fake reviews are now a per-violation penalty
**Severity: P2 · Nothing wrong today**

The FTC's Rule on the Use of Consumer Reviews and Testimonials (16 CFR Part 465, effective
October 2024) prohibits fake or AI-generated reviews, buying positive reviews, undisclosed
insider reviews, and review suppression, with civil penalties **per violation** in the tens
of thousands of dollars. There are none in the codebase. When you add testimonials: real
people, permission in writing, disclose any incentive, never suppress the negative ones,
and follow the Endorsement Guides (16 CFR Part 255) for influencers.

### R4 · Grading named brands — the Yuka problem
**Severity: P2 · Manageable, and your UI is already the defence**

The app gives named products letter grades — Doritos an F, Coca-Cola a 25. This is
product disparagement / trade libel territory. Yuka was sued in France by a food trade
group over exactly this.

In the US, opinion based on **disclosed facts** is strongly protected, and here is the good
news: `ProductVerdict.tsx` and `explain.ts` show the mechanism behind every score — the
ingredients named, the reasoning stated. **That is not just good UX, it is the legal
defence.** An opinion that shows its work is protected in a way a bare grade is not.

To keep it: publish the methodology publicly, never state a false *fact* about a product,
frame scores as Healthi's own assessment (`terms.html` §3.1 does), and have a correction
route (`attributions.html` does). Brand names for identification are nominative fair use;
never imply endorsement.

---

## P3 — know about it

### L3 · California Age-Appropriate Design Code is in litigation
Partially enjoined in *NetChoice v. Bonta*; the Ninth Circuit upheld the injunction as to
the DPIA provisions. Do not build to it and do not assume it is dead. **An 18+ age gate
largely sidesteps the question**, which is one more reason for the next item.

### L4 · The 18+ limit is a safety decision, not just a COPPA one
COPPA's verifiable-parental-consent regime for under-13s is impractical for you, so a
minimum age was always necessary. I set **18**, not 13, and the reason is in
`privacy.html` §12: an app that grades food, counts calories and prescribes training is a
genuine hazard for a teenager with disordered eating. 18+ also sidesteps state
minor-design codes and the GDPR 13-to-16 consent-age patchwork. Enforced at signup by
declaration, which is the industry norm — you are not required to verify.

### L5 · Fonts are fine
Inter and Fraunces are both SIL Open Font License 1.1. Commercial use and app bundling are
permitted; the licence must be retained, which `attributions.html` does. Ionicons is MIT.
No action.

### R2 · Confirm you own the app icons
Four PNGs in `public/icons/`. If you drew them or had them made under a work-for-hire
agreement, fine. **If they came out of an image generator or a template site, check the
licence covers commercial use and trademark registration** — some explicitly do not.
Thirty seconds of your memory; I cannot verify it from the files.

---

## What was changed in this commit

**New — public legal pages** (static HTML under `public/legal/`, no JavaScript, keyboard
navigable, contrast-checked in both light and dark, printable):
`index.html` · `privacy.html` · `terms.html` · `cookies.html` · `refunds.html` ·
`accessibility.html` · `attributions.html` · `legal.css`

Static rather than app routes on purpose: an App Store reviewer, a crawler and someone
with JavaScript off all need to read a privacy policy without booting a React app.

**New — in-app:**
- `src/features/legal/SignupConsent.tsx` — two separate unticked consents on signup, with
  inline links, an accessible error region, and no pre-ticked boxes
- `src/components/CheckBox.tsx` — `accessibilityRole="checkbox"` with checked state, 44pt
  row target, drawn tick so state does not wait on a glyph
- `src/features/legal/LegalLinks.tsx` — the six policies in Settings, plus a standing "not
  medical advice / call 911 / text 988" notice
- `src/features/legal/consentModel.ts`, `legalDocuments.ts`, `legalLinks.ts`
- `src/styles/contrast.ts` — WCAG luminance and ratio maths
- `src/styles/tokens.ts` — theme values split out react-native-free so they are testable

**Changed:**
- `src/styles/tokens.ts` — three contrast fixes (**A1**), applied app-wide including five
  files that had hardcoded copies of the failing values
- `app/(auth)/signup.tsx` — consent gate checked before the request, so no account is
  created without a record of what its owner agreed to
- `src/features/auth/AuthProvider.tsx` — `signUp` carries a consent record
- `supabase/migrations/0019_signup_consent_capture.sql` — extends the existing
  `handle_new_user` trigger to write `user_consents`. It had to be the trigger: with email
  confirmation on there is no session at signup, so RLS would reject a client insert and
  the record of consent would be the one thing missing
- `public/index.html` — `user-select: none` on chrome, `text` on inputs
- `.env.example` — `EXPO_PUBLIC_SITE_URL`

**Tests:** 1,046 → 1,071. `tests/styles/contrast.test.ts` (18) and
`tests/features/legal/consentModel.test.ts` (7). The contrast test was verified to fail on
the old colours before being accepted.

**Deliberately not done:**
- `date_of_birth` → `birth_year` (**D2**) — touches live data and onboarding, your call
- AI retention job (**D2**) — the policy commits to 90 days, nothing enforces it yet
- No payment, refund or subscription code — **S1** applies when you write it

---

## The shortest path from here

1. Form the entity (**L2**) and decide US-only (**L1**).
2. Fill in `docs/legal/FILL-IN-BEFORE-LAUNCH.md`.
3. One hour with a California healthcare-privacy attorney: **H1** (CMIA), **R1** (ODbL
   share-alike), plus a read of `terms.html` §§2, 3, 13, 14. Bring them this file and the
   data table in `privacy.html` §2 — that is the expensive part already done.
4. Ship. Revisit **H2** before you ever add analytics, and **S1** before you charge.
