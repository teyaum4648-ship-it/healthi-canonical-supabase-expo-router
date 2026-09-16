# Product scoring: calibration and the V6 kernel

## Why this document exists

Tuning the scanner one product at a time does not converge. Every fix is unconstrained
— nothing says what it must not break — so a change that rescues cheese crackers drags
corn tortillas down with it, and the only way to notice is to scan something by hand.
That is the whack-a-mole, and it is a missing specification rather than a missing rule.

The specification now lives in `tests/engines/nutrition/calibrationSet.ts`: fifty
products with the score each is meant to land on, and the orderings that matter more
than any single score. `npm run calibrate` prints the table.

## The philosophy the targets encode

| Band | What belongs there |
| --- | --- |
| A | An intact whole food, with nothing done to it that needs defending |
| B/C | Harm reduction — the better version of a snack, drink or staple someone will eat anyway |
| D | Better off skipping: not poison, just not worth the slot when a B or C exists in the same aisle |
| F | Obvious |

Two rules follow from this that the earlier kernels did not implement.

**Absence of adulteration is not presence of food.** A lemon-lime soda contains
carbonated water, high-fructose corn syrup, citric acid, a flavour and a salt. Five
ingredients, no preservatives, no colours. Judged on what it lacks it looks clean;
judged on what it is, it is sugar and water.

**Fat is judged by source, not by saturation.** Avocado oil, olive oil, butter, ghee,
tallow and coconut are food. Canola, soybean, corn, cottonseed and unnamed "vegetable
oil" are a processing input — the fat left after a seed is crushed, solvent-extracted,
degummed, bleached and deodorised. The `saturated_fat_g` figure cannot tell those
apart, so it is not what decides.

## What was wrong, measured

Against the fifty products, the shipping kernel (V5) scored:

```
scored 46/50 · right band 20/50 · within 5 points 17/50
```

Three failures, each visible in the dimension trace rather than inferred:

**It could not grade a blueberry.** Blueberries, broccoli, edamame and raisins returned
no score at all. A one-word ingredient list gave the parser nothing to match, three of
five dimensions abstained as `unsupported`, and the eligibility gate then refused a
score. This is the "low confidence, missing data" the owner kept hitting: the app was
least able to grade the foods it should have been most certain about.

**Four of five dimensions measured the absence of bad things, and defaulted high.**
Lemon-lime soda scored 91 for ingredient integrity, 93 for formulation burden and 78
for *food structure*. Those three carry 62.5% of the weight between them, so sugar
water came out at 71 — a C. Nacho cheese corn chips came out at 75.

**The middle was squeezed upward.** Whole-wheat pita 89 against a target of 79,
whole-grain crackers 90 against 82, ricotta 86 against 78 — harm reduction graded as A.

No amount of per-rule tuning fixes this, because it is the shape of the scale that is
wrong, not its constants.

## What V6 changes

`kernelV6.ts` scores what a product is made of. Every dimension starts from the
composition and adds, rather than starting at a hundred and subtracting.

`ingredientRoles.ts` gives each ingredient a role — whole food, culinary fat, seed oil,
added sugar, refined starch, isolate, flavour system, colour, and so on — and a food
value on a gradient from 1 (intact) to 0 (colour). The gradient matters: reading white
flour as "not food" collapsed every everyday staple to the bottom alongside sweets,
which is not what anyone means. Ingredients are position-weighted, because an
ingredient list is ordered by mass and that ordering is the only quantity information
most labels carry.

Current state against the same fifty:

```
scored 52/52 · right band 34/52 · rank correlation 0.932
```

## Three findings worth keeping

**A calibration curve does not help.** Fitting a line, and several curves that compress
toward a centre, was tried: least squares moved band accuracy from 31 to 31 and the
compressions made it worse. The residual error is per-product, not a scale problem, so
a curve would be a fudge that buys a point of mean error and hides the real gaps.

**Scaling the seed-oil penalty by the oil's own share makes the set worse.** The
penalty is `38 × min(1, fatShare/0.5)`, and `fatShare` is the product's *total* fat, so
an almond-flour cracker is charged for the fat in its almonds as if it had come from the
sunflower oil sitting fourth. That is a real defect and the obvious fix does not pay
for itself:

| floor / divisor on the oil's positional share | right band |
| --- | --- |
| baseline (no scaling) | 34/52 |
| 0.35 / 0.30 | 30/52 |
| 0.60 / 0.20 | 33/52 |
| 0.70 / 0.20 | 33/52 |
| 0.80 / 0.25 | 34/52 (rank 0.933) |
| 0.90 / 0.30 | 33/52 |

It rescues one product and breaks four. The single setting that holds the line changes
nothing — the cracker still lands on 69, still D. The correct reading is that the
almond-fat objection is real but not what decides this product, and the rule keeps its
current shape until something better than a knife-edge constant is on offer.

**The archetype's `intent` is not reliable enough to build on.** Judging a snack harder
than a staple is the obvious next move — the same refined flour is a different
proposition in a pancake mix and in a flavoured cracker. It was implemented and removed:
the upstream resolver calls cinnamon toaster squares a `staple` and whole-grain crackers
a `snack`, so the adjustment moved both the wrong way. Removing it *raised* band
accuracy. Fixing category resolution is a prerequisite for purpose-aware scoring, not a
detail of it.

## The two questions, settled

**Caesar dressing is F.** It is roughly 94% soybean oil by calories, and the owner's
ruling was that the fat source decides: "if caesar dressing is 94% soybean oil then F".
The condiment softening that used to shield it from the seed-oil rule is gone. Portion
still softens sugar and salt, where how much you eat genuinely changes the answer; it
does not soften what a product is made of.

This is the rule working, on two jars with identical nutrition panels — same calories,
same fat, same salt, differing only in the oil:

| Product | Score |
| --- | --- |
| Traditional pesto, olive oil | 82 |
| Supermarket pesto, sunflower oil | 57 |

A scale that reads `saturated_fat_g` cannot produce that gap, because there isn't one
to read: both jars declare 7 g.

**A fruit-on-the-bottom yogurt is D.** The dairy and protein are real, but the fruit
arrives as added sugar and modified starch. The version that earns a good score is the
one the owner described — Greek yogurt with actual fruit and nothing added — and it is
now in the set as its own case, so the two cannot drift together.

## What the roles were missing

`tapioca` and `cassava` matched nothing and came back `unknown`. In a grain-free cracker
those are the second and third ingredients — two fifths of the product by position —
counted as neither food nor formulation. They are the same proposition as white flour: a
starch with the fibre that would have slowed it milled out. Adding them, along with
arrowroot, yuca, sago and the root flours, holds the set at 34/52 and moves the almond
cracker's food-structure dimension from 90 to 68, which is the honest reading.

An ingredient the table cannot place is now named on screen rather than silently scored
as nothing.

## One number per role was still one size fits all

Roles replaced a red-flag list, and then made the same mistake one level up: every
refined starch was worth 0.68, so maltodextrin, enriched wheat flour and cassava flour
were the same proposition. A rule can now carry its own value, and the gradient is how
far the milling went.

| | value | what is left of the food |
| --- | --- | --- |
| cassava flour, plantain flour, sweet potato flour | 0.80 | the whole root, dried and ground; the fibre survives |
| enriched and white wheat flour, semolina | 0.68 | endosperm milled; the protein survives |
| rice flour, soy flour, potato flour | 0.60 | milled, and little protein to show for it |
| tapioca, potato and corn starch, arrowroot | 0.52 | the starch extracted; fibre and protein left behind |
| maltodextrin, dextrin, modified starch | 0.40 | hydrolysed; a processing aid that was food two steps ago |

Fats are graded the same way. Extra virgin olive oil, avocado oil and virgin coconut oil
are 1.0 — a credit rather than the absence of a seed oil — against 0.9 for the rest of
the culinary fats and 0.82 for the ones usually refined on the way to the bottle. An
unnamed "vegetable oil" is 0.32 against 0.4 for a named seed oil, because a blend you
cannot identify is worse than one you can.

Three chips with identical panels, differing only in the starch:

| Product | flat | graded |
| --- | --- | --- |
| cassava flour + avocado oil | 72/C | **75/C** |
| tapioca starch + avocado oil | 72/C | **70/C** |
| maltodextrin + avocado oil | 72/C | **67/D** |

Eight points of spread where there had been none, and the fat still dominates: the same
cassava chip made with canola oil scores 56.

Across the fifty-two, this is close to a no-op — six products move by a point or two,
none change band, rank correlation is unchanged at 0.932. The set has no cassava product
and no avocado-oil product, so it cannot see the difference. That is a gap in the set
rather than evidence the gradient does not matter.

## Saying why, not just what

Every reason the scanner gave was an enthymeme — a conclusion with the interesting half
missing. "Built on an industrially refined seed oil" only lands on someone who already
believes seed oils are a problem, and "Nutrition profile: What the label delivers" does
not manage even that.

`explain.ts` supplies the missing premise, and the premise is always a mechanism: two
starches are marked down because the fibre is milled out and they arrive about as fast
as glucose; a seed oil because of how it is extracted, which is a thing the
`saturated_fat_g` figure cannot see. Findings name the actual ingredients and their
positions, quote only numbers that are on the label, and are ordered by the kernel's own
ledger so the reason that weighed most is the reason that leads.

## Still open

**Greek yogurt with real fruit** is targeted at 88/B and the kernel puts it at 92/A.
Four points, one band, and the target is the invented number here rather than the
engine's: an unsweetened whole-milk yogurt with berries in it has a reasonable claim to
an A. Worth the owner's call rather than either number being quietly moved to match the
other.

**The archetype's `intent` is still unreliable** and remains the blocker on purpose-aware
scoring, which is what several of the remaining band errors need — see the finding
above. Chocolate milk not being classed as a beverage is the same root cause.

## Running it

```sh
npm run calibrate
```

V6 is behind `EXPO_PUBLIC_PRODUCT_QUALITY_EXPERIMENT=v6_composition` and is **not** the
default. At 34 of 52 in the right band it is a better scale than the one shipping, but
it is not finished, and swapping it in would replace one set of wrong grades with a
different set. The calibration test holds the current numbers as floors so the next
change has to improve on them.
