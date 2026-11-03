// Living together: who's home for which meal, and notes left where they belong instead of
// in a messaging app. Pure helpers; the store keeps the data and syncs it with the household.

import type { HouseNote, MealSlot, Member, NoteReply, Presence } from './types'
import { addDays, fromDateKey, toDateKey } from './utils'

export const presenceKey = (date: string, slot: MealSlot, memberId: string) =>
  `${date}|${slot}|${memberId}`
export const weeklyKey = (dow: number, slot: MealSlot, memberId: string) =>
  `${dow}|${slot}|${memberId}`

/** Someone's answer for a meal: what they said for that day, else their usual week, else home. */
export function presenceOf(
  presence: Record<string, Presence>,
  weekly: Record<string, Presence>,
  date: string,
  slot: MealSlot,
  memberId: string
): { value: Presence; usual: boolean; set: boolean } {
  const day = presence[presenceKey(date, slot, memberId)]
  if (day) return { value: day, usual: false, set: true }
  const w = weekly[weeklyKey(fromDateKey(date).getDay(), slot, memberId)]
  if (w) return { value: w, usual: true, set: true }
  return { value: 'home', usual: false, set: false }
}

export const nextPresence = (p: Presence): Presence =>
  p === 'home' ? 'late' : p === 'late' ? 'out' : 'home'

/**
 * How many people eat a meal, when anyone said they're out. Undefined means "as usual".
 * The household cooks for `cookingFor` people (kids may not be members), less whoever's out.
 */
export function eatersFor(
  members: Member[],
  presence: Record<string, Presence>,
  weekly: Record<string, Presence>,
  date: string,
  slot: MealSlot,
  cookingFor?: number
): number | undefined {
  if (!members.length) return undefined
  const out = members.filter(
    (m) => presenceOf(presence, weekly, date, slot, m.id).value === 'out'
  ).length
  if (!out) return undefined
  return Math.max(0, Math.max(cookingFor ?? members.length, members.length) - out)
}

/** One plain line about who's eating: "Just you tonight", "Sara's home late". */
export function presenceLine(
  members: Member[],
  presence: Record<string, Presence>,
  weekly: Record<string, Presence>,
  date: string,
  slot: MealSlot,
  meId: string | undefined,
  t: (s: string, v?: Record<string, string | number>) => string
): string | undefined {
  if (members.length < 2) return undefined
  const answers = members.map((m) => ({ m, p: presenceOf(presence, weekly, date, slot, m.id) }))
  if (!answers.some((a) => a.p.set)) return undefined
  const home = answers.filter((a) => a.p.value !== 'out')
  const late = answers.filter((a) => a.p.value === 'late')
  const out = answers.filter((a) => a.p.value === 'out')
  if (home.length === 0) return t('Everyone is out')
  if (home.length === 1 && out.length > 0)
    return home[0].m.id === meId ? t('Just you') : t('Just {name}', { name: home[0].m.name })
  if (late.length) return t('{names} home late', { names: late.map((a) => a.m.name).join(', ') })
  if (out.length) return t('{names} out', { names: out.map((a) => a.m.name).join(', ') })
  return t('Everyone home')
}

/** Notes on a day, newest first. Day notes and that day's meal notes. */
export function notesFor(
  notes: HouseNote[],
  where: { on: HouseNote['on']; date?: string; itemKey?: string }
): HouseNote[] {
  return notes
    .filter(
      (n) =>
        n.on === where.on &&
        (where.date === undefined || n.date === where.date) &&
        (where.itemKey === undefined || n.itemKey === where.itemKey)
    )
    .sort((a, b) => (a.at < b.at ? 1 : -1))
}

/** The local day a note was written, so a morning note east of UTC isn't a day early. */
function dayOf(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : toDateKey(d)
}

/** Fridge board: pinned notes, and the rest for a week. */
export function boardNotes(notes: HouseNote[], today: string): HouseNote[] {
  const since = addDays(today, -7)
  return notesFor(notes, { on: 'board' }).filter((n) => n.pinned || dayOf(n.at) >= since)
}

export const repliesTo = (replies: NoteReply[], noteId: string) =>
  replies.filter((r) => r.noteId === noteId).sort((a, b) => (a.at < b.at ? -1 : 1))

/** Day and list notes are kept for 60 days after their day; board notes for 60 days unless pinned. */
export function pruneNotes(notes: HouseNote[], replies: NoteReply[], today: string) {
  const cutoff = addDays(today, -60)
  const kept = notes.filter((n) => n.pinned || (n.date ?? dayOf(n.at)) >= cutoff)
  const ids = new Set(kept.map((n) => n.id))
  return { notes: kept, replies: replies.filter((r) => ids.has(r.noteId)) }
}

/** One-tap answers, fitting where the note sits. */
export const QUICK_REPLIES: Record<HouseNote['on'], string[]> = {
  day: ['Sounds good', "I'll cook", 'Not tonight', "I'll pick it up"],
  shop: ["I'll pick it up", 'Got it'],
  board: ['Sounds good', 'On it'],
}

/** Shrink a photo to a small JPEG data URL so it can travel with the household. */
export async function shrinkPhoto(file: File, max = 640): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image()
      i.onload = () => ok(i)
      i.onerror = bad
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.width, img.height))
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * scale)
    c.height = Math.round(img.height * scale)
    c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.7)
  } finally {
    URL.revokeObjectURL(url)
  }
}
