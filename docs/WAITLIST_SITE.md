# The waitlist site (daywovenapp.com)

The front page of daywovenapp.com is a waitlist page. It is where the QR codes in the ads
land, and the place to collect sign-ups before the app is in the stores.

## What is where

| Piece | File |
| --- | --- |
| The page (HTML, CSS and JS in one file, fonts self-hosted, no trackers or cookies) | `public/welcome/index.html` |
| Screenshots, share image, fonts | `public/welcome/img/`, `public/welcome/fonts/` |
| `POST /api/waitlist`: validation, honeypot, same-origin check, per-address limit | `src/server/waitlist.ts` |
| Routing: `/` serves the page; every other path is still the web app | `src/server/foodSearch.ts` (the Worker entry) and `wrangler.jsonc` |
| Storage: `waitlist_signups` and the `join_waitlist` function | `supabase/migrations/0022_waitlist_signups.sql` |
| Privacy notice (linked from under the form) | `public/legal/privacy.html#waitlist` |
| Tests | `tests/server/waitlist.test.ts` |

The table cannot be read or listed from a browser: RLS is on with no policies, and anon has
no table privileges. The only way in is `join_waitlist`, which returns the same answer for a
new or a repeat address, so the form cannot be used to check whether someone signed up.

## Going live

1. `supabase db push` (applies `0022_waitlist_signups.sql`).
2. Give the Worker the project URL and the public anon key:
   `npx wrangler secret put SUPABASE_URL`, then `npx wrangler secret put SUPABASE_ANON_KEY`.
3. `npm run build:demo && npx wrangler deploy`.
4. In Cloudflare, attach the custom domain `daywovenapp.com` to the `healthi-demo` Worker.

Until step 2 is done, the form answers "Something went wrong on our side", and nothing is lost
silently.

## Tracking which ad worked

Add `?src=` to any link or QR code, for example `https://daywovenapp.com/?src=tank-ad`. The tag
is saved with the sign-up (lowercase letters, numbers, `-` and `_`, up to 40 characters). It is
the only attribution there is: no cookies, no pixels, no analytics.

## Reading the list

Supabase dashboard → Table editor → `waitlist_signups`, or export it as CSV. People who have
unsubscribed have `unsubscribed_at` set; leave them out of every send.

Before the first email goes out, choose an email service, add it to the processors table in
`privacy.html` §6, and make sure every message has a working unsubscribe link. US law
(CAN-SPAM) requires one, and the waitlist notice promises it.
