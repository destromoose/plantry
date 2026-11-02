import { describe, expect, it } from 'vitest'
import { emptyDoc, mergeDocs, toDoc, type SyncDoc } from './syncDoc'
import { defaultSettings } from './schema'
import type { ShopItem } from './types'

const item = (id: string, name: string, checked = false): ShopItem => ({
  id,
  name,
  key: name.toLowerCase(),
  aisle: 'produce',
  checked,
  fromRecipeIds: [],
})
const doc = (patch: Partial<SyncDoc>): SyncDoc => ({ ...emptyDoc(), ...patch })

describe('mergeDocs', () => {
  const base = doc({ shop: [item('a', 'Lime'), item('b', 'Eggs'), item('c', 'Rice')] })

  it('keeps additions from both phones', () => {
    const local = doc({ shop: [...base.shop, item('d', 'Milk')] })
    const remote = doc({ shop: [...base.shop, item('e', 'Bread')] })
    const m = mergeDocs(base, local, remote)
    expect(m.shop.map((i) => i.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('applies a delete from this phone and an edit from the other', () => {
    const local = doc({ shop: base.shop.filter((i) => i.id !== 'b') })
    const remote = doc({ shop: base.shop.map((i) => (i.id === 'a' ? { ...i, checked: true } : i)) })
    const m = mergeDocs(base, local, remote)
    expect(m.shop.map((i) => i.id)).toEqual(['a', 'c'])
    expect(m.shop[0].checked).toBe(true)
  })

  it('lets the other phone delete what this phone left alone', () => {
    const remote = doc({ shop: base.shop.filter((i) => i.id !== 'c') })
    const m = mergeDocs(base, base, remote)
    expect(m.shop.map((i) => i.id)).toEqual(['a', 'b'])
  })

  it('treats one dinner per night as the same plan entry from either phone', () => {
    const local = doc({ plan: [{ id: 'x', date: '2026-11-03', slot: 'dinner', recipeId: 'r1' }] })
    const remote = doc({ plan: [{ id: 'y', date: '2026-11-03', slot: 'dinner', recipeId: 'r2' }] })
    const m = mergeDocs(emptyDoc(), local, remote)
    expect(m.plan).toHaveLength(1)
    expect(m.plan[0].recipeId).toBe('r1')
  })

  it('merges shared settings field by field', () => {
    const b = doc({ settings: { cookingFor: 2, weeklyBudget: 0 } })
    const local = doc({ settings: { cookingFor: 4, weeklyBudget: 0 } })
    const remote = doc({ settings: { cookingFor: 2, weeklyBudget: 80 } })
    expect(mergeDocs(b, local, remote).settings).toEqual({ cookingFor: 4, weeklyBudget: 80 })
  })

  it('keeps history newest first', () => {
    const local = doc({ cooked: [{ recipeId: 'a', date: '2026-11-02' }] })
    const remote = doc({ cooked: [{ recipeId: 'b', date: '2026-11-03' }] })
    expect(mergeDocs(emptyDoc(), local, remote).cooked.map((c) => c.date)).toEqual([
      '2026-11-03',
      '2026-11-02',
    ])
  })
})

describe('toDoc', () => {
  it('leaves out what belongs to one phone', () => {
    const d = toDoc({
      settings: { ...defaultSettings, mood: 'night', textSize: 'larger', cookingFor: 5 },
      members: [{ id: 'm1', name: 'Rosa', color: 'sage', isMe: true }],
      recipes: [],
      pantry: [],
      plan: [],
      shop: [],
      shopDismissed: [],
      handoffs: [],
      cooked: [],
      energyByDate: {},
    })
    expect(d.settings).toMatchObject({ cookingFor: 5 })
    expect(d.settings).not.toHaveProperty('mood')
    expect(d.settings).not.toHaveProperty('textSize')
    expect(d.members[0]).not.toHaveProperty('isMe')
  })
})
