# Plantry for iPhone

**Dinner, decided.** The native iOS version of Plantry, built in SwiftUI with SwiftData. Same positioning as the web app (Tonight first), same brand voice, same data model, same 24 starter recipes and 36 staples.

## Priorities

- **Fast.** Cold launch is a local SwiftData open and one render. No network on the critical path. Images load lazily behind a surface-colored placeholder with a memory and disk cache.
- **Light.** Zero third-party dependencies. No bundled fonts (New York serif for display, San Francisco for body). The app is the Swift source, two JSON files, and one icon.
- **Native motion.** Springs match the web presets (`settle`, `drift`, `checkPop`, `reveal`) and respect Reduce Motion, both the system setting and Plantry's own.
- **Local-first.** Everything lives in SwiftData on the phone. Export and import use the same JSON shape as the web app, so a file moves between the two.

## Running it

Open `ios/Plantry.xcodeproj` in Xcode 16 or later, pick an iPhone simulator, press Run. There is nothing to install first.

```bash
cd ios
xcodebuild -project Plantry.xcodeproj -scheme Plantry -destination 'platform=iOS Simulator,name=iPhone 17' build
xcodebuild -project Plantry.xcodeproj -scheme Plantry -destination 'platform=iOS Simulator,name=iPhone 17' test
```

Bundle id is `com.destromoose.plantry`. Signing is automatic; see `INSTALL.md` for putting it on a real iPhone, free or via TestFlight.

## Where things live

```
Plantry/App          PlantryApp (container, store, context), RootView (theme, onboarding gate), AppShell (tabs, routes)
Plantry/Core         Pure Swift, no SwiftUI or SwiftData: Types, Utils, ContextEngine, Suggest, RecipeParser, Seed
Plantry/Data         SwiftData models, Store (every mutation), ContextProvider (clock, foreground, weather)
Plantry/Design       Theme (four moods), Motion, Components (Card, buttons, Chip, Ring, Sheet, Toast, RemoteImage)
Plantry/Features     One folder per screen: Onboarding, Tonight, Week, Recipes, Cook, Pantry, Shop, Household, Settings
Plantry/Resources    seed-recipes.json and seed-staples.json (generated from the web app's lib/seed), Assets, privacy manifest
Shared               WidgetSnapshot, the one file the app writes and the widget reads (member of both targets)
PlantryWidget        The Tonight widget (home screen small and medium, lock screen rectangular and inline)
PlantryTests         XCTest ports of the web app's vitest suites, plus store round trips on an in-memory container
```

`Core` mirrors `lib/` in the web app file for file: `ContextEngine` is `context.ts`, `Suggest` is `suggest.ts`, `RecipeParser` is `parseRecipe.ts`. Keep them in step when one changes. The seed JSON is produced from the TypeScript source, never edited by hand.

## How it maps to the web app

| Web | iOS |
| --- | --- |
| Zustand store persisted to localStorage | SwiftData models plus `Store`, saved on every action |
| `useAppContext()` | `ContextProvider` in the environment, re-run at launch, on foreground, and at each mood boundary |
| `<html data-mood>` tokens | `Theme.forMood` in the environment; `night` sets the dark color scheme |
| Framer Motion presets | `Motion.settle`, `Motion.drift`, `Motion.checkPop`, `.reveal(index)` |
| Bottom sheets | `.sheet` with `SheetChrome` and presentation detents |
| Tab bar plus sidebar | `TabView` with five tabs; Household and Settings from the menu on Tonight |
| Cook mode route | `fullScreenCover` with per-step timers, screen stays awake |
| Open-Meteo in the browser | Open-Meteo plus one-shot CoreLocation, only when weather is on |
