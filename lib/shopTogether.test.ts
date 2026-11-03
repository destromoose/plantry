import { describe, expect, it } from 'vitest'
import { activeTrip, isLateAdd, splitByAisle } from './shopTogether'
import { emptyDoc, mergeDocs } from './syncDoc'
import { useStore } from './store'
import type { ShopItem } from './types'
import { keyOf } from './utils'

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

  it('marks "used the last of it" on a row already on the list, and from "out of"', () => {
    useStore.setState({
      members: [
        { id: 'm', name: 'Maya', color: 'sage', isMe: true },
        { id: 's', name: 'Sam', color: 'plum' },
      ],
      shop: [item('eggs', 'dairy', { key: keyOf('eggs'), addedBy: 's' })],
      pantry: [],
    })
    useStore.getState().addShopItem('eggs', 'dairy', { usedUp: true })
    expect(useStore.getState().shop[0]).toMatchObject({ usedUp: true, addedBy: 'm' })
    useStore.getState().addCaptured([{ name: 'milk', outOf: true }])
    expect(useStore.getState().shop.find((i) => i.key === 'milk')?.usedUp).toBe(true)
  })

  it('keeps who added and whose part a row is when the list is rebuilt from the plan', () => {
    const recipe = useStore.getState().recipes[0]
    const d = new Date()
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    useStore.setState({
      plan: [{ id: 'p', date: key, slot: 'dinner', recipeId: recipe.id }],
      shop: [],
      pantry: [],
      shopDismissed: [],
    })
    useStore.getState().generateShop([key])
    const first = useStore.getState().shop[0]
    expect(first.addedBy).toBe('m')
    useStore.setState({ shop: useStore.getState().shop.map((i) => ({ ...i, splitTo: 's' })) })
    useStore.getState().generateShop([key])
    const again = useStore.getState().shop.find((i) => i.key === first.key)
    expect(again).toMatchObject({ id: first.id, splitTo: 's', addedBy: 'm' })
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
