'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Aisle,
  Energy,
  Handoff,
  Member,
  PantryItem,
  PlanEntry,
  Recipe,
  Settings,
  ShopItem,
  Taste,
  Weather,
} from './types'
import { addDays, keyOf, toDateKey, uid } from './utils'
import { addAmount, compatible, subtract, type Amount } from './quantity'
import { defaultLife, guessZone } from './pantryGuess'
import { seedRecipes } from './seed/recipes'
import { staples } from './seed/pantry'
import { checkImport, cleanData, defaultSettings } from './schema'
import { createSafeStorage, useStorageStatus } from './storage'

export interface PlantryState {
  settings: Settings
  members: Member[]
  recipes: Recipe[]
  pantry: PantryItem[]
  plan: PlanEntry[]
  shop: ShopItem[]
  /** Keys of plan items the person removed from the list, so they don't come back. */
  shopDismissed: string[]
  handoffs: Handoff[]
  /** Energy answer for a given date key. */
  energyByDate: Record<string, Energy>
  /** Recipe ids cooked, most recent first. */
  cooked: { recipeId: string; date: string; cookId?: string }[]
  weather?: Weather
  /** Recipe ids seen by the shuffle today, so it does not repeat. */
  shuffleSeen: string[]
  hydrated: boolean
  setHydrated: () => void

  // settings and household
  updateSettings: (patch: Partial<Settings>) => void
  completeOnboarding: (input: {
    members: { name: string }[]
    tastes: Taste[]
    pantryNames: string[]
    avoid?: string[]
  }) => void
  setMemberAvoid: (id: string, avoid: string[]) => void
  setServings: (date: string, servings: number) => void
  addMember: (name: string) => void
  removeMember: (id: string) => void
  renameMember: (id: string, name: string) => void
  setWeather: (w?: Weather) => void

  // recipes
  addRecipe: (
    r: Omit<Recipe, 'id' | 'createdAt' | 'isFavorite' | 'custom'> & { id?: string }
  ) => Recipe
  updateRecipe: (id: string, patch: Partial<Recipe>) => void
  deleteRecipe: (id: string) => void
  toggleFavorite: (id: string) => void

  // pantry
  addPantryItem: (input: {
    name: string
    zone?: PantryItem['zone']
    aisle?: Aisle
    quantity?: number
    unit?: string
    softLifeDays?: number
  }) => 'added' | 'restocked'
  removePantryItem: (id: string) => void
  restockPantryItem: (id: string) => void
  /** Used it up: gone from the pantry, and staples go back on the list. Returns true if listed. */
  useUpPantryItem: (id: string) => boolean
  updatePantryItem: (id: string, patch: Partial<PantryItem>) => void

  // plan
  setPlanEntry: (entry: Omit<PlanEntry, 'id'> & { id?: string }) => void
  clearPlanEntry: (date: string, slot: PlanEntry['slot']) => void
  movePlanEntry: (id: string, toDate: string) => void
  claimNight: (date: string, cookId?: string) => void
  markCooked: (date: string, opts?: { leftovers?: boolean; usePantry?: boolean }) => void
  setEnergy: (date: string, energy: Energy) => void
  setShuffleSeen: (ids: string[]) => void

  // shop
  /** Build the list from planned dinners on these dates. `kept` means nothing was planned, so the list was left alone. */
  generateShop: (dates: string[]) => { fromPlan: number; kept: boolean }
  addShopItem: (
    name: string,
    aisle?: Aisle,
    opts?: { quantity?: number; unit?: string; recipeId?: string }
  ) => 'added' | 'exists'
  /** Let removed plan items come back on the next list. */
  restoreDismissed: () => void
  toggleShopItem: (id: string) => void
  removeShopItem: (id: string) => void
  clearChecked: () => void
  finishShopping: () => void

  // household
  createHandoff: (h: Omit<Handoff, 'id' | 'createdAt'>) => void
  acceptHandoff: (id: string) => void

  // data
  exportData: () => string
  importData: (json: string) => { ok: boolean; error?: string; dropped?: number }
  resetAll: () => void
}

const amountsOf = (i: ShopItem): Amount[] =>
  i.quantity ? [{ quantity: i.quantity, unit: i.unit ?? '' }, ...(i.more ?? [])] : (i.more ?? [])

const memberColors: Member['color'][] = ['terracotta', 'sage', 'saffron', 'plum']

/** The least-used member colour, so colours don't collide after someone is removed. */
function nextColor(members: Member[]): Member['color'] {
  const counts = memberColors.map((c) => members.filter((m) => m.color === c).length)
  return memberColors[counts.indexOf(Math.min(...counts))]
}

function makePantryItem(name: string, now: string, patch: Partial<PantryItem> = {}): PantryItem {
  const key = keyOf(name)
  const staple = staples.find((s) => s.key === key)
  const zone = patch.zone ?? staple?.zone ?? guessZone(name)
  return {
    id: uid('p'),
    // Keep the name the person typed.
    name: name.trim() || staple?.name || '',
    key,
    zone,
    aisle: staple?.aisle ?? 'other',
    softLifeDays: staple?.softLifeDays ?? defaultLife(zone),
    staple: staple?.staple,
    addedAt: now,
    ...patch,
  }
}

export const STORAGE_KEY = 'plantry-v1'
const storage = createSafeStorage<PlantryState>()

export const useStore = create<PlantryState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      members: [],
      recipes: seedRecipes,
      pantry: [],
      plan: [],
      shop: [],
      shopDismissed: [],
      handoffs: [],
      energyByDate: {},
      cooked: [],
      weather: undefined,
      shuffleSeen: [],
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      completeOnboarding: ({ members, tastes, pantryNames, avoid = [] }) => {
        const now = new Date().toISOString()
        const newMembers: Member[] = members
          .filter((m) => m.name.trim())
          .map((m, i) => ({
            id: uid('m'),
            name: m.name.trim(),
            color: memberColors[i % memberColors.length],
            isMe: i === 0,
          }))
        if (newMembers.length === 0)
          newMembers.push({ id: uid('m'), name: 'Me', color: 'terracotta', isMe: true })
        set((s) => ({
          members: newMembers,
          settings: {
            ...s.settings,
            onboarded: true,
            tastes,
            avoid,
            cookingFor: Math.max(1, newMembers.length),
          },
          pantry: pantryNames.map((n) => makePantryItem(n, now)),
        }))
      },

      addMember: (name) =>
        set((s) => ({
          members: [
            ...s.members,
            {
              id: uid('m'),
              name: name.trim(),
              color: nextColor(s.members),
            },
          ],
        })),
      removeMember: (id) =>
        set((s) => ({
          members: s.members.filter((m) => m.id !== id),
          plan: s.plan.map((p) => (p.cookId === id ? { ...p, cookId: undefined } : p)),
          handoffs: s.handoffs.filter((h) => h.fromId !== id && h.toId !== id),
        })),
      setMemberAvoid: (id, avoid) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, avoid } : m)) })),
      setServings: (date, servings) =>
        set((s) => ({
          plan: s.plan.map((p) =>
            p.date === date && p.slot === 'dinner' ? { ...p, servings } : p
          ),
        })),
      renameMember: (id, name) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, name } : m)) })),
      setWeather: (weather) => set({ weather }),

      addRecipe: (r) => {
        const recipe: Recipe = {
          ...r,
          id: r.id ?? uid('r'),
          createdAt: new Date().toISOString(),
          isFavorite: false,
          custom: true,
        }
        set((s) => ({ recipes: [recipe, ...s.recipes] }))
        return recipe
      },
      updateRecipe: (id, patch) =>
        set((s) => ({ recipes: s.recipes.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
      deleteRecipe: (id) =>
        set((s) => ({
          recipes: s.recipes.filter((r) => r.id !== id),
          plan: s.plan.map((p) =>
            p.recipeId === id ? { ...p, recipeId: undefined, note: p.note ?? 'Removed recipe' } : p
          ),
        })),
      toggleFavorite: (id) =>
        set((s) => ({
          recipes: s.recipes.map((r) => (r.id === id ? { ...r, isFavorite: !r.isFavorite } : r)),
        })),

      addPantryItem: ({ name, zone, aisle, quantity, unit, softLifeDays }) => {
        const now = new Date().toISOString()
        const key = keyOf(name)
        const existing = get().pantry.find((p) => p.key === key)
        if (existing) {
          get().restockPantryItem(existing.id)
          return 'restocked'
        }
        const item = makePantryItem(name, now, {
          ...(zone ? { zone } : {}),
          ...(aisle ? { aisle } : {}),
          ...(quantity !== undefined ? { quantity } : {}),
          ...(unit ? { unit } : {}),
          ...(softLifeDays ? { softLifeDays } : {}),
        })
        set((s) => ({ pantry: [item, ...s.pantry] }))
        return 'added'
      },
      removePantryItem: (id) => set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),
      restockPantryItem: (id) =>
        set((s) => ({
          pantry: s.pantry.map((p) =>
            p.id === id ? { ...p, addedAt: new Date().toISOString() } : p
          ),
        })),
      useUpPantryItem: (id) => {
        const item = get().pantry.find((p) => p.id === id)
        set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) }))
        if (!item?.staple) return false
        get().addShopItem(item.name, item.aisle)
        return true
      },
      updatePantryItem: (id, patch) =>
        set((s) => ({
          pantry: s.pantry.map((p) =>
            p.id === id ? { ...p, ...patch, key: keyOf(patch.name ?? p.name) } : p
          ),
        })),

      setPlanEntry: (entry) =>
        set((s) => {
          const rest = s.plan.filter((p) => !(p.date === entry.date && p.slot === entry.slot))
          return { plan: [...rest, { ...entry, id: entry.id ?? uid('pl') }] }
        }),
      clearPlanEntry: (date, slot) =>
        set((s) => ({ plan: s.plan.filter((p) => !(p.date === date && p.slot === slot)) })),
      movePlanEntry: (id, toDate) =>
        set((s) => {
          const moving = s.plan.find((p) => p.id === id)
          if (!moving) return {}
          const displaced = s.plan.find(
            (p) => p.date === toDate && p.slot === moving.slot && p.id !== id
          )
          return {
            plan: s.plan.map((p) => {
              if (p.id === id) return { ...p, date: toDate }
              if (displaced && p.id === displaced.id) return { ...p, date: moving.date }
              return p
            }),
          }
        }),
      claimNight: (date, cookId) =>
        set((s) => {
          const existing = s.plan.find((p) => p.date === date && p.slot === 'dinner')
          if (existing)
            return { plan: s.plan.map((p) => (p.id === existing.id ? { ...p, cookId } : p)) }
          return { plan: [...s.plan, { id: uid('pl'), date, slot: 'dinner', cookId }] }
        }),
      markCooked: (date, opts = {}) => {
        const s = get()
        const entry = s.plan.find((p) => p.date === date && p.slot === 'dinner')
        // Already marked done: a second tap must not log it twice.
        if (!entry || entry.done) return
        const recipe = s.recipes.find((r) => r.id === entry.recipeId)
        let pantry = s.pantry
        let shop = s.shop
        if (recipe && opts.usePantry !== false) {
          const scale =
            (entry.servings ?? s.settings.cookingFor ?? recipe.servings) / recipe.servings
          pantry = pantry.flatMap((p) => {
            const ing = recipe.ingredients.find((i) => !i.optional && i.key === p.key)
            if (!ing) return [p]
            // Known amount: take off what the recipe used.
            if (p.quantity !== undefined && ing.quantity > 0) {
              const left = subtract(
                { quantity: p.quantity, unit: p.unit ?? '' },
                { quantity: ing.quantity * scale, unit: ing.unit }
              )
              if (left) return left.quantity > 0.001 ? [{ ...p, quantity: left.quantity }] : []
            }
            // No amount to go by: fresh things are used up, cupboard things stay.
            return p.softLifeDays <= 14 ? [] : [p]
          })
        }
        if (recipe) {
          // The dinner is eaten, so its unbought list items can go.
          shop = shop
            .filter(
              (i) =>
                i.checked || !(i.fromRecipeIds.length === 1 && i.fromRecipeIds[0] === recipe.id)
            )
            .map((i) =>
              i.fromRecipeIds.includes(recipe.id) && i.fromRecipeIds.length > 1
                ? { ...i, fromRecipeIds: i.fromRecipeIds.filter((r) => r !== recipe.id) }
                : i
            )
        }
        let plan = s.plan.map((p) => (p.id === entry.id ? { ...p, done: true } : p))
        if (opts.leftovers && recipe) {
          const next = addDays(date, 1)
          const taken = plan.find(
            (p) => p.date === next && p.slot === 'dinner' && (p.recipeId || p.note)
          )
          if (!taken) {
            plan = plan.filter((p) => !(p.date === next && p.slot === 'dinner'))
            plan.push({ id: uid('pl'), date: next, slot: 'dinner', leftoversOf: recipe.id })
          }
        }
        set({
          pantry,
          shop,
          plan,
          cooked: [
            { recipeId: entry.recipeId ?? entry.leftoversOf ?? '', date, cookId: entry.cookId },
            ...s.cooked,
          ],
        })
      },
      setEnergy: (date, energy) =>
        set((s) => ({ energyByDate: { ...s.energyByDate, [date]: energy } })),
      setShuffleSeen: (ids) => set({ shuffleSeen: ids }),

      generateShop: (dates) => {
        const s = get()
        const today = toDateKey(new Date())
        const dismissed = new Set(s.shopDismissed)
        const needed = new Map<string, { item: ShopItem; amounts: Amount[] }>()
        for (const entry of s.plan) {
          // Only dinners still to come: eaten or past nights don't need shopping.
          if (!dates.includes(entry.date) || entry.date < today) continue
          if (!entry.recipeId || entry.done) continue
          const recipe = s.recipes.find((r) => r.id === entry.recipeId)
          if (!recipe) continue
          const scale =
            (entry.servings ?? s.settings.cookingFor ?? recipe.servings) / recipe.servings
          for (const ing of recipe.ingredients) {
            if (ing.optional || dismissed.has(ing.key)) continue
            const cur = needed.get(ing.key) ?? {
              item: {
                id: uid('sh'),
                name: ing.name,
                key: ing.key,
                aisle: ing.aisle,
                checked: false,
                fromRecipeIds: [],
              },
              amounts: [],
            }
            if (ing.quantity > 0)
              cur.amounts = addAmount(cur.amounts, {
                quantity: ing.quantity * scale,
                unit: ing.unit,
              })
            if (!cur.item.fromRecipeIds.includes(recipe.id)) cur.item.fromRecipeIds.push(recipe.id)
            needed.set(ing.key, cur)
          }
        }
        // Take off what the pantry already covers. Without a known amount, assume enough.
        for (const [key, cur] of needed) {
          const have = s.pantry.find((p) => p.key === key)
          if (!have) continue
          const i = cur.amounts.findIndex((a) => compatible(a.unit, have.unit ?? ''))
          if (have.quantity === undefined || i === -1) {
            needed.delete(key)
            continue
          }
          const left = subtract(cur.amounts[i], { quantity: have.quantity, unit: have.unit ?? '' })
          const rest =
            left && left.quantity > 0.001
              ? cur.amounts.map((a, j) => (j === i ? left : a))
              : cur.amounts.filter((_, j) => j !== i)
          if (rest.length === 0) needed.delete(key)
          else cur.amounts = rest
        }
        const old = new Map(s.shop.map((i) => [i.key, i]))
        const generated: ShopItem[] = [...needed.values()].map(({ item, amounts }) => {
          // A manual row for the same thing merges in instead of showing twice.
          const prev = old.get(item.key)
          let all = amounts
          if (prev && prev.fromRecipeIds.length === 0 && prev.quantity)
            all = addAmount(all, { quantity: prev.quantity, unit: prev.unit ?? '' })
          return {
            ...item,
            id: prev?.id ?? item.id,
            checked: prev?.checked ?? false,
            quantity: all[0]?.quantity,
            unit: all[0]?.unit,
            ...(all.length > 1 ? { more: all.slice(1) } : {}),
          }
        })
        const keys = new Set(generated.map((g) => g.key))
        const loose = s.shop.filter((i) => i.fromRecipeIds.length === 0 && !keys.has(i.key))
        // Never swap a list that has plan items for an empty one without asking.
        if (generated.length === 0 && s.shop.some((i) => i.fromRecipeIds.length > 0))
          return { fromPlan: 0, kept: true }
        set({ shop: [...generated, ...loose] })
        return { fromPlan: generated.length, kept: false }
      },
      addShopItem: (name, aisle, opts = {}) => {
        const key = keyOf(name)
        const dismissed = get().shopDismissed.filter((k) => k !== key)
        const existing = get().shop.find((i) => i.key === key)
        if (existing) {
          // Already there: add the amount and the recipe instead of a second row.
          if (opts.quantity || opts.recipeId)
            set((s) => ({
              shopDismissed: dismissed,
              shop: s.shop.map((i) => {
                if (i.id !== existing.id) return i
                const list = opts.quantity
                  ? addAmount(amountsOf(i), { quantity: opts.quantity, unit: opts.unit ?? '' })
                  : amountsOf(i)
                return {
                  ...i,
                  quantity: list[0]?.quantity,
                  unit: list[0]?.unit,
                  more: list.length > 1 ? list.slice(1) : undefined,
                  fromRecipeIds:
                    opts.recipeId && !i.fromRecipeIds.includes(opts.recipeId)
                      ? [...i.fromRecipeIds, opts.recipeId]
                      : i.fromRecipeIds,
                }
              }),
            }))
          return 'exists'
        }
        const staple = staples.find((st) => st.key === key)
        set((s) => ({
          shopDismissed: dismissed,
          shop: [
            ...s.shop,
            {
              id: uid('sh'),
              name: name.trim(),
              key,
              aisle: aisle ?? staple?.aisle ?? 'other',
              checked: false,
              fromRecipeIds: opts.recipeId ? [opts.recipeId] : [],
              ...(opts.quantity ? { quantity: opts.quantity, unit: opts.unit ?? '' } : {}),
            },
          ],
        }))
        return 'added'
      },
      toggleShopItem: (id) =>
        set((s) => ({
          shop: s.shop.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
        })),
      removeShopItem: (id) =>
        set((s) => {
          const item = s.shop.find((i) => i.id === id)
          const fromPlan = !!item && item.fromRecipeIds.length > 0
          return {
            shop: s.shop.filter((i) => i.id !== id),
            shopDismissed:
              fromPlan && !s.shopDismissed.includes(item.key)
                ? [...s.shopDismissed, item.key]
                : s.shopDismissed,
          }
        }),
      restoreDismissed: () => set({ shopDismissed: [] }),
      clearChecked: () => set((s) => ({ shop: s.shop.filter((i) => !i.checked) })),
      finishShopping: () => {
        const s = get()
        const now = new Date().toISOString()
        const checked = s.shop.filter((i) => i.checked)
        const pantry = [...s.pantry]
        for (const item of checked) {
          const existing = pantry.find((p) => p.key === item.key)
          if (existing) existing.addedAt = now
          else
            pantry.unshift(
              makePantryItem(item.name, now, {
                aisle: item.aisle,
                quantity: item.quantity,
                unit: item.unit,
              })
            )
        }
        set({ pantry, shop: s.shop.filter((i) => !i.checked), shopDismissed: [] })
      },

      createHandoff: (h) =>
        set((s) => ({
          handoffs: [{ ...h, id: uid('h'), createdAt: new Date().toISOString() }, ...s.handoffs],
          plan: s.plan.map((p) =>
            p.date === h.date && p.slot === 'dinner' ? { ...p, cookId: h.toId } : p
          ),
        })),
      acceptHandoff: (id) =>
        set((s) => ({
          handoffs: s.handoffs.map((h) => (h.id === id ? { ...h, accepted: true } : h)),
        })),

      exportData: () => {
        const s = get()
        const {
          settings,
          members,
          recipes,
          pantry,
          plan,
          shop,
          shopDismissed,
          handoffs,
          energyByDate,
          cooked,
        } = s
        return JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            settings,
            members,
            recipes,
            pantry,
            plan,
            shop,
            shopDismissed,
            handoffs,
            energyByDate,
            cooked,
          },
          null,
          2
        )
      },
      importData: (json) => {
        let raw: unknown
        try {
          raw = JSON.parse(json)
        } catch {
          return { ok: false, error: 'Could not read that file.' }
        }
        const res = checkImport(raw)
        if (!res.ok) return { ok: false, error: res.error }
        set({
          ...res.data,
          recipes: res.data.recipes.length ? res.data.recipes : seedRecipes,
          shuffleSeen: [],
        })
        return { ok: true, dropped: res.dropped }
      },
      resetAll: () =>
        set({
          settings: defaultSettings,
          members: [],
          recipes: seedRecipes,
          pantry: [],
          plan: [],
          shop: [],
          shopDismissed: [],
          handoffs: [],
          energyByDate: {},
          cooked: [],
          shuffleSeen: [],
          weather: undefined,
        }),
    }),
    {
      name: STORAGE_KEY,
      version: 2,
      storage,
      partialize: (s) =>
        ({
          settings: s.settings,
          members: s.members,
          recipes: s.recipes,
          pantry: s.pantry,
          plan: s.plan,
          shop: s.shop,
          shopDismissed: s.shopDismissed,
          handoffs: s.handoffs,
          energyByDate: s.energyByDate,
          cooked: s.cooked,
          weather: s.weather,
        }) as unknown as PlantryState,
      // Older saves have the same shape; anything off is cleaned in merge below.
      migrate: (persisted) => persisted as PlantryState,
      merge: (persisted, current) => {
        const { data, dropped } = cleanData(persisted)
        if (dropped) useStorageStatus.setState({ droppedItems: dropped })
        // Keys are recomputed on load so matching rules can improve over time.
        if (data.pantry) data.pantry = data.pantry.map((p) => ({ ...p, key: keyOf(p.name) }))
        if (data.shop) data.shop = data.shop.map((i) => ({ ...i, key: keyOf(i.name) }))
        return {
          ...current,
          ...data,
          settings: { ...current.settings, ...(data.settings ?? {}) },
          recipes: data.recipes && data.recipes.length ? data.recipes : current.recipes,
        } as PlantryState
      },
      onRehydrateStorage: () => () => {
        // Always leave the splash screen, even when reading failed. Deferred because the
        // first hydration runs while useStore is still being created.
        queueMicrotask(() => useStore.setState({ hydrated: true }))
      },
    }
  )
)

// Another open tab saved: load its copy so the two tabs don't overwrite each other.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) void useStore.persist.rehydrate()
  })
}
