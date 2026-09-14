# Circadian timing: evidence review and calibration

Review of the `src/engines/circadian` timing rules against the published
literature, September 2026. Each section states what the engine did before this
review, what the evidence supports, and what changed.

## The honest accuracy ceiling

Healthi infers circadian phase from self-reported sleep and wake times. That
method has a measured ceiling, and it is well short of exact:

- Sleep-corrected mid-sleep on free days (MSFsc), the standard questionnaire
  chronotype marker, correlates with dim-light melatonin onset (DLMO) at
  **r = 0.32**; the Morningness–Eveningness Questionnaire manages **r = −0.25**
  ([Concordance of chronotype categorisations, PMC8293076](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8293076/)).
  An r of 0.32 is about 10% of the variance in true circadian phase. Sleep times
  are a usable proxy, not a measurement.
- Individual sensitivity to evening light varies **more than fifty-fold**
  ([Phillips et al., PNAS](https://www.pnas.org/doi/10.1073/pnas.1901824116)).
- Caffeine half-life ranges from **2 to 10 hours**, largely genetic
  ([Sleep, zsae230](https://academic.oup.com/sleep/article/48/4/zsae230/7815486)).
- The synchrony effect — chronotypes performing best at their preferred time —
  appears in only **29 of 64 adult studies (45%)**
  ([systematic review, Chronobiology International 2025](https://www.tandfonline.com/doi/full/10.1080/07420528.2025.2490495)),
  and at least one well-powered study finds
  [no general or robust cognitive boost](https://online.ucpress.edu/collabra/article/9/1/88337/197502/The-Interplay-of-Time-of-day-and-Chronotype-Results-in-No-General-and-Robust-Cognitive-Boost).

So the goal is not an exact prediction. It is that **every window Healthi draws
is the one the literature actually supports, is labelled as an estimate, and
never claims a precision the input cannot carry.** A competitor promising an
exact personal peak from a bedtime field is overclaiming; being right about the
population rule and honest about the spread is the defensible position.

## What changed

### Exercise timing — the significant correction

**Before:** primary window wake +3 to +5 h, secondary wake +10 to +12 h.

Two independent lines of evidence both point later than +3 to +5, and they
agree with each other:

- **Performance peaks with core body temperature, in the late afternoon and
  early evening (16:00–18:30).** Higher core temperature facilitates
  actin–myosin cross-bridging; peak power, squat jump and countermovement jump
  all measure better in the afternoon than the morning
  ([narrative review, PMC10558889](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10558889/);
  [neuromuscular performance meta-analysis, PMC11782285](https://pmc.ncbi.nlm.nih.gov/articles/PMC11782285/);
  [four times of day, PMC12553368](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12553368/)).
- **Exercise should end at least 4 hours before sleep onset.** Across ~150,000
  nights, bouts ending ≥4 h before sleep showed no change in sleep; finishing
  within 4 h meant later sleep onset, shorter and worse sleep, higher resting
  heart rate and lower HRV
  ([Nature Communications 2025](https://www.nature.com/articles/s41467-025-58271-x)).
  For high-intensity work specifically, bouts ending 0.5–4 h before bed cut REM
  by 2.34%
  ([systematic review, ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S1087079221001209)).

For an 08:30 riser with a 22:30 target, the temperature peak (≈16:30–18:30) and
the sleep-safety boundary (bedtime − 4 h = 18:30) land on the same place. The old
secondary window ran to 20:30 — two hours inside the boundary, which the
150,000-night data associates with measurably worse sleep.

**Now:** primary window **wake +8 h to wake +10 h, hard-capped at bedtime − 4 h**.
The morning slot is kept but demoted and relabelled: it is a scheduling
accommodation for people who can only train early, not the performance optimum.
If the cap would leave less than 45 minutes, the window is withheld rather than
shown as a sliver.

### Caffeine cutoff — now dose-aware

**Before:** a flat bedtime − 8 h.

The 2023 systematic review and meta-analysis in *Sleep Medicine Reviews* puts a
standard 107 mg coffee at **8.8 h** before bed and a 217.5 mg pre-workout serving
at **13.2 h**
([summary](https://www.ajmc.com/view/caffeine-and-sleep-review-suggests-consumption-guidelines);
[Pharmacy Times](https://www.pharmacytimes.com/view/study-coffee-consumption-should-occur-9-hours-before-sleep-reducing-disturbances)).
A crossover trial found 400 mg impaired sleep even at 12 h
([Sleep, zsae230](https://academic.oup.com/sleep/article/48/4/zsae230/7815486)).
A flat 8 h was therefore slightly permissive for an ordinary coffee and
substantially so for a pre-workout or a large cold brew.

**Now:** the headline cutoff is **bedtime − 9 h** (rounding 8.8 up), with a
second **bedtime − 13 h** cutoff surfaced for doses at or above roughly 200 mg.

### Morning light — added

**Before:** absent. This was the largest gap in the protocol: the most
evidence-backed circadian intervention available was not in it at all.

A single **30-minute** bright exposure soon after waking advances the clock
([Crowley & Eastman, PubMed 25620199](https://pubmed.ncbi.nlm.nih.gov/25620199/);
[Frontiers in Neuroscience 2020](https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2020.00099/full)).
The effect per morning is real but modest — about **0.18 ± 0.36 h** of advance in
adults ([PMC10594521](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC10594521/)) —
so the copy promises a nudge, not a reset.

**Now:** a `morning_light_windows` entry from wake to wake + 60 min, described as
30 minutes of outdoor or bright light.

### Evening light — added

Melatonin is **50% suppressed below 30 lux**, which is ordinary indoor lighting
and phone-screen territory, with the fifty-fold individual spread noted above
([PNAS](https://www.pnas.org/doi/10.1073/pnas.1901824116)). Under 10 lux is the
conventional definition of dim light
([Frontiers in Neurology 2021](https://www.frontiersin.org/journals/neurology/articles/10.3389/fneur.2021.625334/full)).

**Now:** an `evening_dim_light_start` at bedtime − 3 h, which is also roughly
where DLMO falls (see below).

### Nap — duration made explicit

The dip sits **7–8 h after waking** and the useful nap is **~20 minutes**; 30–60
minutes into a nap is where slow-wave sleep and its inertia begin
([sleep-propensity model, PMC2647793](https://pmc.ncbi.nlm.nih.gov/articles/PMC2647793/)).
The engine's dip placement at wake + 7 h was already correct. The window was 30
minutes wide, which invited a 30-minute nap.

**Now:** the window is labelled for a 20-minute nap inside a wake +7 to +8 h band.

## Confirmed as already correct

- **Post-lunch dip at wake + 7 h.** Matches the 7–8 h figure, and the engine
  correctly notes it occurs whether or not lunch is eaten.
- **Two-process model as the curve's basis** (Borbély 1982): Process C minus
  Process S, with Process C highest in the early evening and lowest in the early
  morning hours ([PMC3832615](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3832615/)).
- **Wake-maintenance zone before bed.** The WMZ is a 3–4 h window just before
  melatonin onset, and DLMO itself falls a few hours before habitual sleep
  onset — measured at 3.16 h (women) and 4.11 h (men) phase angle
  ([PMC8293076](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8293076/);
  [forbidden zone, PMC11801367](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11801367/)).
  The engine centres its evening peak 3.5 h before bed, which sits inside that
  range; left unchanged.
- **Wind-down at bedtime − 90 min.** No specific figure in the literature
  contradicts it, and it now pairs with the dim-light start at − 3 h.

## Known limitation, not yet addressed

**Sleep inertia may be modelled as shorter than it is.** The engine's inertia
term has a Gaussian width of roughly 0.7–1.3 h. Measured recovery is slower:
subjective alertness keeps improving for **up to 2 h** after waking, and addition-task
performance took **up to 3.5 h** to fully dissipate
([PMC3832615](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3832615/)).
That makes the first deep-work window at wake + 2 h the optimistic end of the
range. Widening the inertia term would change the shape of the curve for every
user, so it is flagged here for a deliberate decision rather than adjusted in
passing.

## What would actually raise the ceiling

In rough order of accuracy gained per unit of effort:

1. **Ask two questions instead of inferring.** MCTQ-style free-day sleep and wake
   times give MSFsc directly, rather than inferring chronotype from whatever
   workday alarm the person happens to keep.
2. **Learn from logged outcomes.** Healthi already records perceived effort,
   feeling tags and post-meal responses. Comparing predicted energy against what
   people actually report is the only route to per-user calibration, and it is a
   route a questionnaire cannot reach.
3. **Widen the windows to match the evidence.** A 2-hour window honestly
   represents a population rule inferred from a bedtime field; a 30-minute one
   does not.
4. **Wearable phase estimates** (Oura, Apple Watch, Whoop) if integrations ever
   land — still proxies for DLMO, but better ones than self-report.
