import type { Aisle, PantryZone } from './types'
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

const aisleWords: [Aisle, string[]][] = [
  ['pantry', ['peanut butter', 'coconut milk', 'tomato paste', 'stock cube']],
  ['frozen', ['frozen', 'ice cream']],
  [
    'meat-fish',
    [
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
      'tuna',
      'prawn',
      'shrimp',
      'turkey',
    ],
  ],
  [
    'dairy',
    [
      'milk',
      'cheese',
      'cheddar',
      'feta',
      'parmesan',
      'mozzarella',
      'yogurt',
      'yoghurt',
      'butter',
      'cream',
      'egg',
    ],
  ],
  [
    'bakery',
    ['bread', 'bun', 'roll', 'bagel', 'pitta', 'pita', 'naan', 'tortilla', 'wrap', 'baguette'],
  ],
  [
    'spices',
    [
      'cumin',
      'paprika',
      'chili flake',
      'chilli flake',
      'turmeric',
      'oregano',
      'cinnamon',
      'pepper flake',
      'curry powder',
      'garam masala',
      'thyme',
      'salt',
      'black pepper',
    ],
  ],
  ['drinks', ['juice', 'wine', 'beer', 'soda', 'coffee', 'tea']],
  [
    'pantry',
    [
      'rice',
      'pasta',
      'spaghetti',
      'noodle',
      'flour',
      'sugar',
      'oil',
      'vinegar',
      'stock',
      'broth',
      'tin',
      'can',
      'bean',
      'lentil',
      'chickpea',
      'oat',
      'sauce',
      'honey',
      'peanut butter',
      'coconut milk',
      'tomato paste',
      'passata',
    ],
  ],
  [
    'produce',
    [
      'onion',
      'garlic',
      'tomato',
      'potato',
      'carrot',
      'celery',
      'lemon',
      'lime',
      'apple',
      'banana',
      'spinach',
      'kale',
      'lettuce',
      'herb',
      'parsley',
      'cilantro',
      'coriander',
      'basil',
      'mint',
      'ginger',
      'pepper',
      'chili',
      'chilli',
      'mushroom',
      'courgette',
      'zucchini',
      'broccoli',
      'cabbage',
      'avocado',
      'cucumber',
      'squash',
      'leek',
      'scallion',
      'spring onion',
      'berry',
      'orange',
      'pea',
    ],
  ],
]

/** A best guess at which aisle an ingredient is in, so the shopping list sorts well. */
export function guessAisle(name: string): Aisle {
  const key = keyOf(name)
  if (!key) return 'other'
  const staple = staples.find((s) => s.key === key)
  if (staple) return staple.aisle
  for (const [aisle, words] of aisleWords) if (words.some((w) => key.includes(w))) return aisle
  return 'other'
}
