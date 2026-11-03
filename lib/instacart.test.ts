import { describe, expect, it } from 'vitest'
import { MAX_ITEMS, toLineItems } from './instacart'

describe('toLineItems', () => {
  it('maps amounts to Instacart units and drops ones it cannot read', () => {
    expect(
      toLineItems([
        { name: 'Basmati rice', quantity: 400, unit: 'g' },
        { name: 'Onions', quantity: 2 },
        { name: 'Thyme', quantity: 2, unit: 'sprig' },
        { name: '  ' },
      ])
    ).toEqual([
      {
        name: 'basmati rice',
        display_text: 'Basmati rice',
        line_item_measurements: [{ quantity: 400, unit: 'gram' }],
      },
      {
        name: 'onions',
        display_text: 'Onions',
        line_item_measurements: [{ quantity: 2, unit: 'each' }],
      },
      { name: 'thyme', display_text: 'Thyme' },
    ])
  })

  it('caps the list', () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ name: `Thing ${i}` }))
    expect(toLineItems(many)).toHaveLength(MAX_ITEMS)
  })
})
