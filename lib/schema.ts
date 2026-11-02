import { z } from 'zod'
import type { Settings } from './types'

// Shapes of everything Plantry saves. Used to check data read back from storage
// and data brought in through Import, so a bad value can never crash the app.

const aisle = z.enum([
  'produce',
  'dairy',
  'meat-fish',
  'bakery',
  'pantry',
  'frozen',
  'spices',
  'drinks',
  'other',
])
const taste = z.enum([
  'cozy',
  'fresh',
  'fast',
  'one-pan',
  'veg-forward',
  'spicy',
  'big-batch',
  'kid-friendly',
])
const mood = z.enum(['dawn', 'day', 'dusk', 'night'])
const num = z.number().finite()

export const ingredientSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  quantity: num,
  unit: z.string(),
  aisle: aisle.catch('other'),
  optional: z.boolean().optional(),
})

export const stepSchema = z.object({
  id: z.string(),
  text: z.string(),
  timerMinutes: num.optional(),
  caution: z.string().optional(),
})

export const recipeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().catch(''),
  imageUrl: z.string().optional(),
  activeMinutes: num.catch(0),
  totalMinutes: num.catch(0),
  servings: num.positive().catch(4),
  ingredients: z.array(ingredientSchema),
  steps: z.array(stepSchema),
  tastes: z.array(taste).catch([]),
  weather: z.enum(['warm', 'light', 'any']).optional(),
  leftovers: z.boolean().optional(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  isFavorite: z.boolean().catch(false),
  createdAt: z.string().catch(() => new Date().toISOString()),
  custom: z.boolean().optional(),
})

export const pantrySchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  zone: z.enum(['fridge', 'freezer', 'cupboard', 'counter']).catch('cupboard'),
  aisle: aisle.catch('other'),
  quantity: num.optional(),
  unit: z.string().optional(),
  addedAt: z.string(),
  softLifeDays: num.positive().catch(30),
  staple: z.boolean().optional(),
})

export const planSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(['breakfast', 'lunch', 'dinner']),
  recipeId: z.string().optional(),
  leftoversOf: z.string().optional(),
  note: z.string().optional(),
  servings: num.positive().optional(),
  cookId: z.string().optional(),
  done: z.boolean().optional(),
})

export const shopSchema = z.object({
  id: z.string(),
  name: z.string(),
  key: z.string(),
  quantity: num.optional(),
  unit: z.string().optional(),
  aisle: aisle.catch('other'),
  checked: z.boolean().catch(false),
  fromRecipeIds: z.array(z.string()).catch([]),
  more: z.array(z.object({ quantity: num, unit: z.string() })).optional(),
})

export const memberSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.enum(['terracotta', 'saffron', 'sage', 'plum']).catch('terracotta'),
  isMe: z.boolean().optional(),
  avoid: z.array(z.string()).optional(),
  diet: z.string().optional(),
})

export const handoffSchema = z.object({
  id: z.string(),
  date: z.string(),
  fromId: z.string(),
  toId: z.string(),
  recipeId: z.string().optional(),
  message: z.string().optional(),
  createdAt: z.string(),
  accepted: z.boolean().optional(),
})

export const cookedSchema = z.object({
  recipeId: z.string(),
  date: z.string(),
  cookId: z.string().optional(),
})

export const weatherSchema = z.object({
  tempC: num,
  precipitation: z.boolean(),
  fetchedAt: z.string(),
})

export const defaultSettings: Settings = {
  onboarded: false,
  mood: 'auto',
  reducedMotion: 'system',
  units: 'metric',
  tastes: [],
  weatherEnabled: false,
  householdWord: 'household',
  cookingFor: 2,
  avoid: [],
  cookingWithKids: false,
}

const settingsSchema = z.object({
  onboarded: z.boolean().catch(defaultSettings.onboarded),
  mood: z.union([mood, z.literal('auto')]).catch(defaultSettings.mood),
  reducedMotion: z.enum(['system', 'on', 'off']).catch(defaultSettings.reducedMotion),
  units: z.enum(['metric', 'imperial']).catch(defaultSettings.units),
  tastes: z.array(taste).catch([]),
  weatherEnabled: z.boolean().catch(false),
  householdWord: z.enum(['household', 'family', 'home']).catch('household'),
  cookingFor: z.number().int().min(1).max(24).catch(2),
  avoid: z.array(z.string()).catch([]),
  cookingWithKids: z.boolean().catch(false),
})

/** The persisted collections and the schema for one item of each. */
const collections = {
  members: memberSchema,
  recipes: recipeSchema,
  pantry: pantrySchema,
  plan: planSchema,
  shop: shopSchema,
  shopDismissed: z.string(),
  handoffs: handoffSchema,
  cooked: cookedSchema,
} as const

type CollectionKey = keyof typeof collections

export interface CleanData {
  settings: Settings
  members: z.infer<typeof memberSchema>[]
  recipes: z.infer<typeof recipeSchema>[]
  pantry: z.infer<typeof pantrySchema>[]
  plan: z.infer<typeof planSchema>[]
  shop: z.infer<typeof shopSchema>[]
  shopDismissed: string[]
  handoffs: z.infer<typeof handoffSchema>[]
  cooked: z.infer<typeof cookedSchema>[]
  energyByDate: Record<string, 'up-for-it' | 'quick' | 'cant-tonight'>
  weather?: z.infer<typeof weatherSchema>
}

export interface CleanResult {
  data: Partial<CleanData>
  /** Items or fields that were thrown away because they were the wrong shape. */
  dropped: number
  /** Collections that were present but not a list at all. */
  badCollections: string[]
}

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Keep every value that has the right shape and drop the rest. Never throws.
 * Only keys present in the input are returned, so callers can merge over defaults.
 */
export function cleanData(raw: unknown): CleanResult {
  const out: Partial<CleanData> = {}
  let dropped = 0
  const badCollections: string[] = []
  if (!isObject(raw)) return { data: out, dropped: 0, badCollections: ['all'] }

  if ('settings' in raw) {
    if (isObject(raw.settings))
      out.settings = settingsSchema.parse({ ...defaultSettings, ...raw.settings })
    else badCollections.push('settings')
  }

  for (const key of Object.keys(collections) as CollectionKey[]) {
    if (!(key in raw)) continue
    const value = raw[key]
    if (!Array.isArray(value)) {
      badCollections.push(key)
      continue
    }
    const schema = collections[key] as z.ZodTypeAny
    const kept: unknown[] = []
    for (const item of value) {
      const r = schema.safeParse(item)
      if (r.success) kept.push(r.data)
      else dropped++
    }
    ;(out as Record<string, unknown>)[key] = kept
  }

  if ('energyByDate' in raw) {
    const e = raw.energyByDate
    if (isObject(e)) {
      const clean: CleanData['energyByDate'] = {}
      for (const [k, v] of Object.entries(e)) {
        if (v === 'up-for-it' || v === 'quick' || v === 'cant-tonight') clean[k] = v
        else dropped++
      }
      out.energyByDate = clean
    } else badCollections.push('energyByDate')
  }

  if ('weather' in raw && raw.weather !== undefined) {
    const w = weatherSchema.safeParse(raw.weather)
    if (w.success) out.weather = w.data
  }

  return { data: out, dropped, badCollections }
}

/** Strict check for Import: the file must be a Plantry export with every list intact. */
export function checkImport(
  raw: unknown
): { ok: true; data: CleanData; dropped: number } | { ok: false; error: string } {
  if (!isObject(raw) || !Array.isArray(raw.recipes))
    return { ok: false, error: 'That file does not look like a Plantry export.' }
  const { data, dropped, badCollections } = cleanData(raw)
  if (badCollections.length)
    return {
      ok: false,
      error: `That file has a broken ${badCollections[0]} section, so nothing was imported.`,
    }
  return {
    ok: true,
    dropped,
    data: {
      settings: { ...(data.settings ?? defaultSettings), onboarded: true },
      members: data.members ?? [],
      recipes: data.recipes ?? [],
      pantry: data.pantry ?? [],
      plan: data.plan ?? [],
      shop: data.shop ?? [],
      shopDismissed: data.shopDismissed ?? [],
      handoffs: data.handoffs ?? [],
      cooked: data.cooked ?? [],
      energyByDate: data.energyByDate ?? {},
    },
  }
}
