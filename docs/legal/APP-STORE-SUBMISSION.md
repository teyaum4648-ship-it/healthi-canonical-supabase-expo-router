# App Store submission and California compliance

What the app now does to pass App Review and meet California law, what has to be deployed
for it to work, and what only you can finish. Read with `FILL-IN-BEFORE-LAUNCH.md` and
`RISK-REGISTER.md` in this folder.

## Done in the code

| Requirement | Where it comes from | What the app does |
| --- | --- | --- |
| Delete the account from inside the app | App Store 5.1.1(v); CCPA right to delete; CMIA | **Menu (three-line tab) → Your data and account → Delete account**, which opens the panel straight away. The same panel is also under Profile and preferences. There is one confirmation step, and it says exactly what will be deleted. Runs `supabase/functions/delete-account`, which deletes the auth user; every user table cascades from it. The device's copies for that account are cleared too. |
| Get a copy of your data | CCPA right to know and portability; CMIA access | **You → Your data and account → Export my data**. Runs `supabase/functions/export-account`, which returns every row in the 66 user-owned tables (`supabase/functions/_shared/userDataTables.ts`) plus this device's entries, as one JSON file through the share sheet (or a download on the web). A test fails if a migration adds a user table that the export misses. |
| Ask before personal data goes to a third-party AI | App Store 5.1.2(i) | Before the first meal-photo estimate, the photo sheet shows who receives the photo (Anthropic), what is sent and what is not, and asks. No camera until the answer is yes. The answer is stored in `user_consents` as an append-only log, and `photo-estimate` refuses any photo without a current yes, so the server enforces it even if the app is bypassed. You can turn it off under **Your data and account**. |
| Privacy manifest | Apple's required-reason API rule (since May 2024) | `ios.privacyManifests` in `app.config.ts`: no tracking, no tracking domains, the collected data types, and reasons for UserDefaults, file timestamps, boot time and disk space. |
| Only the permissions the app uses | App Review 5.1.1(i)–(iv) | Camera, Photo Library and Health (read only), each with a specific purpose string. The microphone and Face ID strings that plugins add by default are switched off. |
| Export compliance | US export rules; App Store Connect asks on every upload | `ITSAppUsesNonExemptEncryption = false`: the app only uses HTTPS and the iOS keychain. |
| HealthKit rules | App Review 5.1.3, HealthKit guidelines | Read only (sleep and steps), never written, no background delivery. The privacy policy now says what the HealthKit guidelines require: no advertising, no data mining, no sale, no disclosure without permission, nothing in iCloud. Settings names Apple Health where you connect it. |
| Medical claims | App Review 1.4.1; FTC | A "not medical advice" notice, with 911 and 988, under **Legal and privacy**. Scores carry confidence levels and use "general wellness guidance" wording. |
| iPhone only | Avoids review on iPad layouts the app was not designed for | `supportsTablet: false`. The iPhone app still runs on iPad in compatibility mode. |
| Privacy policy reachable from the app | App Review 5.1.1(i); CalOPPA | **Legal and privacy** in Settings, plus links at signup. Native builds need `EXPO_PUBLIC_SITE_URL`, which `eas.json` now sets to `https://daywovenapp.com` for preview and production builds. |
| California rules in the policy | CCPA/CPRA, CalOPPA, CMIA § 56.06, Shine the Light § 1798.83 | `public/legal/privacy.html` §9 already covered CCPA and CalOPPA. It now also covers CMIA (we act as if it applies), Shine the Light, and the exact in-app paths to export, delete and withdraw consent. |

## Deploy before the build goes to review

Order matters: the database first, then the functions, then the app.

1. `supabase db push`. This applies `0021_privacy_controls.sql`, which lets a signed-in person insert and read their own consent rows and privacy events. Insert and select only, so consent stays an append-only log.
2. `supabase functions deploy delete-account export-account photo-estimate`
3. In EAS (`eas env:create` or the EAS website), set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the production environment. Never put them in `eas.json`.
4. Make sure `https://daywovenapp.com/legal/privacy.html` loads. App Store Connect asks for the privacy policy URL, and the in-app links point there.
5. `eas build --platform ios --profile production`, then `eas submit --platform ios`.

## App Store Connect answers

**App Privacy label.** This must match `ios.privacyManifests`; change both together.

| Data type | Collected | Linked to you | Tracking | Purpose |
| --- | --- | --- | --- | --- |
| Health | Yes | Yes | No | App Functionality |
| Fitness | Yes | Yes | No | App Functionality |
| Email Address | Yes | Yes | No | App Functionality |
| Name (optional first name) | Yes | Yes | No | App Functionality |
| User ID | Yes | Yes | No | App Functionality |
| Photos | Yes, only when you choose a photo estimate | No | No | App Functionality |

Everything else, including location, contacts, browsing history, identifiers for advertising, diagnostics and analytics: **not collected.** "Used to track you": **No.**

**Age rating.** Answer the questionnaire as it is. Medical or treatment information: *Infrequent/Mild*. No user-generated content is shared with other people, and there is no web browsing. Separately, the Terms require people to be 18 or older, and signup asks them to confirm it.

**Review notes** (paste into App Review Information, then fill in the account):

> daywoven is a general wellness app, not a medical device. It does not diagnose or treat.
> Demo account: `<reviewer email>` / `<password>`. The account is already confirmed and onboarded.
> Account deletion: tap the Menu tab (three lines) → "Your data and account" → Delete account.
> Apple Health: read-only sleep and steps, connected from the Menu tab → Extensions. It is optional, and the app works without it.
> Meal photo estimates ask for permission before any photo is sent to our AI provider (Anthropic). Barcode scan and search work without it.

The reviewer account has to be **email-confirmed already**. With confirmation turned on, a fresh signup cannot log in until someone clicks the email link. Create the account, confirm it, finish onboarding, then hand it over.

## Only you can finish these

- [ ] **Fill every `{{PLACEHOLDER}}` in `public/legal/*.html`**: legal entity, business address, effective date, and the privacy, support, security, legal and accessibility emails. A privacy policy with blanks in it gets rejected under 5.1.1, and an invented address would be a false statement. `grep -ro '{{[A-Z_]*}}' public/legal/ | sort -u` must return nothing.
- [ ] **Confirm the bundle ID.** `com.daywovenapp.daywoven` is the default. If App Store Connect already has a different one, set `IOS_BUNDLE_IDENTIFIER`; the ID is permanent after the first upload.
- [ ] **Turn on HealthKit** for that App ID in the Apple Developer portal. EAS does this when it manages your credentials.
- [ ] **Create the confirmed reviewer account** described above.
- [ ] **Have a lawyer read it.** One hour with a California health-privacy attorney, using RISK-REGISTER H1 (CMIA) and the terms sections listed in `FILL-IN-BEFORE-LAUNCH.md`. This document is engineering work, not legal advice.
- [ ] **If you ever charge money:** inside the app it must go through Apple In-App Purchase (guideline 3.1.1), and California's Automatic Renewal Law needs clear renewal terms and online cancellation (RISK-REGISTER S1). The app sells nothing today.
