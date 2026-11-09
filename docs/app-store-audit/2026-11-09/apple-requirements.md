# Official Apple submission evidence

Verified by browsing official Apple Developer pages on **2026-11-09**. These notes establish policy requirements; they do **not** verify Daywoven's signed archive, Apple account, backend deployment, or native runtime. Recheck the linked pages immediately before submission because Apple changes requirements.

## 1. Build and upload toolchain — REQUIRED

- Since **April 28, 2026**, uploads must be built using **Xcode 26 or later** and the **iOS 26 SDK or later**.
- Since **September 9, 2026**, iOS/iPadOS uploads must have a deployment target of **iOS 13 or later**. The minimum deployment target is distinct from the SDK used to compile; a build can support older devices than its SDK version.
- Do not claim a Linux JavaScript export or Expo prebuild is a signed iOS archive. The release still requires a macOS/Xcode build (directly or through an authorized cloud builder), signing, provisioning, successful Apple processing, and device testing.
- No later Xcode/SDK cutoff was listed in Apple's Upcoming Requirements page at research time. Avoid inventing a 2027 SDK deadline.

Sources: [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/), [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

## 2. Apple identity, app record, and distribution — REQUIRED

- The owner needs an active Apple Developer Program membership to distribute through the App Store. Apple lists an annual **US$99** fee, with local pricing and eligible fee waivers. Individual enrollment displays the individual's legal name; organization enrollment uses the legal entity and generally requires a D-U-N-S Number.
- Create the App Store Connect record with a name, primary language, registered Bundle ID, and internal SKU. The Bundle ID in the app record and signed binary must match; it cannot be changed on that record after a build is uploaded. Names are 2–30 characters; subtitle maximum is 30.
- A build is identified by its Bundle ID, version, and build string. Increment build strings for subsequent uploads.

Sources: [Program enrollment](https://developer.apple.com/help/account/membership/program-enrollment/), [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/), [Upload builds](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

## 3. Account deletion — REQUIRED IF ACCOUNT CREATION IS OFFERED

Apps supporting account creation must let users initiate deletion **within the app**. The option should be easy to find, typically in account settings. Deletion must cover the account and associated data not legally required to be retained; deactivation alone is insufficient. If completion happens on the web, link directly to the deletion page. Confirmation and identity checks may be used. If Sign in with Apple is used, revoke its tokens when deleting the account. A support email alone is not generally the account-deletion implementation Apple expects for an ordinary wellness app.

Source: [Offering account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/).

## 4. Privacy labels and health-data boundaries — REQUIRED

Provide accurate App Privacy answers for the shipping app, including relevant third-party partners. Apple defines collection for these labels as off-device transmission permitting the developer/partner to access data longer than necessary for a real-time request. On-device-only data is treated differently; functional server storage still counts even without advertising. Identify linkage to identity and purposes. Re-evaluate email/user IDs, cloud health/fitness records, uploaded photos, diagnostics, and provider requests against the **actual production mode**, not only the local demo. Do not select “Data Not Collected” because a demo happens to use local storage. Privacy Nutrition Labels, the in-app policy, and privacy manifests are related but separate artifacts.

Source: [App Privacy Details](https://developer.apple.com/app-store/app-privacy-details/).

For HealthKit, request only the types needed and supply precise purpose strings. Reading requires `NSHealthShareUsageDescription`; writing requires `NSHealthUpdateUsageDescription`. Missing usage descriptions can crash authorization requests. Users can deny individual read types, and the app cannot distinguish denied read access from no data. Add the HealthKit capability and test support before access.

Sources: [Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy), [Setting up HealthKit](https://developer.apple.com/documentation/healthkit/setting-up-healthkit).

## 5. Review-guideline checks — REQUIREMENTS, CONDITIONAL WHERE NOTED

The following is a concise summary of the current guidelines (section numbers included for precise review):

- **5.1.1(i):** accessible privacy-policy links in-app and App Store metadata; explain collection, uses, sharing, retention, deletion, and consent withdrawal.
- **5.1.2(i):** disclose personal-data sharing with third-party AI and obtain explicit permission first. Camera/photo permission alone is not AI-sharing consent.
- **5.1.3:** protect health data; no health-data advertising/mining, inaccurate HealthKit writes, or personal health information in iCloud.
- **4.8:** own email/password accounts alone do not trigger a second-login requirement. Social login generally requires an equivalent privacy-preserving option, subject to listed exceptions.
- **3.1.1–3.1.2:** digital feature unlocks/subscriptions generally require IAP, restorability where relevant, and clear terms. Regional external-purchase exceptions exist; avoid a universal claim that every external link is forbidden.
- **4.2:** provide meaningful app utility beyond a repackaged website.
- **2.1:** complete, working submission; review access to account-based features is required.

Source: [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

ATT is required for tracking as Apple defines it; it is not an automatic requirement for every network request or first-party login. Audit the actual SDKs/data flows before adding ATT or declaring tracking.

## 6. Privacy manifests and SDK signatures — REQUIRED WHERE APPLICABLE

A new app containing Apple's listed SDKs must include their required manifests. Binary distributions of listed SDKs also require signatures; SDKs repackaging listed code are covered. **Hermes** is explicitly on Apple's list. An arbitrary app-level manifest cannot substitute for missing SDK metadata/signatures. Inspect the **built archive** and Xcode aggregated privacy report rather than assuming every installed JavaScript package supplies its iOS manifest correctly.

Source: [Third-party SDK requirements](https://developer.apple.com/support/third-party-SDK-requirements/).

Apps/SDKs using required-reason API categories must declare an approved reason in `PrivacyInfo.xcprivacy`; the upload requirement began **May 1, 2024**. Do not invent reasons or copy an unrelated manifest without checking actual usage.

Sources: [Describing required-reason API use](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api), [Approved reasons requirement](https://developer.apple.com/news/upcoming-requirements/?id=05012024a).

## 7. Screenshots and metadata — REQUIRED

At research time Apple's current specification says:

- At least one screenshot for **iPhone with Dynamic Island (medium display)**. Accepted portrait dimensions listed are **1179×2556** or **1206×2622** (landscape equivalents accepted).
- If the binary supports iPadOS, at least one **13-inch iPad** screenshot; accepted portrait dimensions include **2064×2752** and **2048×2732**.
- 1–10 screenshots per device size; JPEG/JPG/PNG; no alpha/transparency. App Store Connect can scale suitable supplied screenshots to other displays.
- Capture the actual native production build on the target simulator/device. Existing landing-page images at 780×1688 are **not automatically compliant App Store screenshots** and do not establish native behavior.
- The page also mentions a future iPhone Duo screenshot rule from April 2027 for iOS 27.1 SDK builds. This is **not a current 2026-11-09 blocker** and should not be presented as already in force.

Source: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/).

Prepare truthful description, support URL/contact, privacy-policy URL, category, content rights, copyright, age rating, review contact/notes, availability, and pricing. Apple supplies a standard EULA unless replaced with a valid custom EULA. Metadata must reflect the actual release features, not planned integrations.

Source: [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/).

## 8. Age, medical status, regional declarations — REQUIRED WHEN APPLICABLE

- Answer the current age-rating questionnaire; it includes health/wellness content. A contractual minimum age and a calculated content rating are not interchangeable. An unrated app cannot be published on the App Store.
- The January 31, 2026 questionnaire-update deadline is already in force.
- On **November 16, 2026** two additional descriptors (Shared Location; Dating and Relationships) become available. All apps must complete them by **January 12, 2027**. Both dates are future relative to this audit; complete them when the actual submission date requires it.
- App Information docs require a **Regulated Medical Devices declaration** for Health & Fitness/Medical category apps available in the EU/EEA, UK, or US, or apps with frequent Medical/Treatment information. Completing the declaration does not itself establish that Daywoven is regulated; answer accurately based on its intended use and claims.
- EU distribution requires declaring trader/non-trader status; traders must provide the required verified public business contact details. Countries can impose further requirements; select intended storefronts intentionally.

Sources: [Set an age rating](https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/), [Upcoming Requirements](https://developer.apple.com/news/upcoming-requirements/), [New descriptors announcement](https://developer.apple.com/news/?id=yxkh08us), [App information](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/).

## 9. TestFlight and review access — REQUIRED WORKFLOW / RECOMMENDED VALIDATION

Upload the signed build, resolve processing/validation messages and export-compliance questions, then distribute internally through TestFlight. Apple allows up to 100 internal App Store Connect testers and 10,000 external testers; builds are available for up to 90 days. External beta distribution can require Beta App Review. TestFlight is the appropriate pre-release channel; publishing a beta as a finished App Store app is not the same workflow.

Source: [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/).

For review, provide working demo account credentials for account-based features and information about external services, intended audience, business model, devices/OS versions tested, and significant features. Ensure credentials work throughout review and account features can be reached. A local demo can help explain features but cannot prove that a separate account/backend mode works. If diagnostic/treatment claims are made, Apple may require regulatory clearance or substantiation; avoid claiming such functionality without the corresponding evidence.

Source: [Provide complete review information](https://developer.apple.com/help/app-review/before-submitting-for-review/complete-review/).

## 10. Encryption — REQUIRED DETERMINATION

Answer export-compliance questions for the final binary, including third-party encryption. Apple requires the developer to determine applicable classification/documentation. Ordinary HTTPS is not a reason to skip the determination. Set `ITSAppUsesNonExemptEncryption` only after reviewing actual use; do not guess a regulatory answer or insert a placeholder legal declaration automatically.

Source: [Export compliance overview](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance/).

## Recommendations rather than universal Apple mandates

A dedicated real-device release checklist, production/staging separation, offline/denied-permission tests, accessibility testing, crash monitoring with appropriate disclosures, server restore/deletion verification, dependency audits, and a rollback plan are strong release practices. A browser test or unit-test pass is not a substitute for native device tests. Paid cloud builds, credential creation, TestFlight uploads, and actual submission require the owner's explicit authorization in this task.
