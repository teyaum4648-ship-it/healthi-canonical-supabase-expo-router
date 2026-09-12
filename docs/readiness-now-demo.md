# Readiness Now — device-local demo v1

This is an experimental wellness estimate, not a physiological measurement or training clearance. It is mounted only for `mode === 'demo'`. Signed-in account Home, daily protocol generation, safety rules, Product Quality, and existing daily scoring weights remain unchanged. Native sleep collection, heart-rate interpretation, and push notifications are deferred.

## Evidence and freshness

- The daily engine now returns its existing four contributions as additive audit metadata. Its original score formula is unchanged.
- Home refreshes the clock every 30 seconds while focused and on foreground/visibility changes. No background service is created.
- At least two available foundations and a same-local-day, meaningfully answered check-in no older than two hours are required to show a current number. Missing legacy ledger data cannot produce a current number.
- A check-in alone never creates foundation records. All-skipped answers cannot refresh a score. Safety/professional guidance suppresses the current number.
- No food/water logs means unknown, not zero consumption. Unknown evidence lowers confidence and never introduces a deduction. Old morning check-ins are not displayed as current evening scores.
- Wake time is explicitly entered, with today/yesterday support. It is not inferred from opening the app or a suggested sleep schedule. Actual sleep duration continues to come from the existing sleep logs.
- Local midnight selects the new day's check-ins and logs; history is retained. A wake time on the preceding day supports overnight schedules.

## Bounded experimental contribution rules

The following are software demonstration rules, not validated biological thresholds:

| Freshly confirmed evidence | Domain contribution |
| --- | --- |
| No water, at least four hours since confirmed waking | Nourishment becomes the lesser of its existing value and -4 |
| No food, at least six hours since confirmed waking | Same Nourishment replacement; never an additional deduction |
| Tired right now | Movement Capacity becomes the lesser of its existing value and -5 |
| Demanding day | Mind + Life Load becomes the lesser of its existing value and -4 |

Earlier stronger domain limitations remain intact. Contributions never accumulate on timer ticks. Yes/steady answers do not add points. A new intake log supersedes an earlier "not yet" answer; conflicting actual logs since waking prevent a no-intake deduction. Future records are excluded. Once a check-in expires the public number is hidden, so expiry cannot imply recovery.

The estimate is the same baseline plus replaced domain contributions, bounded to 0–100. Every changed contribution appears in Why this estimate, alongside supporting factors, negative base factors, unknowns, before/after points, and internal reason codes. Confidence is at most moderate for this experimental model. The daily protocol remains a separate starting-point plan and is not recalculated by the new overlay.

## Reminders and privacy

Optional lunch reminders default off and appear only on Home. Users choose their usual lunch time and a 30/45/60-minute delay. Quiet hours are 21:00–08:00 local time. Recent meal logs or confirmations silence the reminder. Snooze lasts 30 minutes; Not today lasts until local midnight. Lunch time is a preference, never evidence of consumption. Log lunch opens the existing meal chooser, preserving unfinished drafts.

Check-ins and preferences use the versioned `healthi:demo:readiness-now:v1` key, explicitly owned by `demo-user`. No account records fall back into it. Corrupt/foreign records are preserved and reported instead of overwritten. Failed reads hide the number. Failed writes remain retryable. Clean demo reset clears this key. Nothing syncs to an account or collects data while away from the app.

## Verification / manual beta checklist

- Automated coverage: ledger reconciliation, missing data, morning/evening grace, stale/current states, conflict resolution, repeated ticks, safety, midnight, wake validation, reminders, failed storage, reset, and persistence.
- Device checks still needed: phone-size sheet scrolling, time wheels, cancel/save, VoiceOver, foreground after two hours, local midnight, and account/demo switching.
- Before broader release: validate/adjust the experimental contribution policy, decide how current guidance should reconcile with the daily protocol, and design account persistence with appropriate owner-scoped RLS. No native integration or automatic physiological claims should be inferred from this demo.
