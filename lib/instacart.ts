// Hand the shopping list to Instacart: it matches each thing to a product at a store near
// the person, they fill their cart there, and nothing is ordered until they check out.
// https://docs.instacart.com/developer_platform_api/api/products/create_shopping_list_page

export interface ListItem {
  name: string
  quantity?: number
  unit?: string
}

export interface LineItem {
  name: string
  display_text: string
  line_item_measurements?: { quantity: number; unit: string }[]
}

// Plantry's units in the words Instacart's catalogue understands.
const unitWords: Record<string, string> = {
  g: 'gram',
  gram: 'gram',
  grams: 'gram',
  kg: 'kilogram',
  oz: 'ounce',
  ounce: 'ounce',
  ounces: 'ounce',
  lb: 'pound',
  lbs: 'pound',
  pound: 'pound',
  pounds: 'pound',
  ml: 'milliliter',
  l: 'liter',
  litre: 'liter',
  liter: 'liter',
  tsp: 'teaspoon',
  tbsp: 'tablespoon',
  cup: 'cup',
  cups: 'cup',
  pint: 'pint',
  quart: 'quart',
  quarts: 'quart',
  gallon: 'gallon',
  'fl oz': 'fl oz',
  can: 'can',
  tin: 'can',
  bunch: 'bunch',
  head: 'head',
  pack: 'package',
  jar: 'package',
  '': 'each',
  pc: 'each',
  piece: 'each',
  whole: 'each',
}

export const MAX_ITEMS = 100

/** Plantry's list as Instacart line items. Amounts in units Instacart can't read are left out. */
export function toLineItems(items: ListItem[]): LineItem[] {
  return items
    .filter((i) => i.name?.trim())
    .slice(0, MAX_ITEMS)
    .map((i) => {
      const name = i.name.trim().slice(0, 100)
      const unit = unitWords[(i.unit ?? '').trim().toLowerCase()]
      const measure =
        i.quantity && i.quantity > 0 && unit
          ? { line_item_measurements: [{ quantity: Math.round(i.quantity * 100) / 100, unit }] }
          : {}
      return { name: name.toLowerCase(), display_text: name, ...measure }
    })
}
