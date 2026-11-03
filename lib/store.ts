'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Aisle,
  CookedEntry,
  Rating,
  Energy,
  Handoff,
  HouseNote,
  MealIdea,
  MealSlot,
  Member,
  NoteReply,
  Presence,
  PantryItem,
  PlanEntry,
  Recipe,
  RepeatMeal,
  Settings,
  ShopItem,
  ShopTrip,
  Taste,
  Weather,
} from './types'
import { addDays, keyOf, toDateKey, uid } from './utils'
import { addAmount, compatible, subtract, type Amount } from './quantity'
import { defaultLife, guessZone } from './pantryGuess'
import {
  canonicalRecipes,
  localSeedRecipes,
  localizeRecipes,
  newSeedRecipes,
} from './seed/localize'
import { SEED_VERSION, seedRecipes } from './seed/recipes'
import { staples } from './seed/pantry'
import { checkImport, cleanData, defaultSettings } from './schema'
import { createSafeStorage, useStorageStatus } from './storage'
import { guessCurrency } from './cost'
import { t } from './i18n'
import { guessAisle } from './pantryGuess'
import type { CapturedItem } from './capture'
import { cleanBought, recordTrip, type Bought } from './usuals'
import { eatersFor, presenceKey, pruneNotes, weeklyKey } from './together'
import { splitByAisle } from './shopTogether'
import { copyWeek, repeatsInto } from './planTogether'
import { keepActivity, type Activity } from './activity'

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
  /** Dinners cooked, most recent first. */
  cooked: CookedEntry[]
  weather?: Weather
  /** Recipe ids seen by the shuffle today, so it does not repeat. */
  shuffleSeen: string[]
  /** What this phone has bought, trip by trip, for "Your usuals". */
  bought: Bought
  /** Who's home for which meal: `date|slot|memberId`. Shared with the household. */
  presence: Record<string, Presence>
  /** Someone's usual week: `weekday|slot|memberId`, Sunday is 0. */
  presenceWeekly: Record<string, Presence>
  /** Notes on days, list items and the fridge board. */
  notes: HouseNote[]
  replies: NoteReply[]
  /** Who's out shopping right now, shared with the household. */
  shopTrip: ShopTrip
  /** Meals someone fancies, waiting for a night. */
  ideas: MealIdea[]
  /** Meals the household has every week. */
  repeats: RepeatMeal[]
  /** What the others changed, as this phone saw it come in. Not synced. */
  activity: Activity[]
  /** When this person last read it. */
  activitySeenAt?: string
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
  setMemberCooks: (id: string, cooks: boolean) => void
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
  markCooked: (
    date: string,
    opts?: {
      leftovers?: boolean
      usePantry?: boolean
      replaceTomorrow?: boolean
      rating?: Rating
      note?: string
    }
  ) => void
  /** Rate a dinner in the history, or change its note. */
  rateCooked: (date: string, recipeId: string, patch: { rating?: Rating; note?: string }) => void
  setEnergy: (date: string, energy: Energy) => void
  setShuffleSeen: (ids: string[]) => void

  // together
  setPresence: (date: string, slot: MealSlot, memberId: string, p: Presence | undefined) => void
  setWeeklyPresence: (
    dow: number,
    slot: MealSlot,
    memberId: string,
    p: Presence | undefined
  ) => void
  addNote: (note: Omit<HouseNote, 'id' | 'at' | 'by'>) => HouseNote
  removeNote: (id: string) => void
  togglePinNote: (id: string) => void
  addReply: (noteId: string, text: string) => void

  // planning ahead
  addIdea: (idea: { text?: string; recipeId?: string }) => MealIdea | undefined
  removeIdea: (id: string) => void
  /** "Me too" on someone's idea, or take it back. */
  toggleIdeaVote: (id: string) => void
  /** Put an idea on a night's dinner; it leaves the pool. */
  planIdea: (id: string, date: string) => void
  /** Have this night's dinner every week on this weekday. */
  repeatEveryWeek: (date: string, slot: MealSlot) => void
  stopRepeat: (id: string) => void
  /** Last week's meals and the weekly ones onto this week's empty slots. Returns how many. */
  copyLastWeek: (dates: string[], today: string) => number
  addActivity: (fresh: Activity[]) => void
  markActivitySeen: () => void

  // shop
  /** Build the list from planned dinners on these dates. `kept` means nothing was planned, so the list was left alone. */
  generateShop: (dates: string[]) => { fromPlan: number; kept: boolean }
  addShopItem: (
    name: string,
    aisle?: Aisle,
    opts?: { quantity?: number; unit?: string; recipeId?: string; usedUp?: boolean }
  ) => 'added' | 'exists'
  /** "I'm at the shop": the others see it and their adds show up live. */
  startShopTrip: () => void
  endShopTrip: () => void
  /** Split the list by aisle between the people at home, or undo it. */
  splitShop: () => number
  clearSplit: () => void
  /** Let removed plan items come back on the next list. */
  restoreDismissed: () => void
  toggleShopItem: (id: string) => void
  removeShopItem: (id: string) => void
  clearChecked: () => void
  /** Add a spoken or typed brain dump. Things said as "out of" also leave the pantry. */
  addCaptured: (items: CapturedItem[]) => { added: string[]; already: string[] }
  clearShop: () => void
  updateShopItem: (id: string, patch: { name?: string; quantity?: number; unit?: string }) => void
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
export function nextColor(members: Member[]): Member['color'] {
  const counts = memberColors.map((c) => members.filter((m) => m.color === c).length)
  return memberColors[counts.indexOf(Math.min(...counts))]
}

/** Who cooked a night nobody claimed: this phone's person, or the only cook. */
function whoCooks(members: Member[]): string | undefined {
  const me = members.find((m) => m.isMe && m.cooks !== false)
  if (me) return me.id
  const cooks = members.filter((m) => m.cooks !== false)
  return cooks.length === 1 ? cooks[0].id : undefined
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

/** Units and currency that fit where this device is, picked once at onboarding. */
function localDefaults(): Partial<Settings> {
  if (typeof navigator === 'undefined') return {}
  const region = (navigator.language.split('-')[1] ?? '').toUpperCase()
  const currency = guessCurrency(region)
  return {
    ...(currency ? { currency } : {}),
    ...(region === 'US' || region === 'LR' || region === 'MM' ? { units: 'imperial' } : {}),
  }
}

export const STORAGE_KEY = 'plantry-v1'
const storage = createSafeStorage<PlantryState>()

export const useStore = create<PlantryState>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      members: [],
      recipes: localSeedRecipes(),
      pantry: [],
      plan: [],
      shop: [],
      shopDismissed: [],
      handoffs: [],
      energyByDate: {},
      cooked: [],
      weather: undefined,
      shuffleSeen: [],
      bought: {},
      presence: {},
      presenceWeekly: {},
      notes: [],
      replies: [],
      shopTrip: {},
      ideas: [],
      repeats: [],
      activity: [],
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
          newMembers.push({ id: uid('m'), name: t('Me'), color: 'terracotta', isMe: true })
        set((s) => ({
          members: newMembers,
          settings: {
            ...s.settings,
            onboarded: true,
            tastes,
            avoid,
            cookingFor: Math.max(1, newMembers.length),
            ...localDefaults(),
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
      setMemberCooks: (id, cooks) =>
        set((s) => ({
          members: s.members.map((m) => (m.id === id ? { ...m, cooks } : m)),
          // Someone who doesn't cook can't be down to cook a night.
          plan: cooks
            ? s.plan
            : s.plan.map((p) => (p.cookId === id ? { ...p, cookId: undefined } : p)),
          handoffs: cooks ? s.handoffs : s.handoffs.filter((h) => h.toId !== id),
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
            p.recipeId === id
              ? { ...p, recipeId: undefined, note: p.note ?? t('Removed recipe') }
              : p
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
        get().addShopItem(item.name, item.aisle, { usedUp: true })
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
        set((s) => {
          const gone = s.plan.find((p) => p.date === date && p.slot === slot)
          // Its leftovers night the day after has nothing to be left over from any more.
          const orphan = gone?.recipeId
            ? s.plan.find(
                (p) =>
                  p.date === addDays(date, 1) && p.slot === slot && p.leftoversOf === gone.recipeId
              )
            : undefined
          return { plan: s.plan.filter((p) => p !== gone && p !== orphan) }
        }),
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
          const eaters = eatersFor(
            s.members,
            s.presence,
            s.presenceWeekly,
            date,
            'dinner',
            s.settings.cookingFor
          )
          const scale =
            (entry.servings ?? eaters ?? s.settings.cookingFor ?? recipe.servings) / recipe.servings
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
          if (!taken || opts.replaceTomorrow) {
            plan = plan.filter((p) => !(p.date === next && p.slot === 'dinner'))
            plan.push({ id: uid('pl'), date: next, slot: 'dinner', leftoversOf: recipe.id })
          }
        }
        set({
          pantry,
          shop,
          plan,
          cooked: [
            {
              recipeId: entry.recipeId ?? entry.leftoversOf ?? '',
              date,
              cookId: entry.cookId ?? whoCooks(s.members),
              ...(opts.rating ? { rating: opts.rating } : {}),
              ...(opts.note?.trim() ? { note: opts.note.trim().slice(0, 500) } : {}),
            },
            ...s.cooked,
          ],
        })
      },
      rateCooked: (date, recipeId, patch) =>
        set((s) => {
          const i = s.cooked.findIndex((c) => c.date === date && c.recipeId === recipeId)
          if (i === -1) return {}
          const cooked = [...s.cooked]
          const note = patch.note === undefined ? cooked[i].note : patch.note.trim().slice(0, 500)
          cooked[i] = {
            ...cooked[i],
            ...('rating' in patch ? { rating: patch.rating } : {}),
            note: note || undefined,
          }
          return { cooked }
        }),
      setEnergy: (date, energy) =>
        set((s) => ({ energyByDate: { ...s.energyByDate, [date]: energy } })),
      setShuffleSeen: (ids) => set({ shuffleSeen: ids }),

      setPresence: (date, slot, memberId, p) =>
        set((s) => {
          const presence = { ...s.presence }
          const k = presenceKey(date, slot, memberId)
          if (p) presence[k] = p
          else delete presence[k]
          return { presence }
        }),
      setWeeklyPresence: (dow, slot, memberId, p) =>
        set((s) => {
          const presenceWeekly = { ...s.presenceWeekly }
          const k = weeklyKey(dow, slot, memberId)
          if (p && p !== 'home') presenceWeekly[k] = p
          else delete presenceWeekly[k]
          return { presenceWeekly }
        }),
      addIdea: ({ text, recipeId }) => {
        const clean = text?.trim().slice(0, 120)
        if (!clean && !recipeId) return undefined
        const s = get()
        const dupe = s.ideas.find((i) =>
          recipeId ? i.recipeId === recipeId : i.text?.toLowerCase() === clean?.toLowerCase()
        )
        if (dupe) return dupe
        const idea: MealIdea = {
          id: uid('id'),
          ...(recipeId ? { recipeId } : { text: clean }),
          by: s.members.find((m) => m.isMe)?.id,
          at: new Date().toISOString(),
        }
        set({ ideas: [idea, ...s.ideas].slice(0, 60) })
        return idea
      },
      removeIdea: (id) => set((s) => ({ ideas: s.ideas.filter((i) => i.id !== id) })),
      toggleIdeaVote: (id) =>
        set((s) => {
          const me = s.members.find((m) => m.isMe)?.id
          if (!me) return {}
          return {
            ideas: s.ideas.map((i) => {
              if (i.id !== id) return i
              const votes = i.votes ?? []
              const next = votes.includes(me) ? votes.filter((v) => v !== me) : [...votes, me]
              return { ...i, votes: next.length ? next : undefined }
            }),
          }
        }),
      planIdea: (id, date) => {
        const s = get()
        const idea = s.ideas.find((i) => i.id === id)
        if (!idea) return
        const cur = s.plan.find((p) => p.date === date && p.slot === 'dinner')
        s.setPlanEntry({
          date,
          slot: 'dinner',
          recipeId: idea.recipeId,
          note: idea.recipeId ? undefined : idea.text,
          cookId: cur?.cookId,
        })
        set((st) => ({ ideas: st.ideas.filter((i) => i.id !== id) }))
      },
      repeatEveryWeek: (date, slot) =>
        set((s) => {
          const e = s.plan.find((p) => p.date === date && p.slot === slot)
          if (!e || !(e.recipeId || e.note)) return {}
          const weekday = new Date(`${date}T12:00:00`).getDay()
          const rest = s.repeats.filter((r) => !(r.weekday === weekday && r.slot === slot))
          const r: RepeatMeal = {
            id: uid('rp'),
            weekday,
            slot,
            ...(e.recipeId ? { recipeId: e.recipeId } : { note: e.note }),
            by: s.members.find((m) => m.isMe)?.id,
          }
          return { repeats: [...rest, r] }
        }),
      stopRepeat: (id) => set((s) => ({ repeats: s.repeats.filter((r) => r.id !== id) })),
      copyLastWeek: (dates, today) => {
        const s = get()
        const weekly = repeatsInto(s.plan, s.repeats, dates, today)
        const withWeekly = [...s.plan, ...weekly.map((e) => ({ ...e, id: 'tmp' }))]
        const copied = copyWeek(withWeekly, dates, today)
        const add = [...weekly, ...copied]
        if (!add.length) return 0
        set((st) => {
          const taken = new Set(add.map((e) => `${e.date}|${e.slot}`))
          return {
            plan: [
              ...st.plan.filter((p) => !taken.has(`${p.date}|${p.slot}`)),
              ...add.map((e) => ({ ...e, id: uid('pl') })),
            ],
          }
        })
        return add.length
      },
      addActivity: (fresh) => {
        if (fresh.length) set((s) => ({ activity: keepActivity(s.activity, fresh) }))
      },
      markActivitySeen: () => set({ activitySeenAt: new Date().toISOString() }),
      addNote: (input) => {
        const note: HouseNote = {
          ...input,
          text: input.text.trim().slice(0, 500),
          id: uid('nt'),
          at: new Date().toISOString(),
          by: get().members.find((m) => m.isMe)?.id,
        }
        set((s) => {
          const pruned = pruneNotes([note, ...s.notes], s.replies, toDateKey(new Date()))
          return pruned
        })
        return note
      },
      removeNote: (id) =>
        set((s) => ({
          notes: s.notes.filter((n) => n.id !== id),
          replies: s.replies.filter((r) => r.noteId !== id),
        })),
      togglePinNote: (id) =>
        set((s) => ({
          notes: s.notes.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)),
        })),
      addReply: (noteId, text) =>
        set((s) => ({
          replies: [
            ...s.replies,
            {
              id: uid('rp'),
              noteId,
              text: text.trim().slice(0, 200),
              at: new Date().toISOString(),
              by: s.members.find((m) => m.isMe)?.id,
            },
          ],
        })),

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
          const eaters = eatersFor(
            s.members,
            s.presence,
            s.presenceWeekly,
            entry.date,
            entry.slot,
            s.settings.cookingFor
          )
          // Nobody's home for it: nothing to buy.
          if (eaters === 0) continue
          const scale =
            (entry.servings ?? eaters ?? s.settings.cookingFor ?? recipe.servings) / recipe.servings
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
        const me = s.members.find((m) => m.isMe)?.id
        const now = new Date().toISOString()
        const generated: ShopItem[] = [...needed.values()].map(({ item, amounts }) => {
          // A manual row for the same thing merges in instead of showing twice.
          const prev = old.get(item.key)
          let all = amounts
          if (prev && prev.fromRecipeIds.length === 0 && prev.quantity)
            all = addAmount(all, { quantity: prev.quantity, unit: prev.unit ?? '' })
          // Who added, ticked or was given a row stays with it when the list is rebuilt.
          const keep = prev
            ? {
                addedBy: prev.addedBy,
                addedAt: prev.addedAt,
                checkedBy: prev.checkedBy,
                usedUp: prev.usedUp,
                splitTo: prev.splitTo,
              }
            : { addedBy: me, addedAt: now }
          return {
            ...item,
            ...Object.fromEntries(Object.entries(keep).filter(([, v]) => v !== undefined)),
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
          if (opts.quantity || opts.recipeId || (opts.usedUp && !existing.usedUp))
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
                  ...(opts.usedUp && !i.usedUp
                    ? { usedUp: true, addedBy: s.members.find((m) => m.isMe)?.id ?? i.addedBy }
                    : {}),
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
              addedBy: s.members.find((m) => m.isMe)?.id,
              addedAt: new Date().toISOString(),
              ...(opts.usedUp ? { usedUp: true } : {}),
            },
          ],
        }))
        return 'added'
      },
      toggleShopItem: (id) =>
        set((s) => ({
          shop: s.shop.map((i) => {
            if (i.id !== id) return i
            const checked = !i.checked
            const by = checked ? s.members.find((m) => m.isMe)?.id : undefined
            const next = { ...i, checked, checkedBy: by }
            if (!by) delete next.checkedBy
            return next
          }),
        })),
      startShopTrip: () =>
        set((s) => ({
          shopTrip: {
            by: s.members.find((m) => m.isMe)?.id ?? s.members[0]?.id,
            since: new Date().toISOString(),
          },
        })),
      endShopTrip: () => set({ shopTrip: {} }),
      splitShop: () => {
        const s = get()
        const people = s.members.filter((m) => m.cooks !== false).map((m) => m.id)
        const who = splitByAisle(s.shop, people.length > 1 ? people : s.members.map((m) => m.id))
        const n = Object.keys(who).length
        if (n) set({ shop: s.shop.map((i) => (who[i.id] ? { ...i, splitTo: who[i.id] } : i)) })
        return n
      },
      clearSplit: () =>
        set((s) => ({
          shop: s.shop.map(({ splitTo: _splitTo, ...i }) => i),
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
      clearChecked: () =>
        set((s) => ({
          shop: s.shop.filter((i) => !i.checked),
          bought: recordTrip(
            s.bought,
            s.shop.filter((i) => i.checked),
            toDateKey(new Date())
          ),
        })),
      addCaptured: (items) => {
        const added: string[] = []
        const already: string[] = []
        for (const item of items) {
          const key = keyOf(item.name)
          const known = get().bought[key]
          const result = get().addShopItem(item.name, known?.aisle ?? guessAisle(item.name), {
            quantity: item.quantity,
            unit: item.unit,
            // "We're out of eggs" means someone used the last of them.
            usedUp: item.outOf,
          })
          ;(result === 'exists' ? already : added).push(item.name)
        }
        const gone = new Set(items.filter((i) => i.outOf).map((i) => keyOf(i.name)))
        if (gone.size) set((s) => ({ pantry: s.pantry.filter((p) => !gone.has(p.key)) }))
        return { added, already }
      },

      clearShop: () => set({ shop: [] }),
      updateShopItem: (id, patch) =>
        set((s) => ({
          shop: s.shop.map((i) => {
            if (i.id !== id) return i
            const name = patch.name?.trim() || i.name
            // A typed amount replaces any amounts that were added up from recipes.
            return {
              ...i,
              name,
              key: keyOf(name),
              quantity: patch.quantity,
              unit: patch.unit,
              more: undefined,
            }
          }),
        })),
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
        set({
          pantry,
          shop: s.shop.filter((i) => !i.checked),
          shopDismissed: [],
          bought: recordTrip(s.bought, checked, toDateKey(new Date())),
          // Coming home with the bags ends the trip.
          shopTrip: {},
        })
      },

      createHandoff: (h) =>
        set((s) => ({
          // One hand-off per night: a new one replaces the old.
          handoffs: [
            { ...h, id: uid('h'), createdAt: new Date().toISOString() },
            ...s.handoffs.filter((x) => x.date !== h.date),
          ],
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
          notes,
          replies,
          presence,
          presenceWeekly,
          ideas,
          repeats,
        } = s
        return JSON.stringify(
          {
            version: 1,
            exportedAt: new Date().toISOString(),
            settings,
            members,
            recipes: canonicalRecipes(recipes),
            pantry,
            plan,
            shop,
            shopDismissed,
            handoffs,
            energyByDate,
            cooked,
            notes,
            replies,
            presence,
            presenceWeekly,
            ideas,
            repeats,
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
          return { ok: false, error: t('Could not read that file.') }
        }
        const res = checkImport(raw)
        if (!res.ok) return { ok: false, error: res.error }
        set({
          ...res.data,
          recipes: res.data.recipes.length ? localizeRecipes(res.data.recipes) : localSeedRecipes(),
          shuffleSeen: [],
        })
        return { ok: true, dropped: res.dropped }
      },
      resetAll: () =>
        set({
          settings: defaultSettings,
          members: [],
          recipes: localSeedRecipes(),
          pantry: [],
          plan: [],
          shop: [],
          shopDismissed: [],
          handoffs: [],
          energyByDate: {},
          cooked: [],
          shuffleSeen: [],
          bought: {},
          presence: {},
          presenceWeekly: {},
          notes: [],
          replies: [],
          shopTrip: {},
          ideas: [],
          repeats: [],
          activity: [],
          activitySeenAt: undefined,
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
          recipes: canonicalRecipes(s.recipes),
          pantry: s.pantry,
          plan: s.plan,
          shop: s.shop,
          shopDismissed: s.shopDismissed,
          handoffs: s.handoffs,
          energyByDate: s.energyByDate,
          cooked: s.cooked,
          weather: s.weather,
          bought: s.bought,
          presence: s.presence,
          presenceWeekly: s.presenceWeekly,
          shopTrip: s.shopTrip,
          notes: s.notes,
          replies: s.replies,
          ideas: s.ideas,
          repeats: s.repeats,
          activity: s.activity,
          activitySeenAt: s.activitySeenAt,
        }) as unknown as PlantryState,
      // Older saves have the same shape; anything off is cleaned in merge below.
      migrate: (persisted) => persisted as PlantryState,
      merge: (persisted, current) => {
        const { data, dropped } = cleanData(persisted)
        if (dropped) useStorageStatus.setState({ droppedItems: dropped })
        // Keys are recomputed on load so matching rules can improve over time.
        if (data.pantry) data.pantry = data.pantry.map((p) => ({ ...p, key: keyOf(p.name) }))
        if (data.shop) data.shop = data.shop.map((i) => ({ ...i, key: keyOf(i.name) }))
        let recipes =
          data.recipes && data.recipes.length ? localizeRecipes(data.recipes) : current.recipes
        // Starter photos can be swapped for better ones; keep saved kitchens up to date.
        const seedPhoto = new Map(seedRecipes.map((r) => [r.id, r.imageUrl]))
        recipes = recipes.map((r) =>
          !r.custom && seedPhoto.has(r.id) && seedPhoto.get(r.id) !== r.imageUrl
            ? { ...r, imageUrl: seedPhoto.get(r.id) }
            : r
        )
        const settings = { ...current.settings, ...(data.settings ?? {}) }
        // Kitchens saved before newer starter recipes shipped get them once.
        if (data.recipes?.length && settings.seedVersion < SEED_VERSION) {
          recipes = [...recipes, ...newSeedRecipes(settings.seedVersion, recipes)]
          settings.seedVersion = SEED_VERSION
        }
        const bought = cleanBought((persisted as { bought?: unknown } | undefined)?.bought)
        const p = (persisted ?? {}) as { activity?: unknown; activitySeenAt?: unknown }
        const activity = Array.isArray(p.activity)
          ? p.activity.filter(
              (a): a is Activity =>
                !!a &&
                typeof a.id === 'string' &&
                typeof a.text === 'string' &&
                typeof a.at === 'string'
            )
          : []
        const activitySeenAt = typeof p.activitySeenAt === 'string' ? p.activitySeenAt : undefined
        return {
          ...current,
          ...data,
          settings,
          recipes,
          bought,
          activity,
          activitySeenAt,
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
