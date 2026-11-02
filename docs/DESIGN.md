# Plantry design and engineering guide

Plantry answers "what's for dinner?" before you ask. Tagline: **Dinner, decided.**

## Voice
Warm, dry, competent. Second person. Short sentences. No exclamation marks in system copy.
No diet words (clean, guilt-free, cheat, healthy as a virtue). No "girlboss", no "treat yourself".
Name the work: "You decided dinner 5 times this week." Examples of good copy:
- "Tonight's handled."
- "Only missing lime."
- "Can't tonight? Fair. Here's the easy way out."
- "Nothing in the fridge is on its last legs."

## Visual language
- Tokens only (never raw hex in components): `bg-canvas`, `bg-surface`, `bg-surface-2`, `text-ink`, `text-ink-2`, `text-ink-3`,
  `border-line`, `bg-accent text-accent-ink`, `bg-secondary text-secondary-ink`. Four moods (dawn, day, dusk, night) switch these
  via `<html data-mood>`; night is the dark theme. Member colors: `terracotta`, `saffron`, `sage`, `plum`.
- Type: `font-display` (Fraunces serif) for headings, recipe titles, numbers that matter, and italics for the context line.
  `font-sans` (Inter Tight) for everything else. Hero sizes: `text-fluid-2xl`, section headings `text-fluid-xl` or `text-xl`.
- Shape: cards `rounded-card` (20px) via the `.card` class or `<Card>`, sheets `rounded-sheet`, buttons and chips `rounded-pill`.
- Surfaces: `.card` for content, `.glass` only for floating controls (tab bar, sticky action bars, toasts). Never glass inside lists.
- One accent-colored primary action per screen. Everything else is secondary, outline, or ghost.
- Spacing: mobile first, 20px side gutter is already applied by the shell. Content max width is handled by the shell.
- Images: `next/image` with `fill` and `sizes`, Unsplash hosts are allowed. Always give images a `bg-surface-2` placeholder.

## Motion
Import presets from `@/lib/motion` and use them everywhere; do not invent new durations.
- `tap` + `tapTransition` on pressables (Button and Chip already do this).
- `settle` spring for cards entering, sheets, selection pills, `layoutId` shared elements.
- `drift` spring for drag, reorder, the shuffle deck.
- `reveal` + `staggerContainer` variants for lists and grids on mount (pass `custom={index}`).
- `checkPop` for check marks.
- Only animate `transform` and `opacity`. Use `layout` and `layoutId` for shared-element moves (recipe card -> detail hero uses `layoutId={`recipe-image-${id}`}`).
- Every animation must be interruptible; prefer `AnimatePresence` with `mode="popLayout"` for lists.
- `MotionConfig reducedMotion` is set globally; do not add parallax or anything that moves on scroll.

## Data and state
- Store: `useStore` from `@/lib/store` (Zustand + persist). Select narrowly: `useStore((s) => s.recipes)`.
  Read `lib/store.ts` for every action. Everything is serializable. Dates are `YYYY-MM-DD` keys; use helpers in `@/lib/utils`.
- Context: `useAppContext()` from `@/components/shell/Providers` gives `{ mood, hour, isWeekend, targetDate, targetLabel, weather, weatherLean, nudge, reason }`.
- Suggestions: `suggest()` and `pickNext()` from `@/lib/suggest`, `coverage()` for pantry match.
- Toasts: `toast('Saved')` from `@/components/ui/Toast`.
- Pages are server components that render a client feature component. Keep page files tiny.
- Components that read the store render only after hydration; the shell already waits for `hydrated`, so features can assume it.

## Components available (`@/components/ui`)
Button (variants primary, secondary, ghost, outline, danger, glass; sizes sm, md, lg, icon, icon-sm), Chip, Tag, Card, SectionTitle,
Eyebrow, Sheet (bottom sheet, draggable), Input, Textarea, Label, Select, Stepper, ProgressRing, EmptyState, Toaster/toast,
Skeleton, Logo, Avatar.

## Accessibility
Every icon-only button has `aria-label`. Chips use `aria-pressed`. Lists are real `<ul>`. Keyboard works everywhere.
Touch targets are at least 44px. Contrast on the accent must stay readable in every mood (accent-ink handles it).

## Quality bar
`npm run typecheck`, `npm run lint`, and `npm test` must pass. Every screen has a real empty state and a loaded state.
