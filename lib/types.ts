// Domain types for Plantry. Everything here is serializable (no Date objects)
// so the whole store can be persisted and exported as JSON.

export type Taste =
  'cozy' | 'fresh' | 'fast' | 'one-pan' | 'veg-forward' | 'spicy' | 'big-batch' | 'kid-friendly'

export type PantryZone = 'fridge' | 'freezer' | 'cupboard' | 'counter'

export type Aisle =
  'produce' | 'dairy' | 'meat-fish' | 'bakery' | 'pantry' | 'frozen' | 'spices' | 'drinks' | 'other'

export interface Ingredient {
  id: string
  name: string
  /** Normalized lowercase key used to match against pantry items, e.g. "lime". */
  key: string
  quantity: number
  unit: string
  aisle: Aisle
  optional?: boolean
}

export interface Step {
  id: string
  text: string
  /** Minutes, when the step contains a timer ("simmer 12 minutes"). */
  timerMinutes?: number
  /** Safety note shown on the step, e.g. "The pan handle gets hot." */
  caution?: string
}

export interface Recipe {
  id: string
  title: string
  description: string
  imageUrl?: string
  /** Hands-on minutes. */
  activeMinutes: number
  /** Total minutes including passive time. */
  totalMinutes: number
  servings: number
  ingredients: Ingredient[]
  steps: Step[]
  tastes: Taste[]
  /** Weather leaning: warm food for cold days, light food for hot days. */
  weather?: 'warm' | 'light' | 'any'
  /** Makes leftovers worth planning the next day. */
  leftovers?: boolean
  source?: string
  sourceUrl?: string
  isFavorite: boolean
  createdAt: string
  custom?: boolean
}

export interface PantryItem {
  id: string
  name: string
  key: string
  zone: PantryZone
  aisle: Aisle
  quantity?: number
  unit?: string
  /** ISO date the item was added or last restocked. */
  addedAt: string
  /** Days before the item should be used. Fresh produce ~5, dairy ~10, cupboard ~180. */
  softLifeDays: number
  staple?: boolean
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner'

export interface PlanEntry {
  id: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  slot: MealSlot
  recipeId?: string
  /** A leftovers entry points at the recipe it came from. */
  leftoversOf?: string
  /** Free text when there is no recipe ("Takeout", "Out with friends"). */
  note?: string
  servings?: number
  /** Household member id who claimed the night. */
  cookId?: string
  done?: boolean
}

export interface ShopItem {
  id: string
  name: string
  key: string
  quantity?: number
  unit?: string
  aisle: Aisle
  checked: boolean
  /** Recipe ids this item was generated from; empty for loose items. */
  fromRecipeIds: string[]
  /** Extra amounts in units that can't be added to the first (350 g + 2 tbsp). */
  more?: { quantity: number; unit: string }[]
  /** Member id of who put it on the list, and when (ISO). */
  addedBy?: string
  addedAt?: string
  /** Who ticked it off. */
  checkedBy?: string
  /** Added because someone used the last of it. */
  usedUp?: boolean
  /** Who's getting it, when the shop is split. */
  splitTo?: string
}

/** Someone out shopping right now. Empty when nobody is. */
export interface ShopTrip {
  by?: string
  since?: string
}

export interface Member {
  id: string
  name: string
  /** One of the member color tokens. */
  color: 'terracotta' | 'saffron' | 'sage' | 'plum'
  isMe?: boolean
  /** Allergens this person must never be served. */
  avoid?: string[]
  /** Diet this person follows. */
  diet?: string
  /** False for someone who eats but doesn't cook, like a small child. */
  cooks?: boolean
}

export type Energy = 'up-for-it' | 'quick' | 'cant-tonight'

export type Mood = 'dawn' | 'day' | 'dusk' | 'night'

export interface Settings {
  onboarded: boolean
  /** 'auto' follows the clock. */
  /** 'auto' follows the time of day; 'system' follows the device's light or dark setting. */
  mood: Mood | 'auto' | 'system'
  reducedMotion: 'system' | 'on' | 'off'
  units: 'metric' | 'imperial'
  tastes: Taste[]
  weatherEnabled: boolean
  householdWord: 'household' | 'family' | 'home'
  /** How many people dinner is usually for. */
  cookingFor: number
  /** Allergens and diets the whole household avoids (see lib/diet.ts). */
  avoid: string[]
  /** Show ask-a-grown-up notes on hot and sharp steps. */
  cookingWithKids: boolean
  highContrast: boolean
  textSize: 'normal' | 'large' | 'larger'
  /** Show rough nutrition per serving on recipes. */
  showNutrition: boolean
  /** Currency for rough costs. */
  currency: 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'MXN'
  /** How pricey shops are nearby, so cost estimates land closer. */
  priceLevel: 'low' | 'average' | 'high'
  /** Dinner budget for a week, in `currency`. 0 means no budget. */
  weeklyBudget: number
  /** Which starter recipes this kitchen has been given (see SEED_VERSION). */
  seedVersion: number
  /** Which meals the household plans each day. Dinner is always planned. */
  meals: MealSlot[]
}

export interface Weather {
  tempC: number
  precipitation: boolean
  fetchedAt: string
}

export interface Context {
  now: string
  mood: Mood
  hour: number
  isWeekend: boolean
  /** The date whose dinner the Tonight screen is about. After 10 pm this is tomorrow, unless tonight is still open. */
  targetDate: string
  targetLabel: 'Tonight' | 'Tomorrow'
  /** True when Tonight jumped to tomorrow and can be asked to stay on today. */
  canStayTonight?: boolean
  weather?: Weather
  weatherLean: 'warm' | 'light' | 'any'
  nudge: 'plan-week' | 'defrost' | 'start-now' | 'leftovers' | 'none'
  reason: string
}

/** How a cooked dinner went, so the good ones come back and the bad ones don't. */
export type Rating = 'loved' | 'fine' | 'not-again'

/** One dinner in the cooking history. */
export interface CookedEntry {
  recipeId: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  cookId?: string
  rating?: Rating
  /** A note for next time, like "less chili" or "double the sauce". */
  note?: string
}

export interface Handoff {
  id: string
  date: string
  fromId: string
  toId: string
  recipeId?: string
  message?: string
  createdAt: string
  accepted?: boolean
}

/** Whether someone is eating a meal at home. */
export type Presence = 'home' | 'late' | 'out'

/** A note left for the household on a day, a meal, a list item, or the fridge board. */
export interface HouseNote {
  id: string
  text: string
  /** Member id of who wrote it. */
  by?: string
  /** ISO time it was written. */
  at: string
  /** Where it sits. */
  on: 'day' | 'shop' | 'board'
  date?: string
  slot?: MealSlot
  /** The list item's key, for a note on the shop list ("get the Barilla one"). */
  itemKey?: string
  /** A small photo, as a data URL. */
  photo?: string
  /** Board notes stay past a week when pinned. */
  pinned?: boolean
}

/** A quick reply to a note: "Sounds good", "I'll cook", or a few words. */
export interface NoteReply {
  id: string
  noteId: string
  by?: string
  text: string
  at: string
}

/** "We should have tacos soon": a meal someone in the household fancies, waiting for a night. */
export interface MealIdea {
  id: string
  /** Free text, when it isn't one of the recipes. */
  text?: string
  recipeId?: string
  by?: string
  at: string
  /** Members who said "me too". */
  votes?: string[]
}

/** A meal the household has every week: "Pizza every Friday". */
export interface RepeatMeal {
  id: string
  /** 0 is Sunday, the way Date.getDay() counts. */
  weekday: number
  slot: MealSlot
  recipeId?: string
  note?: string
  by?: string
}
