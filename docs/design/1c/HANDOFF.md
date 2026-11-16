# Daywoven 1c "Thread": UI handoff

This is the build spec for moving **the whole app** to the **1c Thread** design.

- **Designed screen by screen:** the bottom tabs, **Today** (current Home) and **Sleep**.
  These are built to match the reference images.
- **Every other screen** (Food, Move, Mind, Plan, Protocol, Trends, You/Settings, sheets,
  onboarding, paywall, auth) is **extrapolated** from them. Phase 3 moves the whole app
  onto the 1c theme. Phases 5–8 then rebuild each screen's layout using the patterns in
  "The 1c design language" below.

Tiam's direction: *the back end stays exactly the same; the shell (everything you see)
follows 1c everywhere.* The energy curves and the way analytics are shown on Today and
Sleep are the model for every chart in the app.

**This is a visual and layout change only.** Every engine, calculation, route, store,
safety rule and paywall check stays as it is. `docs/DAYWOVEN_V2_FEATURE_PRESERVATION.md`
still applies in full. The only change to that doc is in Phase 0, below.

## What is in this folder

| File | What it is |
| --- | --- |
| `reference/1c-today-default.png` | Today tab, whole scroll, nothing expanded. |
| `reference/1c-today-expanded.png` | Today with "Why this estimate?", "Explore your analysis", a water log (Undo showing) and the Sleep week card flipped. |
| `reference/1c-sleep-default.png` | Sleep tab, whole scroll. |
| `source/daywoven-directions.dc.html` | The design source. **Only the "1c THREAD" section is in scope**: Today markup at lines 352–550, Sleep at 553–616. 1a and 1b are rejected directions; ignore them. Inline styles hold exact sizes, so read them when a number isn't in this doc. |
| `../../../src/styles/daywoven1c.ts` | Tokens, already converted to hex and React Native type styles. |

The reference PNGs are 402pt wide at 2x. They show one illustrative day: score 68,
6h 52m of sleep, about 4h of sleep debt, now = 9:41. **Every number in the design is
placeholder copy.** In the app, each one comes from the engine named in the mapping
tables below.

---

## Rules for the build

1. **Look, not logic.** Do not change anything under `src/engines/`. The one exception is
   the read-only export described in Phase 4 (Sleep). Do not change persistence, Supabase calls,
   routes or reason codes. Do not move or weaken `shouldSurfaceSafety` or the paywall gating.
2. **Never invent numbers.** When a value is missing, show the existing empty state (for
   example "—" with "No estimate" and a log-first CTA). Never show a design placeholder.
   Missing data lowers confidence; it is never drawn as zero.
3. **Tokens only.** Take colours, fonts, sizes and radii from `src/styles/daywoven1c.ts`.
   No raw hex in components. If a value is missing, add it to the tokens file with a comment.
4. **Reuse before rebuilding.** Restyle existing components where the mapping table says
   so. Keep their props, handlers and accessibility labels.
5. **Accessible as drawn.** Real `Pressable` with `accessibilityRole`. 44pt minimum touch
   targets. `accessibilityLabel` on icon-only buttons. The ring is announced as one label,
   e.g. "Readiness 68 out of 100, steady. Recovery minus 6, …". Expanders set
   `accessibilityState={{ expanded }}`. The active tab sets `selected`.
6. **One phase per branch.** Follow AGENTS.md: plan, wait for approval, edit, run
   typecheck/tests, compare screenshots, summarise, stop. Do not commit unless asked.
   One branch per phase: `design/1c-phase-<n>-<name>`.
7. **Check against the reference before calling a phase done** (see "Screenshot loop").
   For extrapolated screens, check against "The 1c design language" checklist.
8. **Don't invent a pattern.** If a screen needs something the design language doesn't
   cover, stop and show Tiam two options (a quick sketch or a description) before building
   it. Once he picks one, add it to the design language section so every later screen
   reuses it.

---

## The 1c design language (the rules for extrapolating)

These rules are drawn from Today and Sleep. Every screen, designed or not, is built from
them. When in doubt, open the reference images and copy what the closest existing
element does.

### Page structure
- **P1 Header band.** Every top-level screen opens with a charcoal band (`surface.band`)
  under the status bar:
  - wordmark + date row (with Plan/You buttons on Today)
  - an eyebrow naming the screen ("SLEEP & ENERGY", "FOOD", "MOVE", "MIND")
  - one Jost headline written by the engine
  - a one-line sub-line
  - **the screen's single hero**: one readout or chart, never a dashboard
  Detail screens (Plan, Protocol, Trends, Settings, sheets) use a short band: back button,
  eyebrow and title only.
- **P2 Light canvas below.** `surface.canvas`, 20pt gutters, Jost 20 section titles,
  24–26pt between sections. **Most important first, analytics last.**
- **P3 Progressive depth.** The default view answers "what do I do now". Deeper analysis
  sits behind an "Explore …" disclosure button (white, radius 14, rotating chevron). Any
  "Why this …?" explanation expands inline next to the thing it explains. Safety notices
  never go inside a disclosure.

### Building blocks
- **P4 Hairline lists** for anything with a time or a value: schedules, diaries, set logs,
  history, settings. Rows are separated by `ink.hairline`, value/time right-aligned with
  tabular numbers, title Inter 500 14.5, detail Inter 12 muted. No card around each row.
- **P5 White cards** (radius 14, `ink.border`) only to group a module with a title and a
  figure (MetricGrid style). **One dark band card per screen at most**, for the most
  important number or next action ("Tonight", "Next best action").
- **P6 Tile grid** for quick actions (Quick log style): equal tiles, 66pt, icon + one word.
- **P7 Flip cards** for weekly summaries: front = number, back = what to work on.

### Charts and analytics (Tiam's favourite part; keep it consistent)
- **P8 Every chart uses the same grammar:**
  - Ink lines.
  - **Solid = logged or measured. Dotted (dash 2,4) = estimate or prediction.**
  - Amber = energy, peaks, "now" and highlights. Lavender = sleep and sleep pressure.
    Pillar data on the canvas uses `pillarOnCanvas`.
  - Tinted wash for zones and windows; hatched or lavender for dips.
  - One hairline baseline. A dashed reference line for a target or "usual" (sleep need,
    usual resting HR, macro target). **No gridlines.**
  - Axis labels Inter 10–10.5 muted, sparse (every 3 hours, every few days).
  - **Missing data is a gap or a dashed outline labelled "none", never a zero.**
- **P9 Charts are scrubbable.** Drag across a chart to move a rule and dot and update a
  readout pill or the readout line above the chart ("15:45 · Rising again"). The readout
  always names the source: "est." or "measured".
- **P10 Composition bars.** A 10pt segmented bar shows how a day or week splits up
  (Sleep's "Today's rhythm" bar). Use it for macros, training-load mix, mood across the week.
- **P11 Rings** are only for the one score a screen is about (readiness on Today), in the
  ring style: segmented arcs with 6pt gaps, the score in Jost in the middle.
  - Food's score ring, Mind's mood rings and Move's capacity readout reuse this ring component.
  - Never more than one ring on a screen.
- **P12 Figures.** Big numbers in Jost, labels in Inter, every figure tagged Measured or
  Estimate (or the source, e.g. "Apple Health") the way Sleep does.

### Controls
- **P13 Buttons.**
  - Primary on the canvas: ink fill, bone text, 46pt, radius 12.
  - Primary on the band: bone fill, ink text.
  - Secondary: 1pt outline.
  - Text links: Inter 500 with underline and a chevron.
  - Everything is at least 44pt tall.
- **P14 Segmented controls.** Hairline track, the selected segment is an ink fill with bone
  text. **Switches**: 46×28, amber when on.
- **P15 Sheets and modals** (EntrySheet, pickers, MealEditSheet …):
  - canvas background, 20pt top radius
  - Jost 20 title, hairline lists inside
  - primary action pinned at the bottom
  - inputs with a 1pt `control.inputBorder` and an ink focus ring
- **P16 Immersive modes.** Breathing practice, the workout logger in progress, rest timers
  and the morning check-in may go full-screen on `surface.band`, with bone text and a large
  Jost timer or count. They exit back to the canvas screen.

### Never
- Glass, glow and gradient backgrounds from the old theme (`glassSurface`, `ambientGlow`,
  `tintedGlass`).
- A colour per tab. Colour means *what the data is*, not which tab you're on.
- Raw hex in components.
- Placeholder numbers.
- Removing a feature to make a layout fit. Move it under a disclosure instead.

---

## Phase 0: setup (small, separate PR)

- Add `@expo-google-fonts/jost`. Load `Jost_400Regular` and `Jost_500Medium`, plus
  `Inter_600SemiBold`, in the existing `useFonts` call in `app/_layout.tsx`.
  Fraunces stays loaded for screens not yet moved.
- Add `src/styles/daywoven1c.ts` (from this handoff).
- Add `tests/styles/daywoven1c.contrast.test.ts`, modelled on `tests/styles/contrast.test.ts`.
  Assert at least the pairs below (all pass today):
  - `ink.text` on `surface.canvas` and `accent.amberWashFlat`
  - `ink.muted` on canvas and on card: ≥ 4.5
  - `ink.mutedOnWash` on `amberWashFlat`: ≥ 4.5
  - `bone.text` and the flattened bone alphas (#B4B2AC, #ABA9A4, #A3A19C, #9A9894) on `surface.band`: ≥ 4.5
  - `pillar.nourishment` on band: ≥ 4.5 (it is the zone word)
  - `ink.text` on `accent.amber`: ≥ 4.5 (the "Now" pill)
- Icons: the design draws Phosphor icons. Default to **Ionicons**, which is already installed
  (mapping at the end of this doc). Use `phosphor-react-native` only if Tiam approves a new
  dependency (see `docs/DEPENDENCY_RISK_REVIEW.md`).
- In `docs/DAYWOVEN_V2_FEATURE_PRESERVATION.md`, change "Approved UX direction → Design
  reference" to point at this handoff. Leave the rest of that doc as it is.

---

## Phase 1: Today tab (`app/(app)/(tabs)/index.tsx`)

Reference: `reference/1c-today-default.png`, `reference/1c-today-expanded.png`.

The screen is one scroll on the light canvas, with a charcoal band at the top. The status
bar area is the band colour (light-content status bar). Top to bottom:

### 1. Header band (`surface.band`, 20pt gutter, 22pt bottom padding)

| Design element | Source in the app |
| --- | --- |
| `daywoven` wordmark (Jost 18) + date (Inter 12.5, `bone.muted`) | Date: existing `displayDate(today)`. **The greeting line is dropped in 1c.** Keep `homeGreeting` in the code so it is easy to bring back. |
| **Plan** button (calendar icon + "Plan", 44pt tall) | Existing `router.navigate('/plan')` and its accessibility label. |
| **You** avatar button (32pt bone circle with a person icon, 44pt hit) | Opens the existing side menu: `useSideMenu().open()`. It replaces the old Menu tab, so settings, progress and every other side-menu route stay one tap away. Label: "You · profile and settings". |

### 2. Readiness block (inside the band)

This is `ReadinessHub` restyled. Keep its props.

- **Ring** (124pt, r 52, stroke 9): four arcs clockwise from 12 o'clock, in
  `PILLAR_ORDER_1C`, with 6pt gaps. Each arc is a track (`bone.ringTrack`) plus a fill in
  `pillar[domain]`. **The fill length comes from the existing `pillarFill()` in
  `src/features/dashboard/premium/pillarRingModel.ts`.** Do not write a new formula.
  Build it with `react-native-svg` circles and `strokeDasharray`/`strokeDashoffset` (the
  design source shows the exact offsets).
- Ring centre: "READINESS" (`type.readinessLabel`), score (`type.readinessScore`), zone
  word (`type.readinessWord`, coloured by zone). Score = `visibleReadinessScore` (account)
  or the `ReadinessNowCard` value (demo). Word = `readinessHeadline(zone, …).word`. For
  no score or a safety state, show "—" and "No estimate", as `ReadinessHub` already does.
- Right of the ring: headline (`type.readinessHeadline`) and sub-line. Split the existing
  `readinessHeadline(...).insight` at its first sentence. The meta line (`bone.faint`,
  11.5) uses the existing `meta` string: day mode · source · confidence.
- **Pillar row** (4 equal columns, top hairline `bone.hairline`): 8pt swatch + short name
  (`Recovery`, `Nourish`, `Movement`, `Mind`, from `PILLAR_NAMES`) and the signed points
  from the existing `points()` helper. Unknown domain shows "—", as the hub does now.
- **Buttons** (two, 46pt tall, radius 12, gap 10):
  - Primary (bone fill, ink text) is the existing `primaryLabel` / `onPrimary`: "Check in",
    or "Log last night's sleep" when `needsEntry`.
  - Secondary (outline): **Why this estimate?** with a chevron that rotates when open.
- **Why panel** (expands inline in the band). Account mode: the content of the existing
  `<Disclosure title="Why this estimate?">`, which is the `readinessLedgerSummary`
  baseline line, one row per `driver_cards` entry (label, detail, `contributionLabel`),
  the "N of 4 foundations have signals" sentence and "See the full daily protocol" →
  `/protocol`. Demo mode: `ReadinessNowCard` keeps its own "Why this estimate?" sheet; use
  that instead. Do not show two.
- The **biomarker breakdown** that opened when the ring was tapped now lives under
  "Explore your analysis" (section 7). The ring is no longer a button.

### 3. Today's direction (light canvas, 24pt top padding)

Eyebrow "TODAY'S DIRECTION", a Jost 30 headline, one meta line, then a text link.

| Element | Source |
| --- | --- |
| Headline ("Strong until noon. Ease off around 2:30.") | `TodayDirectionCard` `headline`. That is `primaryAction?.title ?? dashboardHero.top_action`, or "Start with last night's sleep" when `needsEntry`. **Do not write energy copy into this headline.** If the engine's headline doesn't read as a two-line direction, flag it to Tiam rather than inventing one. |
| Meta line | The existing confidence/source line from `TodayDirectionCard`. |
| "Open today's plan ›" | Existing `onPrimary` (`/protocol`), or the sleep-log action when `needsEntry`. |

### 4. Safety row (unchanged rule)

When `shouldSurfaceSafety(protocol.safety.status)`, show the existing safety row here,
**above Quick log and always visible**. Restyle it on canvas: shield icon in
`accent.amberDeep`, text `ink.text`. The design doesn't show it because it isn't active on
the illustrative day.

### 5. Quick log

Section title "Quick log" (Jost 20). Five equal tiles (gap 8, height 66, radius 12, white,
`ink.border`, 20pt icon, Inter 500 11 label). Use the existing `quickLogActions` exactly:
Food, Water, Workout, Sleep, Check-in. The water tile shows the running count when known
("Water · 3"). The water notice row with **Undo** sits under the tiles, using the existing
`waterNotice` / `undoGlass`. Failed-save text must stay visible.

### 6. Your day: the energy strand (new component `DayThread`)

**Tiam asked to keep this chart exactly as designed.** It is the one genuinely new
component. Build it in `src/features/dashboard/DayThread.tsx`, with a pure model in
`dayThreadModel.ts` and unit tests.

Geometry is in `strand` in the tokens. One hour = 36pt. The column runs from the hour of
`circadianBriefing.wake_time` (floored) to the hour after `target_bedtime`, or 06:00–24:00
when those are missing.

- **Strand area** (left 84pt): x = `6 + energy/100 × 70` at each
  `circadianBriefing.energy_curve` point, filled to the left edge.
  - Before now: solid `ink.text` fill (lived).
  - After now: `ink.strandArea` fill plus a 1.5pt dotted line (dash 2,4) on the curve edge (predicted).
  - No curve: draw nothing and show the existing "log sleep" prompt. No fake curve.
- **Hour labels** at x 88, every 3 hours (Inter 10.5, `ink.muted`).
- **Now line**: 1pt `accent.amberDeep` across the full width at the current time, plus a
  "Now 9:41" pill (amber fill, ink text, Inter 600 10.5, radius 3) at x 84.
  Move it on a 30-second tick while the screen is focused, like the one in
  `ReadinessNowCard`. Don't add a background timer.
- **Above now: things that happened.** Each is a 7pt solid dot at x 116 and a row at x 132:
  time in `ink.muted` + label (Inter 13.5/18).
  - Wake time and last-night duration: today's sleep session.
  - Meals: from `nutritionSummary` / today's meal logs (name or protein, whichever the store has).
  - Water: glasses logged.
  - Workouts: today's sessions.
  - **Only logged or measured items appear here.** Nothing estimated.
- **Below now: the plan.** Each is a 7pt hollow dot (1.5pt ring) and a title + one-line
  reason (Inter 500 14.5 / 12 muted).
  - Source: the existing day plan, `generateDayPlan` in `src/engines/dayPlan`, which is
    what `/plan` shows. Pull schedule blocks and recommendations from there.
  - The reason line is the engine's own detail text.
  - A block that sits inside a high `energy_zones` window is drawn as an `accent.amberWash`
    card (radius 8, 12pt inner padding), spanning its real duration (e.g. Deep work 09:15–11:45).
  - Wind-down and Bed come from `rhythm_plan.wind_down_start` / `target_bedtime`.
- **Legend** above the strand: solid dot "Logged or measured", hollow dot "Planned".
- **Scrub**: a vertical drag over the strand moves a 1pt ink rule (x 0–112), an 8pt ringed
  dot on the curve, and a pill reading `HH:MM · <level>`. The level is the name of the
  `energy_zones` window at that time (High / Moderate / Low, or the zone label the Sleep
  screen uses). Use a `Gesture.Pan()` with `activeOffsetY` so page scrolling still works.
  Give it an `accessibilityLabel` that summarises the day, and `accessibilityHint`
  "Drag to read energy at a time".
- Overlapping rows: when two events are closer than 22pt, nudge the later one down. Never
  overlap text.

### 7. Explore your analysis (existing extended Home, restyled)

A full-width white button (radius 14, `ink.border`, title Inter 600 15, detail 12.5
muted, rotating chevron), driven by the existing `showExtendedHome` state. Its label flips
to "Hide the detailed picture". When open, show the existing pieces **in this order**,
each as a white radius-14 card:

1. Starting point row: existing `personalBaseline` copy and `/load-check`.
2. `MetricGrid`: last night vs need, and today's load. Last-night bar uses `accent.lavenderDeep`.
3. `BiomarkerTimeline` (resting heart rate). Ink line, dashed "usual" baseline, latest dot in
   `accent.lavenderDeep`, missing days as a gap labelled "none", and the existing "Add a
   reading" sheet.
4. `BiomarkerBreakdown` (moved here from the ring tap).
5. Next best action as a dark card (`surface.band`, bone text), linking to `/protocol`.
6. Account mode only: `LoggingPrompts` rows. They were inside the old "Why" disclosure.
   Keep them here so they stay reachable.

### 8. Week in review row

Existing `showRecap` / `WeeklyRecapRow` / `WeeklyRecapSheet` logic. Restyle it as an
`accent.amberWash` row (radius 14): sparkle icon, title + one line, "Open", and an icon-only
dismiss button labelled "Not now".

### 9. This week

Title "This week" (Jost 20), "Trends ›" text button (`/progress`) and the hint line. Then
a 2×2 grid of the existing `WeekFlipCard`s from `weekCards`, restyled:
- Front: white card, icon + title, a Jost 26 value, label and caption.
- Flipped: `surface.band` with bone text, the "<TITLE> · WORK ON" eyebrow, headline, detail
  and an underlined action.
- Keep `weekCardAction` and the flip accessibility labels.

### Removed from the Today screen

- The greeting line (see 1).
- `InsightShortcuts` (Energy outlook / Food quality / Movement guidance). The bottom tabs
  now reach the same three routes.
- Old Home styling only. **Nothing else is removed.**

---

## Phase 2: bottom tabs (`app/(app)/(tabs)/_layout.tsx`, `navigationModel.ts`)

Five tabs: **Today · Sleep · Food · Move · Mind**.

```ts
export const mainTabs = [
  { route: 'index',    label: 'Today', outline: 'sunny-outline',      filled: 'sunny' },
  { route: 'rhythm',   label: 'Sleep', outline: 'moon-outline',       filled: 'moon' },
  { route: 'food',     label: 'Food',  outline: 'restaurant-outline', filled: 'restaurant' },
  { route: 'movement', label: 'Move',  outline: 'walk-outline',       filled: 'walk' },
  { route: 'mood',     label: 'Mind',  outline: 'leaf-outline',       filled: 'leaf' }
] as const;
```

- **Routes do not change**, only labels, icons and order. Deep links, `quickEntryHref`
  and every `router.navigate('/food')`-style call keep working.
- **The Menu tab goes.** Set `href: null` on the `menu` screen so the route still exists;
  the side menu now opens from the You avatar on Today. Check the side menu still lists
  every route it did before. If Food, Move or Mind headers need a way in too, add the same
  avatar there in their own phase, not now.
- Restyle the bar as a **full-width bar**, not the floating pill:
  - background `surface.tabBar` over `<BlurView tint="light">`, top hairline `ink.hairline`
  - 23pt icons, Inter 10 labels; active `ink.text` + semibold, inactive `ink.muted`
  - per-tab accent colours removed
  - paddingTop 8, paddingBottom 8 + safe-area inset
- Update `TAB_BAR_HEIGHT` / `useTabBarSpace` so no screen hides content behind the new bar.
- Every tab follows 1c (Tiam's decision). Phase 3 moves the whole app to the 1c theme, so
  **Phases 2 and 3 ship together**. Don't release Phase 2 on its own with dark screens
  under a light bar.
- Update `tests/features/navigation/navigationModel.test.ts`, which asserts the old labels
  `['Home', 'Diet', 'Movement', 'Sleep', 'Mood']`. The new expected value is
  `['Today', 'Sleep', 'Food', 'Move', 'Mind']`; keep its other assertions.

---

## Phase 3: app-wide 1c theme (every screen at once)

Goal: after this phase, **every screen in the app is in 1c colours, type and controls**,
even before its layout is rebuilt. Layouts don't change in this phase. About 99 files
import the theme and there are about 322 raw hex values in `.tsx` files, so do it at the
shared layer, not screen by screen.

1. **Remap the semantic tokens** in `src/styles/tokens.ts` to the values in
   `daywoven1c.ts`. Keep every export name so the importing files follow automatically:
   - `colors.background` → canvas; `colors.surface` → card
   - `colors.text` → ink; `colors.textMuted` / `colors.textFaint` → `ink.muted`
   - `colors.hairline` / `colors.border` → ink hairline / border
   - `colors.primary` → ink (primary button fill); `colors.primaryText` → bone
   - `colors.accent` → ink for UI. Use `accent.amber` only where the accent marks energy or a highlight.
   - `colors.danger` → `safety.onCanvas`
   - `pillarColors` → `pillarOnCanvas`
   - `tabAccent` → ink for every tab
   - the legacy aliases to their nearest 1c meaning
2. **Retire glass.** `glassSurface`, `glassChrome`, `tintedGlass`, `ambientGlow` and
   `groundStyle` keep their signatures but return flat 1c styles: a white card with a
   hairline border, or a plain canvas. The callers don't change.
3. **Fonts.** Map `fonts` / `type` in `mobileTheme.ts`:
   - display → Jost; body → Inter
   - Fraunces is no longer used for UI. Keep it loaded only if something still needs it, and say so.
4. **Reskin the shared components** to the design language (P13–P15):
   - `Button`, `Card`, `Screen`, `SectionHeader`, `TextInput`, `CheckBox`, `TimeField`
   - `components/mobile/*`: `ActionRow` (hairline row), `Disclosure` (P3), `EntrySheet` (P15),
     `SegmentedControl` (P14), `DayNavigator`, `FluidPressable`
5. **Sweep raw hex.** Replace every hard-coded colour in `src/` and `app/` with a token.
   Then add a test (e.g. `tests/styles/noRawHex.test.ts`) that fails when a `.tsx` file
   outside `src/styles/` contains a hex colour. That keeps the app on-theme from now on.
6. **Contrast.** Update `tests/styles/contrast.test.ts` to the new pairs and add the 1c pairs
   from Phase 0. Text on the canvas is ≥ 4.5:1; meaningful chart marks are ≥ 3:1.
7. **Status bar** is light-content over the band on every top-level screen.
8. Screenshot every tab and the main sheets with `verify-ui` (no route arguments = all
   tabs). Fix anything unreadable: leftover dark backgrounds, light text on light, glass
   artefacts. Layout polish waits for the screen's own phase.

## Phase 4: Sleep tab (`app/(app)/(tabs)/rhythm.tsx`)

Reference: `reference/1c-sleep-default.png`. Restyle the existing sleep experience. Keep
every feature it has now (habit logs, caffeine log, morning check-in, sleep window
tracker, chronotype quiz) below the 1c sections if the design doesn't place them.

### Header band
- Wordmark/date row, as on Today.
- Eyebrow "SLEEP & ENERGY".
- Headline (Jost 27) and sub-line: explanation copy. **Keep the engine's own outlook and
  limiter wording** (`day_outlook`, `limiter`) and match the tone of the design's sentence.
- Readout row: `HH:MM · <window name>` (Jost 20) and "<level> energy · est.".
- **Two-thread chart** (full width, 190pt), drawn in `react-native-svg`:
  - **Body clock** (Process C): 2pt `accent.amber` line.
  - **Sleep pressure** (Process S): 2pt `accent.lavender` line.
  - The gap between them is filled with `accent.amberGap`. That gap is the energy.
  - Labels "Body clock" and "Sleep pressure" sit at the right edge.
  - Scrubbing shows a 2pt bone bar spanning the gap and a dot on each thread.
- **Data**: `energyModel.ts` already computes C and S inside `circadianEnergyAt`, but does
  not export them separately. Add **one** pure, read-only export, e.g.
  `circadianComponentsAt(...) → { clock, pressure }`, built from the same internals. Add a
  test showing that `circadianEnergyAt` returns identical values for the scenarios in
  `tests/engine_scenarios.json`. **That is the only engine change allowed in this handoff.**
  If the internals can't be split cleanly, stop and report; don't approximate with the
  design's demo math (`E(t)`/`S(t)` in the source are illustrative only).
- **Compare with a rested week** switch (46×28): adds a dashed bone line for pressure with
  no sleep debt. If the engine can't produce that line honestly, leave the switch out and
  say so.

### Light section
- **Today's rhythm**: a 10pt segmented bar of `energy_zones` (amber = high, lavender = the
  dip, ink tints for the rest), then a list of the high/low windows and wind-down with
  time ranges and the fit text the current Sleep screen already shows.
- **Tonight**: a dark card "In bed by" (`target_bedtime`, Jost 38) with the opportunity vs
  need line, beside last caffeine (`rhythm_plan.caffeine_cutoff`) and wind-down
  (`wind_down_start`) in Jost 24.
- **Last 7 nights**: 7 columns with a 4pt bar filled against `sleepNeed.minutes`. The
  value is under each bar. A night that wasn't logged is a dashed outline labelled "none".
  Last night is `accent.lavenderDeep`. Source: `sleepGlance(...).series`. Then the
  debt/confidence sentence and the "Measured · <source>" label.
- **Chronotype** row (56pt): existing chronotype estimate → existing quiz.
- Bottom tabs with Sleep active.

---

## Phases 5–8: extrapolated screens

These screens have no reference image. Build them from the design language (P1–P16), keep
every feature listed, and **begin each phase by showing Tiam a short layout outline**:
band hero, sections in order, and what sits behind disclosures. Build only after he
approves it. The mappings below are the starting proposal, not the final word.

### Phase 5: Food (`app/(app)/(tabs)/food.tsx`, `src/features/nutrition/`)

- **Band:**
  - eyebrow FOOD and an engine-written headline about today's intake
  - **hero**: today's intake vs targets from `DietIntakeSummary`, as the P11 ring
    (`NutritionScoreRing`) or macro progress bars with dashed target marks (P8)
  - **"Why this score?"** expands the quality reasoning inline
- **Quick add** (P6 tiles): search, scan barcode, meal library, water, built from the
  `FoodEntryPicker` / `MealLibrarySheet` / `HydrationCard` actions.
- **Today's meals** as a P4 hairline diary grouped by meal (`MealDiarySections`): time,
  name, protein/quality value right-aligned. Editing opens `MealEditSheet` (P15).
- **Food quality**: `FoodQualityReviewPanel` as white cards (P5). Show the product's score
  first, then its reasons. Keep the category-relative display and the reasoning exactly as
  the engine gives them.
- **Explore your nutrition** (P3): macro/micronutrient breakdown as P10 composition bars
  and P8 bar charts, the week selector (`DietWeekSelector`) as a P14 segmented strip, and
  goal setup (`NutritionGoalSetup`) as a sheet.
- Keep every existing behaviour: search, scan, Open Food Facts lookup, meal builder, drafts,
  hydration undo, diary repair.

### Phase 6: Move (`app/(app)/(tabs)/movement.tsx`, `src/features/movement/`)

- **Band:**
  - eyebrow MOVE and a headline with today's movement guidance from the protocol
    (e.g. "Strength, held to moderate today")
  - **hero**: training load / intensity over recent sessions (`MovementProgress`) as a P8
    chart. Solid logged sessions, a dotted recommended zone or target, scrubbable (P9),
    readout "Tue · 82 intensity · logged".
- **Start workout**: one primary button (`WorkoutStarter`). Today's recommended session
  and the reason sit above it as a short hairline block.
- **Workout in progress** (`WorkoutSessionLogger`) is a P16 immersive band screen:
  - sets as hairline rows with tabular numbers
  - a big Jost rest timer
  - the existing feedback (`setLoggedFeedback` etc.)
  - `SessionRecap` afterwards on the canvas
- **Steps** (`StepsToday`) as a P12 figure with its source tag.
- **Explore your training** (P3):
  - exercise progress (`buildExerciseProgress`) as P8 line charts per lift
  - training coverage (`buildTrainingCoverage`) as P10 composition bars
  - history as a P4 list
- Keep weight units, the workout logger flows and saving exactly as they are.

### Phase 7: Mind (`app/(app)/(tabs)/mood.tsx`, `src/features/practice/`)

- **Band:**
  - eyebrow MIND and a headline from today's check-in (`MoodToday`)
  - **hero**: the mood rings (`moodRings`) as the P11 segmented ring, or the head check
    (`HeadCheckCard`) when nothing is logged yet
- **Practices**: a P6 tile grid from `TechniquePicker` (paced breath, cyclic breathing,
  pulse check, zone release). Each practice opens as a P16 immersive band screen
  (`PacedBreath`, `CyclicBreathRounds`, `PulseCheck`, `ZoneRelease`).
- **Daylight** (`DaylightLog`) and **habits** (`MoodHabits`) as P4 hairline checklists.
- **This week**: mood across the week (`moodWeek`) as a P10 composition bar or P8 chart,
  plus the existing mood week card.
- Keep check-in storage, demo/account scopes and practice history exactly as they are.

### Phase 8: everything else

Each of these is a short band (back, eyebrow, title) over the canvas, built from P4–P15:
- **Plan** (`plan.tsx`): the day timeline reuses the `DayThread` visual language (36pt per
  hour, solid/hollow dots, amber-wash blocks for work inside peaks). Keep `layoutOverlaps`
  and block editing.
- **Protocol**: band hero = day mode + primary action, then reasons and steps as P4 rows.
- **Trends** (`progress.tsx`): `TrendBarChart` restyled to P8 (ink bars, dashed target
  line, gaps for missing days), with the range as P14.
- **You / Settings** (`settings.tsx`) and the **side menu**: P4 grouped hairline lists.
  Connected Health, units, allergens, diary repair and legal links unchanged.
- **Load check, closeout, lab evidence review, morning check-in**: P15/P16 flows.
- **Onboarding, auth, app preview**: canvas + band, Jost titles, P13 buttons. Keep every
  question, score engine and the account-save handoff.
- **Paywall / subscription**: restyle only. **Do not change prices, plan copy,
  Apple-required wording, restore purchases or entitlement checks.**

---

## Screenshot loop (how to check your work)

The repo already has the tool: `scripts/verify-ui.mjs` screenshots real routes in demo
mode.

```bash
npm run build:demo
node scripts/verify-ui.mjs "" rhythm     # "" is Home/Today → reports/ui/home.png, reports/ui/rhythm.png
```

On a Mac, point the script at a Chromium it can drive: `CHROMIUM_PATH="$(node -e "console.log(require('playwright').chromium.executablePath())")"`
(after `npx playwright install chromium`). It defaults to `/opt/pw-browsers/chromium`.
If a screenshot stops at one screen height because the React Native web `ScrollView`
scrolls internally, extend the script so it scrolls that container and captures each
section. Don't judge a screen from its first viewport only.

Then open each screenshot next to the matching file in `reference/` and compare section
by section, top to bottom:

- Order of sections, gutters (20pt), section gaps (24–26pt)
- Type: family, size and weight per the tokens (Jost vs Inter is the most common miss)
- Colours: band vs canvas, card whites, hairlines, the ring segment colours
- Ring geometry and gaps; pillar row alignment
- Strand: solid before now, dotted after, now line + pill, planned blocks in amber wash
- Tab bar: full width, five tabs, correct active state

Fix the differences and repeat until the only remaining differences are **data** (real
engine values instead of the design's placeholders) and the 390pt vs 402pt width.
`verify-ui` uses a 390×844 viewport; the references are 402 wide, so expect slightly
narrower text wrapping. List anything you could not match in the phase summary, with the
reason.

Also run `npm run typecheck`, `npm run test` and `npm run lint` before each phase summary.
Real-device checks (VoiceOver, safe areas, the drag gesture) stay on Tiam's list.

---

## Icon mapping (design Phosphor → Ionicons)

| Design | Ionicons |
| --- | --- |
| sun-horizon (Today) | `sunny-outline` / `sunny` |
| moon (Sleep) | `moon-outline` / `moon` |
| fork-knife (Food) | `restaurant-outline` / `restaurant` |
| person-simple-run (Move) | `walk-outline` / `walk` |
| wind (Mind) | `leaf-outline` / `leaf` |
| calendar-blank (Plan) | `calendar-outline` |
| user (You) | `person-outline` |
| drop (Water) | `water-outline` |
| barbell (Workout) | `barbell-outline` |
| pulse (Check-in) | `pulse-outline` |
| compass (Starting point) | `compass-outline` |
| sparkle (Week in review) | `sparkles-outline` |
| caret-down / caret-right | `chevron-down` / `chevron-forward` |
| plus / x | `add` / `close` |

## Decisions already made by Tiam

- **Every screen and tab follows 1c.** No mixed themes after Phase 3.
- **The back end stays the same.** Only the shell changes.
- **The Today/Sleep energy curves and analytics style is the model for every chart** (P8–P12).

## Open decisions for Tiam (ask; don't guess)

1. Ionicons mapping (default) or add `phosphor-react-native` for the exact icon style?
2. If the engine's direction headline doesn't read as two short lines, is a shorter
   engine field acceptable, or should the copy stay as-is?
3. The layout outline at the start of each of Phases 5–8.
