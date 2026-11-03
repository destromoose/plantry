import { describe, expect, it } from 'vitest'
import { washerFor } from './chores'
import { addDays } from './utils'

const members = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

describe('washerFor', () => {
  it('is never the cook, and nobody when no one cooks or no one else is home', () => {
    for (let i = 0; i < 10; i++)
      expect(washerFor(addDays('2026-11-01', i), 'a', members)?.id).not.toBe('a')
    expect(washerFor('2026-11-01', undefined, members)).toBeUndefined()
    expect(washerFor('2026-11-01', 'a', [{ id: 'a' }])).toBeUndefined()
  })

  it('takes turns fairly', () => {
    const counts: Record<string, number> = {}
    for (let i = 0; i < 14; i++) {
      const w = washerFor(addDays('2026-11-01', i), 'a', members)!.id
      counts[w] = (counts[w] ?? 0) + 1
    }
    expect(counts).toEqual({ b: 7, c: 7 })
  })

  it('gives the same answer on every phone, whatever order members are in', () => {
    expect(washerFor('2026-11-05', 'a', [...members].reverse())).toEqual(
      washerFor('2026-11-05', 'a', members)
    )
  })
})
