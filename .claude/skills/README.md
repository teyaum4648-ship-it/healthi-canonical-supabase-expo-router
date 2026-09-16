# Agent skills

Vendored from [emilkowalski/skills](https://github.com/emilkowalski/skills) at commit
`85e8e23`, MIT licensed — the licence is kept alongside as `LICENSE.emilkowalski`.
Written by Emil Kowalski (Sonner, Vaul; previously Vercel and Linear).

These are instructions for whatever agent is working in this repo, so they change how
future work gets done here rather than changing the app. They were read before being
installed rather than pulled in on the strength of the README.

## Why these fit this project

`animate-expo` targets exactly this stack — Reanimated, Gesture Handler, Expo Router,
expo-haptics — and all three were already in `package.json` (Reanimated 4.2.1,
gesture-handler 2.30, expo-haptics 55). So it costs no new dependency.

`mobile-native` matters more than it looks: the review build is a web export opened on a
phone, which is precisely the "a website in a browser versus something that feels
installed" gap that skill is about.

## Installed

| Skill | For |
| --- | --- |
| `emil-design-eng` | The umbrella philosophy on polish and component design |
| `animate-expo` | Animation in React Native — the one that matches this stack |
| `animate` | Animation on the web, which the demo export is |
| `review-animations` | Auditing motion in a diff |
| `improve-animations` | Auditing motion across the codebase |
| `find-animation-opportunities` | Where motion is missing and where it should stay missing |
| `animation-vocabulary` | Naming an effect precisely enough to ask for it |
| `apple-design` | Interface and motion foundations for an iOS-feeling app |
| `mobile-native` | Making a web build feel installed rather than browsed |
| `pick-ui-library` | Choosing a library over hand-rolling |
| `prototype` | Building several variations to compare |

Plus `performance-cheatsheet.md` from the repo root.

## Skipped, deliberately

- **`write-swift`** — there is no Swift in this project. Expo managed workflow.
- **`ask-sonner`** — Sonner is a React web toast library and is not a dependency here.

## Two things to know before following them

**One rule conflicts with `AGENTS.md`.** `pick-ui-library` and parts of `animate-expo`
recommend reaching for a package. `AGENTS.md` says *"Do not change package versions
unless a concrete install, typecheck, or runtime error requires it."* AGENTS.md wins —
the skills advise, they do not authorise a dependency. Where a skill's answer needs a
new package, that is a question for the owner rather than an install.

**`animate-expo` would flag existing code, starting with ours.** It says "Reanimated,
not core `Animated`", and the breathing pacer in `src/features/practice/PacedBreath.tsx`
and the wind-down circle in `SleepExperience.tsx` both use core `Animated`. Both only
animate `scale` with `useNativeDriver: true`, which is the one case core `Animated`
handles on the UI thread, so neither is broken — but a motion audit will name them, and
that is the audit working rather than a false positive.
