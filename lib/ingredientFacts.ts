// Rough facts about common ingredients: nutrition per 100 g and a typical shop price, plus
// how much one "whole", "clove", "can" or spoon weighs. Used for nutrition per serving and
// cost per dinner. These are averages from public food tables and US supermarket prices in
// 2026; good enough to compare dinners, never a substitute for a label.

import { keyOf } from './utils'
import { unitInfo } from './quantity'

export interface Facts {
  /** Per 100 g (or 100 ml for liquids). */
  kcal: number
  protein: number
  carbs: number
  fat: number
  fibre: number
  /** Price in US dollars per 100 g. */
  price: number
  /** Grams in one counted thing: one egg, one clove, one can (drained), one slice. */
  each?: number
  /** Grams in one tablespoon, when it differs from 15 g (oil, honey). */
  tbsp?: number
}

// kcal, protein, carbs, fat, fibre, $/100 g, grams each, grams per tbsp
type Row = [number, number, number, number, number, number, number?, number?]
const rows: Record<string, Row> = {
  avocado: [160, 2, 9, 15, 7, 0.7, 150],
  'bell pepper': [26, 1, 6, 0.3, 2, 0.9, 150],
  'black bean': [132, 8.9, 24, 0.5, 8.7, 0.45, 240],
  bread: [265, 9, 49, 3.2, 2.7, 0.45, 35],
  butter: [717, 0.9, 0.1, 81, 0, 1.2, 113, 14],
  'canned tomato': [32, 1.6, 7, 0.3, 1.9, 0.3, 400],
  carrot: [41, 0.9, 10, 0.2, 2.8, 0.3, 60],
  celery: [16, 0.7, 3, 0.2, 1.6, 0.4, 40],
  cheddar: [403, 25, 1.3, 33, 0, 1.3, 30],
  'cherry tomato': [18, 0.9, 3.9, 0.2, 1.2, 0.9, 15],
  'chicken breast': [120, 22.5, 0, 2.6, 0, 1.0, 200],
  'chicken thigh': [177, 19, 0, 11, 0, 0.75, 120],
  chickpea: [139, 7.6, 22.5, 2.1, 6, 0.45, 240],
  'chili flake': [318, 12, 57, 17, 27, 3.0, 1, 6],
  cilantro: [23, 2.1, 3.7, 0.5, 2.8, 1.5, 30],
  'coconut milk': [197, 2, 2.8, 21, 0, 0.55, 400],
  cucumber: [15, 0.7, 3.6, 0.1, 0.5, 0.35, 300],
  cumin: [375, 18, 44, 22, 10, 4.0, 1, 6],
  egg: [143, 12.6, 0.7, 9.5, 0, 0.55, 50],
  feta: [264, 14, 4, 21, 0, 1.6, 200],
  'frozen pea': [77, 5, 13.6, 0.4, 4.5, 0.45],
  garlic: [149, 6.4, 33, 0.5, 2.1, 1.0, 5],
  ginger: [80, 1.8, 18, 0.8, 2, 1.0, 30, 6],
  'ground beef': [254, 17, 0, 20, 0, 1.2],
  'ground pork': [263, 17, 0, 21, 0, 0.9],
  honey: [304, 0.3, 82, 0, 0.2, 1.0, 340, 21],
  kale: [49, 4.3, 8.8, 0.9, 3.6, 0.8, 200],
  lemon: [29, 1.1, 9, 0.3, 2.8, 0.6, 60],
  lentil: [352, 25, 63, 1.1, 11, 0.45, undefined, 12],
  lime: [30, 0.7, 10.5, 0.2, 2.8, 0.6, 45],
  mushroom: [22, 3.1, 3.3, 0.3, 1, 0.9, 18],
  mustard: [66, 4.4, 5.8, 4, 3.3, 0.6],
  noodle: [360, 12, 72, 1.5, 3, 0.5],
  'olive oil': [884, 0, 0, 100, 0, 1.0, undefined, 13.5],
  onion: [40, 1.1, 9.3, 0.1, 1.7, 0.3, 150],
  oregano: [265, 9, 69, 4.3, 42, 5.0, 1, 3],
  paprika: [282, 14, 54, 13, 35, 3.0, 1, 7],
  parmesan: [431, 38, 4, 29, 0, 2.6],
  parsley: [36, 3, 6.3, 0.8, 3.3, 1.5, 50],
  pasta: [371, 13, 75, 1.5, 3.2, 0.35],
  'peanut butter': [588, 25, 20, 50, 6, 0.8, undefined, 16],
  potato: [77, 2, 17, 0.1, 2.2, 0.25, 200],
  prawn: [85, 20, 0, 0.5, 0, 2.0, 15],
  quinoa: [368, 14, 64, 6, 7, 1.0, undefined, 11],
  rice: [360, 6.6, 79, 0.6, 1, 0.3, undefined, 12],
  salmon: [208, 20, 0, 13, 0, 2.4, 150],
  scallion: [32, 1.8, 7.3, 0.2, 2.6, 0.8, 15],
  'sesame oil': [884, 0, 0, 100, 0, 1.5, undefined, 13.5],
  'soy sauce': [53, 8, 4.9, 0.6, 0.8, 0.6, undefined, 16],
  spinach: [23, 2.9, 3.6, 0.4, 2.2, 1.0, 30],
  stock: [5, 0.5, 0.5, 0.2, 0, 0.12],
  'sweet potato': [86, 1.6, 20, 0.1, 3, 0.35, 200],
  tahini: [595, 17, 21, 54, 9, 1.4],
  'thai green curry paste': [120, 2, 12, 7, 3, 1.8, undefined, 16],
  tofu: [144, 15.5, 3, 8.7, 2.3, 0.65, 400],
  tortilla: [310, 8, 52, 8, 3, 0.55, 45],
  vinegar: [20, 0, 0.9, 0, 0, 0.3],
  yogurt: [61, 3.5, 4.7, 3.3, 0, 0.45],
  zucchini: [17, 1.2, 3.1, 0.3, 1, 0.45, 200],
  // Common in people's own recipes.
  milk: [61, 3.2, 4.8, 3.3, 0, 0.1, undefined, 15],
  cream: [340, 2.1, 2.8, 36, 0, 0.6],
  'sour cream': [198, 2.4, 4.6, 19, 0, 0.5],
  mozzarella: [280, 28, 3, 17, 0, 1.2, 125],
  flour: [364, 10, 76, 1, 2.7, 0.15, undefined, 8],
  sugar: [387, 0, 100, 0, 0, 0.2, undefined, 12.5],
  oat: [389, 17, 66, 7, 11, 0.4],
  tomato: [18, 0.9, 3.9, 0.2, 1.2, 0.5, 120],
  broccoli: [34, 2.8, 7, 0.4, 2.6, 0.55, 300],
  cauliflower: [25, 1.9, 5, 0.3, 2, 0.45, 500],
  cabbage: [25, 1.3, 6, 0.1, 2.5, 0.2, 900],
  corn: [86, 3.3, 19, 1.4, 2, 0.4, 150],
  bacon: [417, 13, 1.4, 40, 0, 1.6, 12],
  sausage: [301, 12, 2, 27, 0, 1.1, 75],
  tuna: [116, 26, 0, 1, 0, 1.1, 120],
  ham: [145, 21, 1.5, 6, 0, 1.3, 25],
  'beef steak': [217, 26, 0, 12, 0, 2.2, 250],
  'pork chop': [231, 25, 0, 14, 0, 1.0, 200],
  banana: [89, 1.1, 23, 0.3, 2.6, 0.25, 120],
  apple: [52, 0.3, 14, 0.2, 2.4, 0.4, 180],
  'kidney bean': [127, 8.7, 23, 0.5, 6.4, 0.45, 240],
  'pinto bean': [143, 9, 26, 0.7, 9, 0.45, 240],
  jalapeno: [29, 0.9, 6.5, 0.4, 2.8, 0.9, 15],
  'queso fresco': [299, 18, 3, 24, 0, 1.3],
  masa: [365, 9, 76, 4, 6.4, 0.3, undefined, 8],
  salt: [0, 0, 0, 0, 0, 0.1, undefined, 18],
  'black pepper': [251, 10, 64, 3, 25, 3.0, undefined, 7],
  'tomato paste': [82, 4.3, 19, 0.5, 4, 0.6, undefined, 16],
  'maple syrup': [260, 0, 67, 0, 0, 1.5, undefined, 20],
  couscous: [376, 13, 77, 0.6, 5, 0.6],
  bulgur: [342, 12, 76, 1.3, 18, 0.6],
  'brown rice': [367, 7.5, 76, 2.7, 3.4, 0.4],
  'green bean': [31, 1.8, 7, 0.2, 2.7, 0.7],
  eggplant: [25, 1, 6, 0.2, 3, 0.45, 450],
  'red lentil': [358, 24, 63, 2, 11, 0.5],
  'vegetable oil': [884, 0, 0, 100, 0, 0.3, undefined, 13.5],
  'coconut oil': [862, 0, 0, 100, 0, 1.3, undefined, 13.5],
}

export const factsTable: Record<string, Facts> = Object.fromEntries(
  Object.entries(rows).map(([k, [kcal, protein, carbs, fat, fibre, price, each, tbsp]]) => [
    k,
    {
      kcal,
      protein,
      carbs,
      fat,
      fibre,
      price,
      ...(each ? { each } : {}),
      ...(tbsp ? { tbsp } : {}),
    },
  ])
)

/** Facts for an ingredient, by its key or, failing that, its name. */
export function factsFor(ing: { key: string; name?: string }): Facts | undefined {
  return factsTable[ing.key] ?? (ing.name ? factsTable[keyOf(ing.name)] : undefined)
}

/** Grams in an amount of this ingredient, or undefined when it can't be told. */
export function gramsOf(q: number, unit: string, facts: Facts): number | undefined {
  if (!(q > 0)) return undefined
  const u = unit.trim().toLowerCase()
  const info = unitInfo(u)
  if (info?.dim === 'mass') return q * info.factor
  if (info?.dim === 'volume') {
    // A spoon or cup weighs what its contents weigh: oil is lighter than water, honey heavier.
    return q * info.factor * ((facts.tbsp ?? 15) / 15)
  }
  // Counted things: one egg, one clove, one can, a bunch, a handful.
  if (u === 'pinch') return q * 0.4
  if (u === 'handful') return q * 30
  if (facts.each) return q * facts.each
  return undefined
}
