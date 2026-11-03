import { describe, expect, it } from 'vitest'
import {
  boardNotes,
  eatersFor,
  nextPresence,
  presenceKey,
  presenceLine,
  presenceOf,
  pruneNotes,
  weeklyKey,
} from './together'
import { mergeDocs, emptyDoc } from './syncDoc'
import type { HouseNote, Member, Presence } from './types'

const m = (id: string, name: string, isMe = false) => ({ id, name, color: 'sage', isMe }) as Member
const members = [m('a', 'Alex', true), m('s', 'Sara')]
const t = (s: string, v?: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(v?.[k] ?? ''))
// 2026-11-03 is a Tuesday.
const TUE = '2026-11-03'

describe('who is home', () => {
  it('uses the day answer, then the usual week, then home', () => {
    const weekly: Record<string, Presence> = { [weeklyKey(2, 'dinner', 's')]: 'out' }
    expect(presenceOf({}, weekly, TUE, 'dinner', 's')).toEqual({
      value: 'out',
      usual: true,
      set: true,
    })
    const day = { [presenceKey(TUE, 'dinner', 's')]: 'home' as Presence }
    expect(presenceOf(day, weekly, TUE, 'dinner', 's').value).toBe('home')
    expect(presenceOf({}, {}, TUE, 'dinner', 'a')).toEqual({
      value: 'home',
      usual: false,
      set: false,
    })
    expect(['home', 'late', 'out'].map((p) => nextPresence(p as Presence))).toEqual([
      'late',
      'out',
      'home',
    ])
  })

  it('counts who eats, keeping people who are not members', () => {
    const out = { [presenceKey(TUE, 'dinner', 's')]: 'out' as Presence }
    expect(eatersFor(members, {}, {}, TUE, 'dinner', 2)).toBeUndefined()
    expect(eatersFor(members, out, {}, TUE, 'dinner', 2)).toBe(1)
    // Two kids at the table too.
    expect(eatersFor(members, out, {}, TUE, 'dinner', 4)).toBe(3)
    const both = { ...out, [presenceKey(TUE, 'dinner', 'a')]: 'out' as Presence }
    expect(eatersFor(members, both, {}, TUE, 'dinner', 2)).toBe(0)
  })

  it('says it in one line', () => {
    const line = (p: Record<string, Presence>) =>
      presenceLine(members, p, {}, TUE, 'dinner', 'a', t)
    expect(line({})).toBeUndefined()
    expect(line({ [presenceKey(TUE, 'dinner', 's')]: 'out' })).toBe('Just you')
    expect(line({ [presenceKey(TUE, 'dinner', 'a')]: 'out' })).toBe('Just Sara')
    expect(line({ [presenceKey(TUE, 'dinner', 's')]: 'late' })).toBe('Sara home late')
    expect(line({ [presenceKey(TUE, 'dinner', 's')]: 'home' })).toBe('Everyone home')
  })
})

describe('notes', () => {
  const n = (id: string, x: Partial<HouseNote>): HouseNote => ({
    id,
    text: id,
    at: '2026-11-01T10:00:00.000Z',
    on: 'board',
    ...x,
  })

  it('keeps the board to a week unless pinned', () => {
    const notes = [
      n('new', { at: '2026-11-02T10:00:00.000Z' }),
      n('old', { at: '2026-10-01T10:00:00.000Z' }),
      n('pinned', { at: '2026-09-01T10:00:00.000Z', pinned: true }),
      n('day', { on: 'day', date: TUE }),
    ]
    expect(boardNotes(notes, TUE).map((x) => x.id)).toEqual(['new', 'pinned'])
  })

  it('prunes old notes and their replies', () => {
    const notes = [n('keep', {}), n('gone', { on: 'day', date: '2026-08-01' })]
    const replies = [
      { id: 'r1', noteId: 'keep', text: 'ok', at: '' },
      { id: 'r2', noteId: 'gone', text: 'ok', at: '' },
    ]
    const p = pruneNotes(notes, replies, TUE)
    expect(p.notes.map((x) => x.id)).toEqual(['keep'])
    expect(p.replies.map((x) => x.id)).toEqual(['r1'])
  })

  it('merges notes, replies and who is home from two phones', () => {
    const base = emptyDoc()
    const mine = {
      ...base,
      notes: [n('n1', { text: 'Defrost the chicken' })],
      presence: { [presenceKey(TUE, 'dinner', 'a')]: 'late' as Presence },
    }
    const theirs = {
      ...base,
      replies: [{ id: 'r1', noteId: 'n0', text: "I'll cook", at: '' }],
      presence: { [presenceKey(TUE, 'dinner', 's')]: 'out' as Presence },
    }
    const merged = mergeDocs(base, mine, theirs)
    expect(merged.notes.map((x) => x.id)).toEqual(['n1'])
    expect(merged.replies.map((x) => x.id)).toEqual(['r1'])
    expect(Object.keys(merged.presence).sort()).toEqual([
      presenceKey(TUE, 'dinner', 'a'),
      presenceKey(TUE, 'dinner', 's'),
    ])
  })
})
