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
  }) => void
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
  }) => void
  removePantryItem: (id: string) => void
  restockPantryItem: (id: string) => void
  useUpPantryItem: (id: string) => void

  // plan
  setPlanEntry: (entry: Omit<PlanEntry, 'id'> & { id?: string }) => void
  clearPlanEntry: (date: string, slot: PlanEntry['slot']) => void
  movePlanEntry: (id: string, toDate: string) => void
  claimNight: (date: string, cookId?: string) => void
  markCooked: (date: string, opts?: { leftovers?: boolean; usePantry?: boolean }) => void
  setEnergy: (date: string, energy: Energy) => void
  setShuffleSeen: (ids: string[]) => void

  // shop
  generateShop: (dates: string[]) => void
  addShopItem: (name: string, aisle?: Aisle) => void
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

const memberColors: Member['color'][] = ['terracotta', 'sage', 'saffron', 'plum']

/** The least-used member colour, so colours don't collide after someone is removed. */
function nextColor(members: Member[]): Member['color'] {
  const counts = memberColors.map((c) => members.filter((m) => m.color === c).length)
  return memberColors[counts.indexOf(Math.min(...counts))]
}

function makePantryItem(name: string, now: string, patch: Partial<PantryItem> = {}): PantryItem {
  const key = keyOf(name)
  const staple = staples.find((s) => s.key === key)
  return {
    id: uid('p'),
    name: staple?.name ?? name.trim(),
    key,
    zone: staple?.zone ?? 'cupboard',
    aisle: staple?.aisle ?? 'other',
    softLifeDays: staple?.softLifeDays ?? 30,
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
      handoffs: [],
      energyByDate: {},
      cooked: [],
      weather: undefined,
      shuffleSeen: [],
      hydrated: false,
      setHydrated: () => set({ hydrated: true }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      completeOnboarding: ({ members, tastes, pantryNames }) => {
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
          settings: { ...s.settings, onboarded: true, tastes },
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
          return
        }
        const item = makePantryItem(name, now, {
          ...(zone ? { zone } : {}),
          ...(aisle ? { aisle } : {}),
          ...(quantity !== undefined ? { quantity } : {}),
          ...(unit ? { unit } : {}),
          ...(softLifeDays ? { softLifeDays } : {}),
        })
        set((s) => ({ pantry: [item, ...s.pantry] }))
      },
      removePantryItem: (id) => set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),
      restockPantryItem: (id) =>
        set((s) => ({
          pantry: s.pantry.map((p) =>
            p.id === id ? { ...p, addedAt: new Date().toISOString() } : p
          ),
        })),
      useUpPantryItem: (id) => set((s) => ({ pantry: s.pantry.filter((p) => p.id !== id) })),

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
        if (!entry) return
        const recipe = s.recipes.find((r) => r.id === entry.recipeId)
        let pantry = s.pantry
        if (opts.usePantry !== false && recipe) {
          const perishableKeys = new Set(
            recipe.ingredients
              .filter(
                (i) => !i.optional && ['produce', 'meat-fish', 'dairy', 'bakery'].includes(i.aisle)
              )
              .map((i) => i.key)
          )
          pantry = pantry.filter((p) => !(perishableKeys.has(p.key) && !p.staple))
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
        const pantryKeys = new Set(s.pantry.map((p) => p.key))
        const needed = new Map<string, ShopItem>()
        for (const entry of s.plan) {
          if (!dates.includes(entry.date) || !entry.recipeId || entry.done) continue
          const recipe = s.recipes.find((r) => r.id === entry.recipeId)
          if (!recipe) continue
          const scale = entry.servings ? entry.servings / recipe.servings : 1
          for (const ing of recipe.ingredients) {
            if (ing.optional || pantryKeys.has(ing.key)) continue
            const prev = needed.get(ing.key)
            if (prev) {
              needed.set(ing.key, {
                ...prev,
                quantity:
                  prev.unit === ing.unit && prev.quantity !== undefined
                    ? prev.quantity + ing.quantity * scale
                    : prev.quantity,
                fromRecipeIds: [...new Set([...prev.fromRecipeIds, recipe.id])],
              })
            } else {
              needed.set(ing.key, {
                id: uid('sh'),
                name: ing.name,
                key: ing.key,
                quantity: ing.quantity * scale,
                unit: ing.unit,
                aisle: ing.aisle,
                checked: false,
                fromRecipeIds: [recipe.id],
              })
            }
          }
        }
        const loose = s.shop.filter((i) => i.fromRecipeIds.length === 0)
        const existingChecked = new Map(s.shop.map((i) => [i.key, i.checked]))
        const generated = [...needed.values()].map((i) => ({
          ...i,
          checked: existingChecked.get(i.key) ?? false,
        }))
        set({ shop: [...generated, ...loose] })
      },
      addShopItem: (name, aisle) => {
        const key = keyOf(name)
        if (get().shop.some((i) => i.key === key)) return
        const staple = staples.find((st) => st.key === key)
        set((s) => ({
          shop: [
            ...s.shop,
            {
              id: uid('sh'),
              name: name.trim(),
              key,
              aisle: aisle ?? staple?.aisle ?? 'other',
              checked: false,
              fromRecipeIds: [],
            },
          ],
        }))
      },
      toggleShopItem: (id) =>
        set((s) => ({
          shop: s.shop.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)),
        })),
      removeShopItem: (id) => set((s) => ({ shop: s.shop.filter((i) => i.id !== id) })),
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
        set({ pantry, shop: s.shop.filter((i) => !i.checked) })
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
        const { settings, members, recipes, pantry, plan, shop, handoffs, energyByDate, cooked } = s
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
