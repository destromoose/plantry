# Plantry cleanup · November 22, 2026

## Five hierarchy and density problems, in order

| Finding | What changed | Chrome evidence |
| --- | --- | --- |
| 1. Tonight made people scroll past household logistics and energy choices to act on dinner. | Put the dish first, with one context line. Keep energy and household controls below. Remove the redundant weekend planning prompt also labeled “Sunday” on Saturdays. | At 390 × 844 the top of **Cook this tonight** moved from **y=926 to y=604**. [Before](before/05-tonight.png) · [After](after/05-tonight.png) |
| 2. Pantry asked where something lives before there was room to type its name. | Reserve the phone row for the item and Add. Show the optional location below as soon as someone types; keep it inline on desktop. | The name field widened from **146 to 298 CSS px**. [Before](before/06-pantry.png) · [After](after/06-pantry.png) |
| 3. The Tonight card repeated the pantry count in a ring and in text. | Keep one readable coverage statement, deduplicate the matching suggestion reason in the active language, and keep the add-missing-items action. | [Desktop before](before/shared-tonight.png) · [Desktop after](after/shared-tonight.png) |
| 4. First-run marketing copy and two recovery prompts competed with the name field. | Use one helper and one clearly named join/restore disclosure. Both paths remain reachable by keyboard. | [Before](before/01-onboarding.png) · [After](after/01-onboarding.png) |
| 5. On an empty Shop, starting a trip outranked entering an item. | Put capture first and make the trip button secondary; it still works without a preexisting list. | [Before](before/shop.png) · [After](after/shop.png) |

## Route evidence

Paired screenshots show the first viewport, not full-page scroll captures. The comparison uses the development build on loopback (the small **N** is Next's dev indicator). The mobile walk used installed Google Chrome 156.0.8078.80, a fresh context, English, Montréal time and real timers. Both desktop captures came from a separate incognito T3 preview fixture. Compare like for like within a row. The screenshot pairs are intentionally not a pixel-diff test: clock, pantry quantities, and viewport can affect suggestions.

| Route or state | Before | After |
| --- | --- | --- |
| `/onboarding` · names, tastes, avoidances, staples | [Names](before/01-onboarding.png), [tastes](before/02-tastes.png), [avoid](before/03-avoid.png), [staples](before/04-staples.png) | [Names](after/01-onboarding.png), [tastes](after/02-tastes.png), [avoid](after/03-avoid.png), [staples](after/04-staples.png) |
| `/` · Tonight | [Before](before/05-tonight.png) | [After](after/05-tonight.png) |
| `/pantry` | [Before](before/06-pantry.png) | [After](after/06-pantry.png) |
| `/recipes` | [Before](before/recipes.png) | [After](after/recipes.png) |
| `/recipes/new` | [Before](before/recipes-new.png) | [After](after/recipes-new.png) |
| `/recipes/[id]` · risotto | [Before](before/07-recipe.png) | [After](after/07-recipe.png) |
| `/cook/[id]` · risotto | [Before](before/08-cook.png) | [After](after/08-cook.png) |
| `/history` · after cooking | [Before](before/09-history.png) | [After](after/09-history.png) |
| `/week` | [Before](before/week.png) | [After](after/week.png) |
| `/shop` | [Before](before/shop.png) | [After](after/shop.png) |
| `/household` | [Before](before/household.png) | [After](after/household.png) |
| `/settings` | [Before](before/settings.png) | [After](after/settings.png) |
| `/join` | [Before](before/join.png) | [After](after/join.png) |
| `/move.html` · synthetic confirmation only | [Before](before/move-confirm.png) | [After](after/move-confirm.png) |
| Unknown path · actual HTTP 404 | [Before](before/not-found.png) | [After](after/not-found.png) |
| Shared desktop preview | [Onboarding](before/shared-onboarding.png), [Tonight](before/shared-tonight.png) | [Onboarding](after/shared-onboarding.png), [Tonight](after/shared-tonight.png) |

## Verification

- **First run, no account:** two fictional members selected Cozy, excluded peanuts, and chose six staples. Added Demo lentils, reloaded Pantry, set rice to 750 g, then used **Cook from what I have** to open creamy mushroom risotto. Finished its seven steps. After reload, History showed the meal, one cooked record matched the completed dinner plan, rice was **600 g**, and the unrelated lentils remained. Passed in local development and production Chrome. On first run the shell no longer mounts Tonight or fetches its photo before redirecting to setup. English disclosure and Spanish setup copy checked.
- **Production smoke:** `npm ci`; `npm run lint`; `npm run typecheck -- --noUnusedLocals --noUnusedParameters`; `npm test` (199 tests in 34 files); `npm run build`. `BROWSER_CHANNEL=chrome PORT=14405 npm run e2e` passed at phone and desktop widths, including navigation/Back, planning, shopping and capture, cooking, imported recipe editing from a fixture, and night theme. Lint and Vitest emitted upstream deprecation notices; the production build retried fonts and succeeded.
- **Reproduce the pantry walk:** start the app with `npm run dev -- --hostname 127.0.0.1 --port 4405`, then run `BROWSER_CHANNEL=chrome PORT=4405 npm run e2e:pantry`. Use another available port for both commands as needed. `SCREENSHOT_DIR` selects an output directory. The script does not use an existing household. The checked-in comparison was made on the audit date, not with a permanently frozen app clock.
- **Local HTTP:** explicitly enabled in-memory sync without remote credentials. Checked all eight API patterns: create/read/update/conflict in `/api/sync` and `/api/sync/[code]`; subscribe and fetch a synthetic calendar event in `/api/calendar` and `/api/calendar/[token]`; pack, collect and verify one-time consumption in `/api/move` and `/api/move/[token]`; missing-link response from `/api/import`; disabled status/action from `/api/instacart`. Manifest, icon URLs, and service worker served successfully.
- **PWA:** in a clean Chrome context, preloaded two obsolete Plantry caches and one unrelated cache. Activation removed only the obsolete Plantry caches and preserved the unrelated one. Cached onboarding HTML was reachable offline. This is not a full disconnected cooking or installation test.
- **Native:** 24 Python AltStore feed tests passed. An unsigned `xcodebuild build-for-testing` for a generic iOS Simulator succeeded. It compiled, but did not execute, the native tests. No device was booted, no IPA released, and no hosted CI or deployment was triggered manually.

## Review, not fixed

- **Photos:** the image for creamy mushroom risotto doesn't clearly show the named dish. Review the seed photo set for recipe accuracy and attribution before swapping assets.
- **Food costs and nutrition:** the recipe detail gives estimates prominent space before ingredients. Decide whether they belong there, behind a disclosure, or in preferences; don't silently remove them.
- **Secondary screens:** Settings is long, the recipe editor competes with fixed navigation on small screens, and the week view is dense. Choosing which functions to group or hide needs household feedback. Compare the native UI separately before copying the web hierarchy.
- **Offline budget:** the service worker warms two routes per recipe plus upcoming planned cook links. Measure bytes and first offline launch on a constrained phone before narrowing that promise. Live recipe imports, provider-backed sync, grocery checkout, weather permissions, calendar clients, domain migration across real origins, OS installation, and native UI/accessibility were not exercised.
- **Maintenance:** `docs/Blueprint.txt` and `docs/Phases.txt` read as planning history, not current setup guidance. Decide whether to label or archive them. The build still downloads Google fonts; decide whether repeatable offline builds justify vendoring them.
- **Scope:** inventoried the 290 baseline tracked paths across `app`, `components`, `lib`, `public`, `ios`, docs, E2E, workflows and configuration. Source review focused on the first-run path, shared shell, state, UI hierarchy and cache lifecycle. Route coverage is not every recipe, permission, dataset, device, error condition, or a line-by-line guarantee. An early clock-controlled capture and one later Settings window-load timeout were discarded; the real-clock route walk passed after waiting on DOM readiness, visible content, fonts and opacity.

## PR body draft — pending independent review

**Summary:** Put Tonight's dinner and Pantry entry ahead of secondary controls, simplify first-run and shopping hierarchy, and restrict offline cleanup to Plantry's own caches. Remove stale bindings and document the local test path.

**Evidence:** Compare the five before/after pairs above. Production build, strict typecheck, lint, 199 unit tests, both Chrome smoke widths, the pantry-to-history walk, eight local API route patterns, 24 feed tests and an unsigned native test build passed.

**Review request:** Review the diff and screenshots together, especially the Tonight order, discoverability of join/restore, the mobile zone picker, and service-worker cache ownership. No deployment, merge or PR should precede the requested independent review. Base: `c7bd39e49e96ed1b22e7fe0160717a72192a08ca`.
