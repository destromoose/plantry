// Rough cost of dinners and the shopping list, from the ingredient facts table.
// Prices are US supermarket averages, turned into the household's currency and adjusted
// for how pricey shops are where they live. Always shown as "about".

import type { Ingredient, PantryItem, PlanEntry, Recipe, Settings, ShopItem } from './types'
import { factsFor, gramsOf } from './ingredientFacts'

export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'MXN'

/** Rough grocery-price ratio to the US, so a lime costs about what it costs there. */
const currencyRate: Record<Currency, number> = {
  USD: 1,
  EUR: 0.95,
  GBP: 0.8,
  CAD: 1.4,
  AUD: 1.55,
  MXN: 13,
}
const levelRate = { low: 0.8, average: 1, high: 1.3 } as const

export const currencies: Currency[] = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'MXN']

type PriceSettings = Pick<Settings, 'currency' | 'priceLevel'>

const rate = (s: PriceSettings) => currencyRate[s.currency] * levelRate[s.priceLevel]

/** Cost of one ingredient amount, or undefined when we can't tell. */
export function ingredientCost(
  ing: Pick<Ingredient, 'key' | 'name' | 'quantity' | 'unit'>,
  scale: number,
  s: PriceSettings
): number | undefined {
  const f = factsFor(ing)
  const g = f && gramsOf(ing.quantity * scale, ing.unit, f)
  if (!f || g === undefined) return undefined
  return (g / 100) * f.price * rate(s)
}

export interface Cost {
  /** Everything the dinner uses. */
  total: number
  /** Only what isn't in the pantry yet. */
  toBuy: number
  perServing: number
  known: number
  count: number
}

export function recipeCost(
  recipe: Recipe,
  servings: number,
  s: PriceSettings,
  pantry: Pick<PantryItem, 'key'>[] = []
): Cost {
  const have = new Set(pantry.map((p) => p.key))
  const scale = servings / Math.max(1, recipe.servings)
  const out: Cost = { total: 0, toBuy: 0, perServing: 0, known: 0, count: 0 }
  for (const ing of recipe.ingredients) {
    if (ing.optional) continue
    out.count++
    const c = ingredientCost(ing, scale, s)
    if (c === undefined) continue
    out.known++
    out.total += c
    if (!have.has(ing.key)) out.toBuy += c
  }
  out.perServing = out.total / Math.max(1, servings)
  return out
}

/** About what this week's planned dinners cost, and how many could be priced. */
export function planCost(
  plan: PlanEntry[],
  dates: string[],
  recipes: Recipe[],
  s: PriceSettings & Pick<Settings, 'cookingFor'>
) {
  let total = 0
  let dinners = 0
  for (const p of plan) {
    if (p.slot !== 'dinner' || !p.recipeId || !dates.includes(p.date)) continue
    const r = recipes.find((x) => x.id === p.recipeId)
    if (!r) continue
    total += recipeCost(r, p.servings ?? s.cookingFor ?? r.servings, s).total
    dinners++
  }
  return { total, dinners }
}

/** About what the unticked list costs. Items we can't price are counted, not guessed. */
export function shopCost(items: ShopItem[], s: PriceSettings) {
  let total = 0
  let unknown = 0
  for (const i of items) {
    if (i.checked) continue
    const amounts = [
      ...(i.quantity ? [{ quantity: i.quantity, unit: i.unit ?? '' }] : []),
      ...(i.more ?? []),
    ]
    let priced = false
    for (const a of amounts) {
      const c = ingredientCost({ key: i.key, name: i.name, ...a }, 1, s)
      if (c !== undefined) {
        total += c
        priced = true
      }
    }
    if (!priced) unknown++
  }
  return { total, unknown }
}

const symbols: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: '$',
  AUD: '$',
  MXN: '$',
}

/** "$12", "€3.50", "$140". Small amounts keep cents; bigger ones round. */
export function formatMoney(n: number, currency: Currency, locale?: string): string {
  const digits = n < 10 ? 2 : 0
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(n)
  } catch {
    return `${symbols[currency]}${n.toFixed(digits)}`
  }
}

const euro = new Set('AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' '))

/** The currency for a region code ("MX" -> MXN), when we have one for it. */
export function guessCurrency(region: string): Currency | undefined {
  if (euro.has(region)) return 'EUR'
  const map: Record<string, Currency> = { US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD', MX: 'MXN' }
  return map[region]
}
