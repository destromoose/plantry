import type { PantryZone } from './types'
import { staples } from './seed/pantry'
import { keyOf } from './utils'

// A best guess at where something lives, so new items don't all land in the fridge.
const zoneWords: [PantryZone, string[]][] = [
  ['freezer', ['frozen', 'ice cream', 'ice']],
  [
    'fridge',
    [
      'milk',
      'cheese',
      'cheddar',
      'feta',
      'parmesan',
      'mozzarella',
      'yogurt',
      'butter',
      'cream',
      'egg',
      'chicken',
      'beef',
      'pork',
      'lamb',
      'mince',
      'bacon',
      'ham',
      'sausage',
      'fish',
      'salmon',
      'cod',
      'prawn',
      'tofu',
      'lettuce',
      'spinach',
      'kale',
      'rocket',
      'cilantro',
      'parsley',
      'basil',
      'mint',
      'scallion',
      'carrot',
      'celery',
      'cucumber',
      'zucchini',
      'bell pepper',
      'broccoli',
      'mushroom',
      'berry',
      'grape',
      'lemon',
      'lime',
      'hummus',
      'juice',
      'kimchi',
      'tortilla',
    ],
  ],
  [
    'counter',
    [
      'banana',
      'bread',
      'tomato',
      'avocado',
      'onion',
      'garlic',
      'potato',
      'sweet potato',
      'apple',
      'orange',
      'mango',
      'pear',
      'squash',
      'ginger',
    ],
  ],
]

export function guessZone(name: string): PantryZone {
  const key = keyOf(name)
  const staple = staples.find((s) => s.key === key)
  if (staple) return staple.zone
  for (const [zone, words] of zoneWords) if (words.some((w) => key.includes(w))) return zone
  return 'cupboard'
}

/** How long something usually keeps where it lives, in days. */
export function defaultLife(zone: PantryZone): number {
  return zone === 'fridge' ? 7 : zone === 'counter' ? 7 : zone === 'freezer' ? 90 : 180
}
