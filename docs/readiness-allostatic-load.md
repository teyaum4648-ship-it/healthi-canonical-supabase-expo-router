# Readiness as allostatic load

## What is wrong with the score today

```
score = clamp(70 + Σ contributions, 0, 100)

  rhythm    (sleep)     −25 … +15
  nutrition             −10 …  +8
  movement              −15 … +12
  schedule              −10 …  +6
```

Everyone starts at **70**. A shift worker with a wrecked gut and a 34/66 stress burden
starts where a well-slept athlete starts, and the four domains then nudge that constant
around. The demo reads `85 / 100 · Demo signals · low confidence`, which is a number
about nobody.

This is the same shape as the food defect this codebase already fixed. A lemon-lime soda
scored 71 because it *lacked* preservatives and colours — the kernel started at a
constant and subtracted for what was absent. The fix was to score what the thing is
made of. Readiness needs the same correction: the starting point has to come from the
person rather than from a literal `70`.

## The reframe: readiness is the movement prescription

The HLC Level 1 questionnaire has no movement category, and that is not a gap in the
instrument. It is the shape of the whole model.

**Movement is the output, not a peer input.** The other pillars describe what is
spending you; movement is what you can afford to spend. The same session is medicine at
one load and harm at another, which is the only reason a readiness number is worth
computing at all. The owner's phrase for it: *don't shoot a cannon out of a canoe.*

So the model has three parts rather than four equal domains.

| | role | source |
| --- | --- | --- |
| **Capacity baseline** | who this person is before today | HLC categories, re-scored periodically |
| **Load** | what today and this week have spent | sleep, diet quality and timing, digestion, stress, and *yesterday's training* |
| **Prescription** | what movement this affords today | the output the Home hero should show |

Training sits on both sides on purpose: yesterday's session is load, today's answer is a
session. That loop is the product.

What Home says changes accordingly. `85 / 100 · Maintain` is a readout. The hero should
say what today affords and what is limiting it — the limiter is the useful half, because
it is the only part anything can be done about.

## Assessing, not guessing

The questionnaire is **not** an onboarding wall. Ninety-two questions asked at signup
would be a worse version of the problem it solves, and most of them ask the user to
estimate something the app is already holding.

Every scored item therefore carries a provenance, and observation outranks self-report:

| provenance | meaning | confidence |
| --- | --- | --- |
| `observed` | the app measured it over a real window | high |
| `reported` | the person answered it | medium |
| `inferred` | the app derived it and said so | medium, and correctable |
| `absent` | no basis yet | contributes nothing, counted openly |

The questions that are frequency-graded in the workbook — *once a week / 3× / more than
3×* — are the ones to take away from the user first, because a frequency is exactly what
a log measures better than a memory:

| item | measured from |
| --- | --- |
| Circadian Q3 — waking un-rested | sleep logs |
| Circadian Q8 — waking between 1 and 4 am | sleep window data |
| Circadian Q9 — sleepy after lunch | the energy curve already models this |
| Circadian Q4 — in bed after 10:30 pm | sleep window data |
| Food Time Q3 — skipping breakfast | meal timestamps |
| Food Time Q6 — sweet cravings within two hours | the post-meal response log |
| Food Time Q7 — caffeine and sugar drinks per day | logged products carry `caffeine_mg` |
| Digestive Q1, Q3, Q10 — bloating, constipation, heartburn | the evening check-in already asks about digestion |
| You Are What You Eat — most of it | the scanner already grades every packaged item |
| Stress Q1 — eating more or less under stress | meal logs against a stress reading |

A category is scored from whatever provenance is available, and the screen says which.
That is the same distinction the scanner already draws between a provisional grade and a
settled one, so there is no new vocabulary to teach.

## No data must not mean no score

The rule that follows from *assessing, not guessing*: **the app makes the effort so the
person does not have to.** A forgotten sleep entry currently drops rhythm consistency to
"Still calibrating" — it needs three complete nights and silently gives up without them.
That turns the product into a journal that punishes you for not writing in it.

Instead, infer the window, mark it inferred, and let it be corrected. Roughly ninety per
cent right and adjustable beats an empty state, and it is not a licence to invent: an
inferred night is labelled, is worth less confidence than a logged one, and can be
overwritten in one tap.

Three sources, cheapest first:

1. **The app's own interaction bracket.** Last interaction of the evening and first of
   the morning bound the window without any new permission. Combined with the learned
   average for this person it is a reasonable estimate on a night they forgot.
2. **The learned rhythm.** Fourteen nights of history already produce a mean bedtime and
   wake time; absent anything else, the prior is better than nothing and honest about
   being a prior.
3. **Platform sleep data** — HealthKit or its Android equivalent. The most accurate and
   the most expensive: a native module, so a development build and a real dependency
   decision rather than a config change.

## Where each HLC category lands

| HLC category | Max | Feeds | Section |
| --- | --- | --- | --- |
| You Are What You Eat | 130 | nourishment load | Diet |
| You Are When You Eat | 50 | nourishment timing | Diet |
| Digestive System Health | 83 | nourishment load | Diet |
| Detoxification System Health | 88 | mind and energy load | Mood |
| Stress | 66 | `mind_life_load` | Mood |
| Circadian Health | 90 | `recovery_rhythm` | Sleep |
| Metabolic (A/B typing) | — | how the diet load is read | Diet |

`mind_life_load` is currently fed by **the calendar**. The Stress category is the actual
instrument for that domain, so Stress becomes its primary input and schedule density
demotes to a daily modulator. That is the same correction as the tab bar — a calendar was
sitting in the fourth doctor's chair — applied inside the engine.

## Bands

Chek's thresholds, unchanged. They play the role the fifty-product table plays for the
scanner: the specification comes from outside the code, so a change has something to
answer to.

| Category | Low | Moderate | High |
| --- | --- | --- | --- |
| You Are What You Eat | 15–20 | 21–40 | 41–130 |
| Stress | 8–16 | 17–33 | 34–66 |
| Circadian Health | 15–30 | 31–50 | 51–90 |
| You Are When You Eat | 5–10 | 11–20 | 21–50 |
| Digestive System Health | 10–20 | 21–40 | 41–83 |
| Detoxification System Health | 10–20 | 21–40 | 41–88 |

Stress is the one set that is not Chek's, and the reason is in the next section.

**Score per category, never the total.** The workbook's own hidden Maximum Check columns
say *"this doesn't add up right"* twice: the category maxima sum to 522 against a stated
520, Moderate is given as 215 against a computed 230, and Digestive appears as both 81
and 83. Those are the source's arithmetic, not ours, and the per-category scores are
sound where the total is not.

The HLC is a **deficit** instrument — higher is worse — and readiness is a **capacity**
score. The inversion is explicit (`baseline = 100 − normalised burden`) because it is the
easiest sign error in the whole design.

## Zones, for the prescription

From the workbook's Score Sheet, which is the mapping the book's page 37 refers to:

| Category | Zones |
| --- | --- |
| You Are What You Eat | 1, 2 & 3 |
| You Are When You Eat | 3 |
| Digestive System Health | 1, 2 & 3 |
| Detoxification System Health | 3 & 4 |
| Stress | 4 |
| Circadian Health | **none** |

Circadian having no zone is not missing data. The book is explicit: where a system has no
zone exercise, *"you simply need to get to bed on time."* An honest "no exercise fixes
this" is worth more than a prescription invented to fill the row.

Every zone exercise in the book is breath-paced with a duration range — *natural slow
breathing pace, 2–20 minutes* — which means the wind-down pacer already in
`SleepExperience.tsx` (4 s expand, hold, 5 s contract) is the same component. A breathing
exercise is a zone exercise with no movement attached.

Contraindications travel with the prescription, always: the Qigong toe-touch is
contraindicated with disc pathology or pain on flexion, eye rolling says see an
optometrist if it causes a headache, and the McKenzie press-up reverses its breathing
when used as a disc mobilisation.

## Where we diverge from Chek, and why

Recorded rather than quietly patched, the same way the seed-oil finding was.

**Microwave use is scoped to microwaved *meals*.** The item is worth up to 10 points, and
as written it charges the same for reheating last night's dinner as for a frozen
supermarket tray. The thing being measured is the meal, not the appliance, so the item
reads as packaged microwave meals.

**Tap water keeps its weight.** It is the single heaviest item in the Food category at 10
points and it stays there. Municipal water is "safe" in the regulatory sense and still
worth filtering; reverse osmosis is the reasonable default.

## The medication item is removed, and the bands are rescaled to match

Stress Q11 asks whether the person takes medication related to stress or a psychological
disorder, and it is worth 15 points — the heaviest item in that category. **It is out.**
A wellness score has no business pricing someone's prescription, and the assumption we
are comfortable making is that a doctor is already accounting for whatever that
medication does.

Removing it is only honest if the bands move with it. The category max drops from 81 to
66, so leaving Chek's thresholds in place would quietly make everyone healthier: the same
person would score the same points against a lower ceiling and land a band lower. That is
exactly the tampering that dropping the question was supposed to avoid.

So the thresholds are scaled by 66/81 and rounded to stay contiguous:

| | Chek, out of 81 | ours, out of 66 |
| --- | --- | --- |
| Low | 10–20 | 8–16 |
| Moderate | 21–40 | 17–33 |
| High | 41–81 | 34–66 |

The assumption this rests on, stated so it can be argued with: that the remaining eleven
items carry burden in roughly the same proportion as the twelve did. Removing a
high-signal item removes signal, not only points, and proportional rescaling cannot
recover that. It is the most defensible option available, not a free one.

## Red flags belong to the safety engine, not to a score

The single heaviest item in the entire instrument is not in Stress. It is Digestive Q9 —
**20 points** for abdominal pain or cramps more than twice a week. Several others are the
same shape: frequent headaches, skin reactions with no identified cause, mental
sluggishness and poor memory.

A number is the wrong response to any of those. The app already has the right machinery:
`reviewSafetySignals` carries a `professional_guidance` status, and `generateDailyReadiness`
already honours a `professional_guidance` baseline mode. High-weight symptom items route
there — a plain suggestion to get it looked at — **in addition to** scoring, never instead
of it. Suppressing the score would be its own dishonesty; leading with it would be worse.

## Inferring a night without asking

The goal is device-level: did this person touch their phone at all, not just this app.
That is the right target and it is worth being precise about what each platform actually
allows, because the answer differs sharply.

**Android can do this today.** `UsageStatsManager` reports screen-on and screen-off
events and per-app usage once the user grants `PACKAGE_USAGE_STATS` through a settings
screen. That is a real permission with a real prompt, and it gives exactly the bracket
the model wants.

**iOS cannot, in the ordinary case.** A sandboxed app has no API for device-wide unlock
or screen-on events. The one legitimate route is the `DeviceActivity` framework with the
Family Controls entitlement, which Apple grants selectively and designed for
screen-time and parental-control apps. It is a request to Apple, not a build setting, and
it may be refused.

**So the ladder, cheapest and most portable first:**

1. **Our own interaction bracket.** Last time this app was open at night, first time in
   the morning. No permission, works everywhere including the web demo, and combined with
   the learned fourteen-night average it is a defensible estimate for a night someone
   forgot.
2. **The learned rhythm alone**, when there is not even that — a prior, labelled as one.
3. **Platform sleep data.** HealthKit on iOS increasingly carries a window from the phone
   alone when Sleep Schedule is set, without a watch.
4. **Device-level usage.** `UsageStatsManager` on Android now; `DeviceActivity` on iOS if
   the entitlement is granted.

None of 3 or 4 works in the web demo, and that is fine — the demo proves the model, the
device proves the accuracy. What matters is that the ladder degrades instead of giving up:
every rung produces a window with a stated provenance, and the bottom rung still beats
"Still calibrating".

## Rights: take the structure, write our own words

The workbook is marked *© Paul Chek, 1999. Reproduced with permission* — permission
granted to a recipient, not a licence to redistribute. The line to hold is the ordinary
one: **a method is not owned, the words expressing it are.** Which zone relates to which
system, that a category bands into low, moderate and high, that a fat is judged by source
— those are mechanisms. His question wording, his exercise cueing and his illustrations
are expression, and none of it ships.

The convenient part is that *assessing rather than guessing* shrinks this problem in the
direction the product was already heading. A measurement is not a paraphrase of a
question. "Waking un-rested more than three times a week" read off fourteen nights of
sleep logs is not Chek's sentence reworded, it is a different artefact that happens to
answer the same thing better. The items that survive as questions are only the ones no
log can reach — money worry, relationship strain, chemical exposure, diet history — and
those get written from scratch.

Naming follows the same rule, which is why the tab is **Mood** rather than Dr. Happiness.
Credit Chek and the book by name, take the structure, write everything a person reads.
And talk to the CHEK Institute before anything commercial ships.

## What is built (October 2026)

- **The load check** (`src/engines/loadCheck`, screen at `app/(app)/load-check.tsx`). Thirty-one
  of our own questions in six areas: sleep and rhythm, what you eat, when you eat,
  digestion, life load, and everyday exposures. Each answer is 0–3 points of load. Each
  area is banded light, moderate or heavy using the proportions of the cut points above,
  read as shares because the items are ours. Areas are never totalled.
- **Observation outranks self-report** for five questions, once there is enough logged in
  the last fourteen days:
  - waking tired, from morning check-ins
  - late bedtimes and bedtime swings, from sleep logs
  - first meal after 11 a.m., from meal logs
  - caffeine drinks a day, from the caffeine log
  The screen shows the basis for each.
- **The baseline.** Capacity is `1 − burden`, folded per readiness foundation and averaged,
  then mapped to a starting point between 50 and 85 (`PERSONAL_BASELINE_RANGE`). It
  replaces the flat 70 once three areas are at least half answered. It still takes a daily
  entry to show a number.
- **Red flags** (recurring stomach pain, headaches, unexplained skin reactions, feeling
  foggy most days) are shown as "worth getting checked" beside the score and never
  change it.
- **Not yet:** inferred nights, platform sleep data, and zone prescriptions. Completed checks
  are kept on the device under the user's scope, like the Mood tab's logs.
