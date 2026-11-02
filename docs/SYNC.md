# Household sync

Phones in one household share their plan, pantry, list, recipes and history through a small
API on the web app's own server. There are no accounts: a household is a random 12-character
code (`A-Z` without I, L, O, plus `2-9`), shown as `ABCD-EFGH-JKMN`.

## Hosting

Set Upstash Redis credentials on the deployment. Vercel's Upstash integration sets
`KV_REST_API_URL` and `KV_REST_API_TOKEN`; a direct Upstash database gives
`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. Either pair works. The free tier is
plenty: one key per household, a few KB to a few hundred KB each, kept 400 days after the last
change.

Without credentials, `next dev` and tests use an in-memory store. A production build without
credentials reports sync as off (the Settings card says so) unless `PLANTRY_SYNC_MEMORY=1`,
which is only sensible on a single long-running server.

Service workers must not cache `/api/*`.

## API

All bodies are JSON. Codes in the URL are case-insensitive and may contain dashes.

| Call | Body | Answer |
| --- | --- | --- |
| `GET /api/sync` | | `{ enabled }` |
| `POST /api/sync` | `{ doc }` | `{ code, rev: 1 }` a new household |
| `GET /api/sync/:code` | | `{ rev, doc, updatedAt }`, or 404 |
| `PUT /api/sync/:code` | `{ baseRev, doc }` | `{ rev }`, or 409 with the newer `{ rev, doc, updatedAt }` |

`503` means sync is not set up, `413` means the body is over 2 MB, `400` a bad code or body.

## The shared document

See `lib/syncDoc.ts`. It is the export format's collections (`members`, `recipes`, `pantry`,
`plan`, `shop`, `shopDismissed`, `handoffs`, `cooked`, `energyByDate`) plus a `settings` object
holding only the household-wide settings (`cookingFor`, `avoid`, `tastes`, `householdWord`,
`cookingWithKids`, `units`, `currency`, `priceLevel`, `weeklyBudget`), and `v: 1`. Members have
no `isMe`: each phone remembers which member it is. Per-phone settings (mood, text size,
contrast, motion, weather, language, nutrition switch) never leave the phone. The export
format itself is unchanged.

## Merging

Each phone keeps the last document it agreed on with the server (the base). To sync it pulls
the latest, replays its own changes since the base (added, deleted and edited items, matched
by `id`; plan entries by `date` + `slot`; history by `date` + `recipeId` + `cookId`; settings
and `energyByDate` key by key), and pushes with the revision it pulled. A 409 means another
phone pushed first, so it pulls and merges again. If both phones edited the same item, the one
syncing later wins for that item. Phones sync 1.5 s after a change, on returning to the app,
when coming back online, and every 20 s while open.
