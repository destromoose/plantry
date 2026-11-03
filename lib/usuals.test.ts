import { describe, expect, it } from 'vitest'
import { cleanBought, recordTrip, usuals } from './usuals'
import type { ShopItem } from './types'

const item = (name: string): ShopItem => ({
  id: name,
  name,
  key: name.toLowerCase(),
  aisle: 'dairy',
  checked: true,
  fromRecipeIds: [],
})

describe('usuals', () => {
  it('needs two separate trips', () => {
    let b = recordTrip({}, [item('Milk'), item('Cake')], '2026-11-01')
    b = recordTrip(b, [item('Milk')], '2026-11-01')
    expect(usuals(b, new Set(), '2026-11-02')).toEqual([])
    b = recordTrip(b, [item('Milk')], '2026-11-08')
    expect(usuals(b, new Set(), '2026-11-09').map((u) => u.name)).toEqual(['Milk'])
  })

  it('hides what is already on the list and what has not been bought lately', () => {
    let b = recordTrip({}, [item('Milk'), item('Coffee')], '2026-09-01')
    b = recordTrip(b, [item('Milk'), item('Coffee')], '2026-09-08')
    b = recordTrip(b, [item('Milk')], '2026-11-01')
    expect(usuals(b, new Set(), '2026-11-02').map((u) => u.name)).toEqual(['Milk'])
    expect(usuals(b, new Set(['milk']), '2026-11-02')).toEqual([])
  })

  it('puts the most bought first', () => {
    let b = {}
    for (const d of ['2026-10-01', '2026-10-08', '2026-10-15']) b = recordTrip(b, [item('Eggs')], d)
    for (const d of ['2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29'])
      b = recordTrip(b, [item('Bread')], d)
    expect(usuals(b, new Set(), '2026-10-30').map((u) => u.name)).toEqual(['Bread', 'Eggs'])
  })

  it('cleans a broken save', () => {
    expect(
      cleanBought({
        milk: { name: 'Milk', aisle: 'dairy', trips: ['2026-10-01', 'nope'] },
        bad: { name: '', trips: ['2026-10-01'] },
        odd: { name: 'Odd', aisle: 'moon', trips: ['2026-10-01'] },
        none: 'x',
      })
    ).toEqual({
      milk: { name: 'Milk', aisle: 'dairy', trips: ['2026-10-01'] },
      odd: { name: 'Odd', aisle: 'other', trips: ['2026-10-01'] },
    })
    expect(cleanBought([1])).toEqual({})
  })
})
