import { describe, expect, it } from 'vitest'
import { diffActivity, keepActivity } from './activity'
import { emptyDoc } from './syncDoc'

const members = [
  { id: 'a', name: 'Alex' },
  { id: 's', name: 'Sara' },
]
const recipes = [{ id: 'r1', title: 'Tacos' }]
const now = '2026-11-03T18:00:00.000Z'

describe('diffActivity', () => {
  it('describes what the others changed, and marks what concerns you', () => {
    const before = {
      ...emptyDoc(),
      notes: [
        {
          id: 'n1',
          text: 'Defrost the chicken',
          by: 'a',
          at: now,
          on: 'day' as const,
          date: '2026-11-03',
        },
      ],
      shopTrip: { by: 'a', since: now },
    }
    const after = {
      ...before,
      replies: [{ id: 'p1', noteId: 'n1', by: 's', text: 'On it', at: now }],
      plan: [{ id: 'x', date: '2026-11-06', slot: 'dinner' as const, recipeId: 'r1' }],
      shop: [
        {
          id: 'i1',
          name: 'Milk',
          key: 'milk',
          aisle: 'dairy' as const,
          checked: false,
          fromRecipeIds: [],
          addedBy: 's',
        },
      ],
      ideas: [{ id: 'd1', text: 'Ramen', by: 's', at: now }],
      presence: { '2026-11-05|dinner|s': 'out' as const },
    }
    const out = diffActivity(before, after, members, recipes, 'a', now)
    const texts = out.map((a) => a.text)
    expect(texts).toContain('Sara replied "On it"')
    expect(texts).toContain('Friday: Tacos')
    expect(texts).toContain('Sara added Milk to the list')
    expect(texts).toContain('Sara fancies Ramen')
    expect(texts).toContain('Sara is out for dinner Thursday')
    expect(out.find((a) => a.text.startsWith('Sara replied'))?.forMe).toBe(true)
    // Alex is at the shop, so Sara's add concerns Alex.
    expect(out.find((a) => a.text.includes('to the list'))?.forMe).toBe(true)
  })

  it("leaves out this person's own changes", () => {
    const after = {
      ...emptyDoc(),
      notes: [{ id: 'n1', text: 'Hi', by: 'a', at: now, on: 'board' as const }],
      ideas: [{ id: 'd1', text: 'Ramen', by: 'a', at: now }],
    }
    expect(diffActivity(emptyDoc(), after, members, recipes, 'a', now)).toEqual([])
  })
})

describe('keepActivity', () => {
  it('keeps two weeks, newest first', () => {
    const old = { id: 'o', at: '2026-10-01T00:00:00.000Z', text: 'old' }
    const fresh = { id: 'f', at: now, text: 'new' }
    expect(keepActivity([old], [fresh], new Date(now).getTime()).map((a) => a.id)).toEqual(['f'])
  })
})
