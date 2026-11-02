import { describe, expect, it } from 'vitest'
import { addAmount, formatAmount, formatAmounts, subtract } from './quantity'

describe('amounts', () => {
  it('adds spoons and grams sensibly', () => {
    expect(addAmount([{ quantity: 1, unit: 'tbsp' }], { quantity: 3, unit: 'tsp' })).toEqual([
      { quantity: 2, unit: 'tbsp' },
    ])
    const mixed = addAmount([{ quantity: 350, unit: 'g' }], { quantity: 2, unit: 'tbsp' })
    expect(formatAmounts(mixed)).toBe('350 g + 2 tbsp')
  })
  it('subtracts what you have', () => {
    expect(subtract({ quantity: 18, unit: 'whole' }, { quantity: 12, unit: 'whole' })).toEqual({
      quantity: 6,
      unit: 'whole',
    })
    expect(subtract({ quantity: 1, unit: 'kg' }, { quantity: 2, unit: 'tbsp' })).toBeUndefined()
  })
})

describe('formatAmount', () => {
  it('reads like a person wrote it', () => {
    expect(formatAmount(12, 'clove')).toBe('12 cloves')
    expect(formatAmount(1, 'clove')).toBe('1 clove')
    expect(formatAmount(4, 'whole')).toBe('4')
    expect(formatAmount(2400, 'g')).toBe('2.4 kg')
    expect(formatAmount(0.125, 'tsp')).toBe('⅛ tsp')
    expect(formatAmount(0.375, 'cup')).toBe('⅜ cup')
    expect(formatAmount(1.5, 'tbsp')).toBe('1½ tbsp')
    expect(formatAmount(312.5, 'g')).toBe('313 g')
  })
  it('rounds things you count up on a shopping list', () => {
    expect(formatAmount(10.5, 'whole', { forShopping: true })).toBe('11')
    expect(formatAmount(6.25, '', { forShopping: true })).toBe('7')
    expect(formatAmount(6.25, 'g', { forShopping: true })).toBe('6¼ g')
  })
})
