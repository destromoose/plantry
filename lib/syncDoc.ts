// What a household shares between phones, and how two phones' changes are merged.
//
// The shared document is the household's data minus anything that belongs to one phone
// (mood, text size, language, which person "you" are). It is not the export format: export
// and import stay exactly as they were.
import { canonicalRecipes } from './seed/localize'
//
// Merging is three-way. Each phone remembers the last document it synced (the base). On
// sync it takes the server's latest document and replays its own changes since the base on
// top: things it added, things it deleted, and things it edited. Everything else comes from
// the server, so edits on different items from different phones both survive. When both
// phones edited the same item, the phone syncing now wins for that item.

import type {
  CookedEntry,
  Energy,
  Handoff,
  Member,
  PantryItem,
  PlanEntry,
  Recipe,
  Settings,
  ShopItem,
} from './types'

export const MAX_DOC_BYTES = 2_000_000
export const DOC_VERSION = 1

/** Settings the whole household shares. The rest stay on each phone. */
export const sharedSettingKeys = [
  'cookingFor',
  'avoid',
  'tastes',
  'householdWord',
  'cookingWithKids',
  'units',
  'currency',
  'priceLevel',
  'weeklyBudget',
  'meals',
] as const satisfies readonly (keyof Settings)[]

export type SharedSettings = Pick<Settings, (typeof sharedSettingKeys)[number]>

export interface SyncDoc {
  v: number
  settings: Partial<SharedSettings>
  members: Omit<Member, 'isMe'>[]
  recipes: Recipe[]
  pantry: PantryItem[]
  plan: PlanEntry[]
  shop: ShopItem[]
  shopDismissed: string[]
  handoffs: Handoff[]
  cooked: CookedEntry[]
  energyByDate: Record<string, Energy>
}

export interface SyncSource {
  settings: Settings
  members: Member[]
  recipes: Recipe[]
  pantry: PantryItem[]
  plan: PlanEntry[]
  shop: ShopItem[]
  shopDismissed: string[]
  handoffs: Handoff[]
  cooked: CookedEntry[]
  energyByDate: Record<string, Energy>
}

/** The shared part of this phone's data. */
export function toDoc(s: SyncSource): SyncDoc {
  const settings: Partial<SharedSettings> = {}
  for (const k of sharedSettingKeys) (settings as Record<string, unknown>)[k] = s.settings[k]
  return {
    v: DOC_VERSION,
    settings,
    members: s.members.map((m) => {
      const copy = { ...m }
      delete copy.isMe
      return copy
    }),
    recipes: canonicalRecipes(s.recipes),
    pantry: s.pantry,
    plan: s.plan,
    shop: s.shop,
    shopDismissed: s.shopDismissed,
    handoffs: s.handoffs,
    cooked: s.cooked,
    energyByDate: s.energyByDate,
  }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Three-way merge of a list whose items have an identity. */
function mergeList<T>(
  base: T[] = [],
  local: T[] = [],
  remote: T[] = [],
  idOf: (t: T) => string,
  newFirst = false
): T[] {
  const b = new Map(base.map((x) => [idOf(x), x]))
  const l = new Map(local.map((x) => [idOf(x), x]))
  const out = new Map(remote.map((x) => [idOf(x), x]))
  const added: T[] = []
  for (const [id, item] of l) {
    const was = b.get(id)
    if (!was) {
      if (!out.has(id)) added.push(item)
      else out.set(id, item)
    } else if (!same(was, item)) out.set(id, item)
  }
  for (const id of b.keys()) if (!l.has(id)) out.delete(id)
  const kept = [...out.values()]
  return newFirst ? [...added, ...kept] : [...kept, ...added]
}

function mergeRecord<V>(
  base: Record<string, V> = {},
  local: Record<string, V> = {},
  remote: Record<string, V> = {}
): Record<string, V> {
  const out = { ...remote }
  for (const [k, v] of Object.entries(local)) if (!same(base[k], v)) out[k] = v
  for (const k of Object.keys(base)) if (!(k in local)) delete out[k]
  return out
}

const byId = (x: { id: string }) => x.id
const cookedKey = (c: CookedEntry) => `${c.date}|${c.recipeId}|${c.cookId ?? ''}`
// One planned meal per date and slot, whichever phone made it.
const planKey = (p: PlanEntry) => `${p.date}|${p.slot}`

/** Replay this phone's changes since `base` onto the server's `remote`. */
export function mergeDocs(base: SyncDoc | undefined, local: SyncDoc, remote: SyncDoc): SyncDoc {
  const b = base ?? emptyDoc()
  return {
    v: DOC_VERSION,
    settings: mergeRecord(
      b.settings as Record<string, unknown>,
      local.settings as Record<string, unknown>,
      remote.settings as Record<string, unknown>
    ) as Partial<SharedSettings>,
    members: mergeList(b.members, local.members, remote.members, byId),
    recipes: mergeList(b.recipes, local.recipes, remote.recipes, byId, true),
    pantry: mergeList(b.pantry, local.pantry, remote.pantry, byId, true),
    plan: mergeList(b.plan, local.plan, remote.plan, planKey),
    shop: mergeList(b.shop, local.shop, remote.shop, byId),
    shopDismissed: mergeList(b.shopDismissed, local.shopDismissed, remote.shopDismissed, (k) => k),
    handoffs: mergeList(b.handoffs, local.handoffs, remote.handoffs, byId, true),
    cooked: mergeList(b.cooked, local.cooked, remote.cooked, cookedKey, true).sort((x, y) =>
      x.date < y.date ? 1 : x.date > y.date ? -1 : 0
    ),
    energyByDate: mergeRecord(b.energyByDate, local.energyByDate, remote.energyByDate),
  }
}

export function emptyDoc(): SyncDoc {
  return {
    v: DOC_VERSION,
    settings: {},
    members: [],
    recipes: [],
    pantry: [],
    plan: [],
    shop: [],
    shopDismissed: [],
    handoffs: [],
    cooked: [],
    energyByDate: {},
  }
}

export const docsEqual = same
