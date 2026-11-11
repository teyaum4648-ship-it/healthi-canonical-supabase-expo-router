# Fill these in before the policies go live

Every placeholder below appears in `public/legal/*.html` wrapped in `{{ }}` and is styled
with an orange `.fill` highlight, so an unfilled one is impossible to miss on the page.
Nothing here can be guessed for you: an invented address or an entity that does not exist
is worse than no policy at all, because it is a false statement in a document people rely
on.

Find them all: `grep -ro '{{[A-Z_]*}}' public/legal/ | sort -u`

## Minimum public iOS v1 launch decisions (verified 2026-11-10)

- **Confirmed:** Supabase project `lhqpexnepgvuohmhltnr` is hosted in AWS `us-east-2` (Ohio). The privacy draft now states this directly.
- **Not confirmed:** the actual legal operator and safe public mailing address. Individual Apple Developer enrollment is not proof that an LLC operates the service. Use the actual operator and a postal address you're comfortable publishing, and check what law requires.
- **Not confirmed:** working public support/privacy/security/legal/accessibility inboxes. They can route to one inbox, but test delivery. Do not invent email aliases.
- **Not confirmed:** backup, technical-log, and legal-record retention periods. Confirm these before making a retention promise.
- **Not decided:** first-release pricing. The current terms/refunds describe subscriptions and direct web sales even though the repository has no subscription checkout. If v1 is a paid App Store download, revise those statements to match that model and Apple's actual refund process before publishing.
- **Publishing destination:** `https://daywovenapp.com/legal/privacy.html` and `/legal/terms.html`. They must resolve to these *full app* policies, not just the newsletter privacy page.
- **Release gate:** do not deploy these drafts or submit the app with `{{PLACEHOLDERS}}` or unverified claims. Review health-data privacy obligations and Apple disclosures for the actual launch territory.

## The placeholders

| Placeholder | What it is | Notes |
| --- | --- | --- |
| `{{LEGAL_ENTITY}}` | The name that is actually liable | If you have not formed an LLC, this is your own legal name and you are personally liable. For a health app, forming an entity is the single cheapest risk reduction available. California LLC: ~$70 filing, plus the $800 annual franchise tax. |
| `{{BUSINESS_ADDRESS}}` | A postal address | **Do not use your home address.** It ends up in App Store listings, WHOIS and every policy page. Use a registered agent, a virtual mailbox, or a PO box. |
| `{{EFFECTIVE_DATE}}` | The date the policies take effect | Use one date across all six pages. Format: `January 1, 2027`. |
| `{{PRIVACY_EMAIL}}` | Privacy requests | A real monitored inbox. `privacy@` is conventional. |
| `{{SUPPORT_EMAIL}}` | Support and refunds | `support@` |
| `{{SECURITY_EMAIL}}` | Vulnerability reports | `security@` |
| `{{LEGAL_EMAIL}}` | Legal notices, arbitration opt-outs | `legal@` |
| `{{ACCESSIBILITY_EMAIL}}` | Accessibility barrier reports | Can alias to support, but it must be listed separately — that it exists is part of the defence. |
| `{{SUPABASE_REGION}}` | Where the data physically sits | **Verified:** the connected Daywoven Supabase project is in AWS `us-east-2` (Ohio). This is already filled in within the privacy draft. Recheck if hosting changes. |
| `{{PAYMENT_PROCESSOR}}` | Only if you sell directly from the web | Delete the clause entirely if you only sell through Apple and Google. |

All five addresses may forward to one inbox. They must all actually receive mail — a
bounced privacy request is a compliance failure on its own.

## Also set

- `EXPO_PUBLIC_SITE_URL` in your environment (see `.env.example`). Without it, the
  in-app links on a **native** build degrade to plain text. The web export is fine either way.

## Two decisions only you can make

1. **Do you want the arbitration clause?** `terms.html` §14 has one, consumer-friendly by
   the standards of these things: a 30-day opt-out, a small-claims carve-out, we pay fees
   under $10,000, and a *McGill* carve-out for public injunctive relief (without which the
   whole clause is unenforceable in California). It is standard and it protects you from
   class actions. Some founders dislike it on principle. Deleting §14 leaves §14.6 —
   San Diego courts — as the fallback, which is a coherent position.
2. **Where will you sell?** See the EEA/UK question in `RISK-REGISTER.md`. The answer
   changes how much work launch is by a large factor.

## Before you publish

- [ ] Every `{{PLACEHOLDER}}` replaced — the grep above returns nothing
- [ ] All five email addresses receive mail
- [ ] A lawyer has read `terms.html` §§2, 3, 13 and 14 and `privacy.html` — see the
      register for why these specifically
- [ ] `EXPO_PUBLIC_SITE_URL` set in the build environment
- [ ] `docs/legal/RISK-REGISTER.md` items L1 and L2 resolved
