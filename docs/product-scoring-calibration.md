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

## Two findings worth keeping

**A calibration curve does not help.** Fitting a line, and several curves that compress
toward a centre, was tried: least squares moved band accuracy from 31 to 31 and the
compressions made it worse. The residual error is per-product, not a scale problem, so
a curve would be a fudge that buys a point of mean error and hides the real gaps.

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
