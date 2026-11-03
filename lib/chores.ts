// "Whoever cooks doesn't wash up." The washing up rotates through everyone else in the
// household, worked out from the date alone, so every phone agrees without saving anything.

import type { Member } from './types'

const dayNumber = (date: string) => Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000)

/** Who washes up on this date, given who cooks. Nobody when there's no one else. */
export function washerFor<M extends Pick<Member, 'id'>>(
  date: string,
  cookId: string | undefined,
  members: M[]
): M | undefined {
  if (!cookId) return undefined
  const others = members.filter((m) => m.id !== cookId).sort((a, b) => (a.id < b.id ? -1 : 1))
  if (!others.length) return undefined
  return others[dayNumber(date) % others.length]
}
