import { describe, expect, it } from 'vitest'
import { activeTrip, isLateAdd, splitByAisle } from './shopTogether'
import { emptyDoc, mergeDocs } from './syncDoc'
import { useStore } from './store'
import type { ShopItem } from './types'

const item = (id: string, aisle: ShopItem['aisle'], x: Partial<ShopItem> = {}): ShopItem => ({
  id,
  name: id,
  key: id,
  aisle,
  checked: false,
  fromRecipeIds: [],
  ...x,
})

describe('shopping together', () => {
  it('counts a trip for three hours', () => {
    const now = Date.parse('2026-11-03T18:00:00.000Z')
    expect(activeTrip({ by: 'a', since: '2026-11-03T17:30:00.000Z' }, now)).toBeTruthy()
    expect(activeTrip({ by: 'a', since: '2026-11-03T14:00:00.000Z' }, now)).toBeUndefined()
    expect(activeTrip({}, now)).toBeUndefined()
  })

  it('marks what the others added after the shopper set off', () => {
    const trip = { by: 'a', since: '2026-11-03T17:30:00.000Z' }
    expect(
      isLateAdd(item('x', 'dairy', { addedBy: 's', addedAt: '2026-11-03T17:45:00.000Z' }), trip)
    ).toBe(true)
    expect(
      isLateAdd(item('x', 'dairy', { addedBy: 'a', addedAt: '2026-11-03T17:45:00.000Z' }), trip)
    ).toBe(false)
    expect(
      isLateAdd(item('x', 'dairy', { addedBy: 's', addedAt: '2026-11-03T17:00:00.000Z' }), trip)
    ).toBe(false)
  })

  it('splits by aisle so both have about the same to get', () => {
    const items = [
      item('a', 'produce'),
      item('b', 'produce'),
      item('c', 'produce'),
      item('d', 'dairy'),
      item('e', 'dairy'),
      item('f', 'bakery'),
      item('g', 'bakery', { checked: true }),
    ]
    const who = splitByAisle(items, ['m', 's'])
    expect(who.a).toBe(who.b)
    expect(who.d).toBe(who.e)
    expect(who.d).not.toBe(who.a)
    expect(who.g).toBeUndefined()
    const counts = Object.values(who).reduce<Record<string, number>>(
      (c, p) => ({ ...c, [p]: (c[p] ?? 0) + 1 }),
      {}
    )
    expect(Object.values(counts).sort()).toEqual([3, 3])
  })

  it('signs adds and ticks with who did them', () => {
    useStore.setState({
      members: [
        { id: 'm', name: 'Maya', color: 'sage', isMe: true },
        { id: 's', name: 'Sam', color: 'plum' },
      ],
      shop: [],
    })
    useStore.getState().addShopItem('Milk')
    const milk = useStore.getState().shop[0]
    expect(milk.addedBy).toBe('m')
    useStore.getState().toggleShopItem(milk.id)
    expect(useStore.getState().shop[0].checkedBy).toBe('m')
    useStore.getState().toggleShopItem(milk.id)
    expect(useStore.getState().shop[0].checkedBy).toBeUndefined()
  })

  it('takes the newest trip from whichever phone changed it', () => {
    const base = emptyDoc()
    const mine = { ...base, shopTrip: { by: 'm', since: '2026-11-03T17:30:00.000Z' } }
    expect(mergeDocs(base, mine, base).shopTrip).toEqual(mine.shopTrip)
    const ended = { ...base, shopTrip: {} }
    expect(mergeDocs(mine, ended, mine).shopTrip).toEqual({})
    expect(mergeDocs(mine, mine, ended).shopTrip).toEqual({})
  })
})
