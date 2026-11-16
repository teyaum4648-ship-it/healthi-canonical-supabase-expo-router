/**
 * Daywoven 1c "Thread" design tokens.
 *
 * Source of truth: docs/design/1c/HANDOFF.md and docs/design/1c/source/daywoven-directions.dc.html
 * (the "1c THREAD" section). The design was authored in CSS with oklch() colours; React
 * Native cannot parse oklch, so every value here is already converted to hex or rgba.
 *
 * Rules:
 *  - Screens built in the 1c style read colours, type and spacing from here only.
 *    No raw hex in components.
 *  - Like src/styles/tokens.ts, this module must not import react-native, so a contrast
 *    test can import it (see HANDOFF.md, "Contrast test").
 *  - In Phase 3 of the handoff, the semantic names in src/styles/tokens.ts (colors.background,
 *    colors.text, …) are remapped to these values, so the whole app moves to 1c at once.
 *    After that, this file is the only place a colour is defined.
 */

/** Light canvas with a charcoal header band. */
export const surface = {
  /** Screen background below the header band. */
  canvas: '#F4F4F2',
  /** Cards, quick-log tiles and the analysis button sit on white. */
  card: '#FFFFFF',
  /** The header band, the flipped week cards, the "Tonight" card and dark buttons. */
  band: '#121314',
  /** The bottom tab bar: canvas at 94%, drawn over a light BlurView. */
  tabBar: 'rgba(244, 244, 242, 0.94)'
} as const;

/** Text and lines on the light canvas. */
export const ink = {
  text: '#121314',
  /** Secondary text. 5.24:1 on canvas, 5.77:1 on white. */
  muted: '#63666A',
  /** Secondary text inside amber-wash blocks. 6.33:1 on the wash. */
  mutedOnWash: '#4B4D50',
  hairline: 'rgba(18, 19, 20, 0.12)',
  border: 'rgba(18, 19, 20, 0.14)',
  /** The whole-day energy area behind the strand. */
  strandArea: 'rgba(18, 19, 20, 0.09)',
  track: 'rgba(18, 19, 20, 0.12)'
} as const;

/**
 * Text and lines on the charcoal band. Bone is the band's "white".
 * The flattened hex next to each alpha is that value over #121314, for places that need
 * a solid colour (contrast tests, Android text).
 */
export const bone = {
  text: '#EDEAE2',
  /** rgba(237,234,226,.74) = #B4B2AC, 8.77:1. Sub-lines. */
  soft: 'rgba(237, 234, 226, 0.74)',
  /** rgba(237,234,226,.70) = #ABA9A4, 7.92:1. Dates, detail lines. */
  muted: 'rgba(237, 234, 226, 0.70)',
  /** rgba(237,234,226,.66) = #A3A19C, 7.21:1. Meta line under the readiness copy. */
  faint: 'rgba(237, 234, 226, 0.66)',
  /** rgba(237,234,226,.62) = #9A9894, 6.46:1. The tiny READINESS label in the ring. */
  label: 'rgba(237, 234, 226, 0.62)',
  hairline: 'rgba(237, 234, 226, 0.14)',
  /** Outline of the secondary button on the band. */
  outline: 'rgba(237, 234, 226, 0.30)',
  /** Unfilled part of each readiness ring segment. */
  ringTrack: 'rgba(237, 234, 226, 0.13)',
  /** Off state of the rested-week switch. */
  switchOff: 'rgba(237, 234, 226, 0.22)'
} as const;

/**
 * The two accents. Amber is energy, peaks and "now". Lavender is sleep and sleep pressure.
 * (Design values: amber oklch(0.74 0.14 62), lavender oklch(0.74 0.14 285).)
 */
export const accent = {
  amber: '#E99541',
  /** Amber at 26% over the canvas: peak-aligned plan blocks and the week-in-review row. */
  amberWash: 'rgba(233, 149, 65, 0.26)',
  /** The same wash flattened over canvas, for contrast checks: #F1DBC4. Ink on it is 13.88:1. */
  amberWashFlat: '#F1DBC4',
  /** Gap fill between the two threads on the Sleep chart. */
  amberGap: 'rgba(233, 149, 65, 0.22)',
  /** The "now" line across the day strand (oklch(0.5 0.14 62)). */
  amberDeep: '#994B00',
  lavender: '#A29DFF',
  /** Last night's bar and the latest resting-HR dot on the light canvas (oklch(0.6 0.14 285)). */
  lavenderDeep: '#7971D0'
} as const;

/**
 * Readiness ring segments, clockwise from 12 o'clock in this order. Each colour differs in
 * lightness as well as hue, so the four can be told apart without colour vision.
 */
export const pillar = {
  recovery_rhythm: '#9D98F2', // oklch(0.72 0.13 285)
  nourishment: '#F8B65D', // oklch(0.82 0.13 72); also the zone word "Steady". 10.49:1 on band.
  movement_capacity: '#EDEAE2', // bone
  mind_life_load: '#3398C2' // oklch(0.64 0.11 230)
} as const;

/**
 * Added in Phase 1 (decision A, approved by Tiam): the readiness zone word under the score
 * on the band. Keyed by WellnessZone. Only "Steady" is drawn in the design; the others keep
 * the same calm range. Red is never used here, because red means safety and nothing else.
 */
export const zoneWord = {
  optimal: bone.text,
  warning: pillar.nourishment,
  critical: accent.lavender,
  neutral: bone.muted
} as const;

export const PILLAR_ORDER_1C = ['recovery_rhythm', 'nourishment', 'movement_capacity', 'mind_life_load'] as const;

/**
 * The same four pillars for marks drawn on the LIGHT canvas (chart lines, bars, swatches,
 * icons). The band colours above are too light for the canvas. Each of these clears 3:1
 * on #F4F4F2, the minimum for meaningful graphics. Text on the canvas is always ink.text,
 * never a pillar colour.
 */
export const pillarOnCanvas = {
  recovery_rhythm: '#5A52B8', // 5.72:1
  nourishment: '#B8641A', // 3.91:1
  movement_capacity: '#121314', // ink
  mind_life_load: '#2A7FA3' // 4.09:1
} as const;

/**
 * Safety only, nothing else, as before. The old coral (#FF6B6B) fails as text on the
 * light canvas; this red is 5.97:1 on canvas and 6.57:1 on white. Coral stays valid on
 * the band (6.7:1).
 */
export const safety = {
  onCanvas: '#B42318',
  onBand: '#FF6B6B'
} as const;

/** Controls shared by every screen. */
export const control = {
  buttonHeight: 46,
  /** Primary on canvas: ink fill, bone text. Primary on the band: bone fill, ink text. */
  switchWidth: 46,
  switchHeight: 28,
  /** Switch "on" track. */
  switchOn: '#E99541',
  switchOffOnCanvas: 'rgba(18, 19, 20, 0.18)',
  /** Selected segment of a SegmentedControl: ink fill, bone text. */
  segmentTrack: 'rgba(18, 19, 20, 0.06)',
  sheetRadius: 20,
  inputBorder: 'rgba(18, 19, 20, 0.22)',
  focusRing: '#121314'
} as const;

/**
 * Fonts. React Native needs one family name per weight, so weights are separate entries.
 * Jost needs @expo-google-fonts/jost (Jost_400Regular, Jost_500Medium).
 * Inter is already installed; add Inter_600SemiBold to the useFonts call in app/_layout.tsx.
 */
export const font = {
  display: 'Jost_400Regular',
  displayMedium: 'Jost_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold'
} as const;

/** Type styles. Sizes and line heights in points, taken from the design. */
export const type = {
  wordmark: { fontFamily: font.display, fontSize: 18, letterSpacing: 0.36 },
  readinessScore: { fontFamily: font.display, fontSize: 40, lineHeight: 40 },
  readinessLabel: { fontFamily: font.bodySemibold, fontSize: 9, letterSpacing: 1.26 },
  readinessWord: { fontFamily: font.bodyMedium, fontSize: 12 },
  readinessHeadline: { fontFamily: font.display, fontSize: 21, lineHeight: 25 },
  pillarValue: { fontFamily: font.display, fontSize: 20, lineHeight: 20 },
  directionTitle: { fontFamily: font.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  sleepTitle: { fontFamily: font.display, fontSize: 27, lineHeight: 31 },
  sectionTitle: { fontFamily: font.displayMedium, fontSize: 20, lineHeight: 26 },
  bigNumber: { fontFamily: font.display, fontSize: 26, lineHeight: 26 },
  eyebrow: { fontFamily: font.bodySemibold, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' as const },
  body: { fontFamily: font.body, fontSize: 13, lineHeight: 19.5 },
  bodyStrong: { fontFamily: font.bodyMedium, fontSize: 14.5, lineHeight: 20 },
  cardTitle: { fontFamily: font.bodySemibold, fontSize: 15, lineHeight: 20 },
  button: { fontFamily: font.bodyMedium, fontSize: 14 },
  caption: { fontFamily: font.body, fontSize: 12, lineHeight: 17 },
  small: { fontFamily: font.body, fontSize: 11.5, lineHeight: 16 },
  tabLabel: { fontFamily: font.bodyMedium, fontSize: 10 },
  tabLabelActive: { fontFamily: font.bodySemibold, fontSize: 10 }
} as const;

export const space = {
  /** Horizontal screen gutter. */
  gutter: 20,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 18,
  xxl: 24,
  section: 26
} as const;

export const radius = {
  pill: 3,
  swatch: 2,
  tile: 12,
  button: 12,
  card: 14,
  block: 8
} as const;

/** Minimum touch target, everywhere. */
export const HIT = 44;

/** Readiness ring geometry (SVG). */
export const ring = {
  size: 124,
  radius: 52,
  stroke: 9,
  /** Gap between segments, in px of arc length (3px each side). */
  gap: 6
} as const;

/**
 * Day strand geometry. One hour = 36pt, so 06:00 to 24:00 is 648pt tall.
 * x positions are from the screen's left edge.
 */
export const strand = {
  hourHeight: 36,
  areaWidth: 84,
  /** energy 0..100 maps to x = minX + energy/100 * spanX */
  minX: 6,
  spanX: 70,
  hourLabelX: 88,
  dotX: 116,
  dotSize: 7,
  textX: 132,
  dash: [2, 4] as const,
  lineWidth: 1.5
} as const;

export const tabBar = {
  iconSize: 23,
  paddingTop: 8,
  /** Bottom padding above the home indicator; add the safe-area inset to this. */
  paddingBottom: 8
} as const;
