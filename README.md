# Plantry

**Dinner, decided.**

Plantry is the app that answers "what's for dinner?" before you have to ask. Open it at any hour and the first thing you see is one honest answer for tonight, built from what is already in your kitchen, how much energy you have, and what the day is like outside. Everything else in the app exists to make that answer better.

It is not a recipe library, a calendar, or a diet tool. It is a calm, adaptive companion for the person who carries the dinner decision, and it is built to spread that load across the household.

## What makes it different

- **Tonight first.** The home screen is a single answer, not a grid. Cook it, shuffle it, hand it off, or save it for another night.
- **Pantry-aware.** The pantry is a first-class screen. Items age visibly, suggestions lean toward what should be used, cooking decrements the pantry, and leftovers become tomorrow's dinner automatically.
- **Energy, not calories.** "Up for it", "Something quick", or "Can't tonight". The last one is not a failure state.
- **A shared load.** Everyone in the household is a person in the app, not a shared password. Nights can be claimed or handed off in one tap.
- **Adaptive.** The palette, copy, and nudges follow the time of day, the weekday, and (if you let it) the weather. Morning says defrost. Five o'clock says start now. Sunday morning says plan the week.
- **Yours forever.** No account. Everything lives on your device and exports as one JSON file.

## Stack

Next.js 15 (App Router), React 18, TypeScript, Tailwind CSS, Framer Motion, Zustand (persisted to localStorage), Zod, Lucide icons. The dinner flow needs no account or backend configuration. Optional API routes handle household sync, calendar feeds, recipe import, device migration and shopping links. See [household sync](docs/SYNC.md) for storage requirements.

## Running it

```bash
npm ci
npm run dev        # http://localhost:3000
npm run typecheck
npm run lint
npm test           # vitest unit tests for the context engine, ranker, store, parser
npx playwright install chromium  # or set BROWSER_CHANNEL=chrome for installed Google Chrome
npm run build && npm run e2e     # starts its own server; phone and desktop smoke checks
```

To verify first-run pantry entry, cooking and persistence against a running local server, run `PORT=3000 npm run e2e:pantry`. It opens a fresh browser context and saves route screenshots to `e2e/screenshots/pantry-to-dinner` (override with `SCREENSHOT_DIR`).

## Where things live

```
app/                  routes (thin server components)
components/ui         primitives: Button, Chip, Card, Sheet, Stepper, ProgressRing, ...
components/shell      Providers (adaptive context), AppShell (tab bar, sidebar)
components/features   one folder per screen
lib/context.ts        the adaptive context engine (pure, tested)
lib/suggest.ts        the suggestion ranker (pure, tested; a model can replace it later)
lib/store.ts          the local-first store
lib/seed              built-in weeknight recipes and pantry staples
docs/DESIGN.md        voice, visual language, motion presets, engineering rules
```

The native iPhone app, widget, and their test instructions are in [ios/README.md](ios/README.md).
