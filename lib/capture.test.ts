import { describe, expect, it } from 'vitest'
import { parseCapture } from './capture'

const names = (text: string) => parseCapture(text).map((i) => i.name)

describe('parseCapture', () => {
  it('splits a spoken list into items', () => {
    expect(names('milk, two onions and some rice')).toEqual(['Milk', 'Onions', 'Rice'])
    const onions = parseCapture('milk, two onions and some rice')[1]
    expect(onions.quantity).toBe(2)
  })

  it('reads amounts and units', () => {
    const [milk, eggs] = parseCapture('2 litres of milk and a dozen eggs')
    expect(milk).toMatchObject({ name: 'Milk', quantity: 2 })
    expect(milk.unit).toBeTruthy()
    expect(eggs).toMatchObject({ name: 'Eggs', quantity: 12 })
  })

  it('marks things that ran out, until the next "get"', () => {
    const items = parseCapture("We're out of eggs and milk, and get two onions")
    expect(items.map((i) => [i.name, i.outOf])).toEqual([
      ['Eggs', true],
      ['Milk', true],
      ['Onions', false],
    ])
  })

  it('starts each sentence as things to buy', () => {
    const items = parseCapture('Ran out of butter. Bread please')
    expect(items.map((i) => i.outOf)).toEqual([true, false])
  })

  it('keeps names that contain "and"', () => {
    expect(names('mac and cheese and salt and pepper crisps')).toEqual([
      'Mac and cheese',
      'Salt and pepper crisps',
    ])
  })

  it('drops filler and repeats', () => {
    expect(names("we need bananas, bananas, and that's it, thanks")).toEqual(['Bananas'])
    expect(names('one lemon')).toEqual(['Lemon'])
  })

  it('reads one item per line when pasted', () => {
    expect(names('Coffee\nOat milk\n- Bin bags')).toEqual(['Coffee', 'Oat milk', 'Bin bags'])
  })

  it('understands Spanish', () => {
    const items = parseCapture('necesitamos leche, dos cebollas y se acabaron los huevos')
    expect(items.map((i) => [i.name, i.outOf, i.quantity])).toEqual([
      ['Leche', false, undefined],
      ['Cebollas', false, 2],
      ['Huevos', true, undefined],
    ])
  })

  it('ignores empty input', () => {
    expect(parseCapture('  , and . ')).toEqual([])
  })
})
