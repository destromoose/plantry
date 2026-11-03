// "Since you last looked": what the rest of the household changed, worked out from what came
// in on a sync. Nothing extra is synced for it; each phone compares the household's document
// before and after, and keeps its own short list.

import type { Member, Recipe } from './types'
import type { SyncDoc } from './syncDoc'
import { t } from './i18n'
import { fromDateKey } from './utils'
import { locale } from './i18n'

export interface Activity {
  id: string
  at: string
  text: string
  /** Who did it, when that's known. */
  by?: string
  /** Where tapping it goes. */
  href?: string
  /** It's about this person: a reply to their note, a night handed to them, an add while they shop. */
  forMe?: boolean
}

/** Keep two weeks and at most 40, newest first. */
export const ACTIVITY_DAYS = 14
const MAX = 40

const weekday = (date: string) =>
  fromDateKey(date).toLocaleDateString(locale(), { weekday: 'long' })

/**
 * What changed between `before` and `after` that someone else did. `meId` is the person on
 * this phone; things they did themselves on another device are skipped where we can tell.
 */
export function diffActivity(
  before: SyncDoc,
  after: SyncDoc,
  members: Pick<Member, 'id' | 'name'>[],
  recipes: Pick<Recipe, 'id' | 'title'>[],
  meId: string | undefined,
  now = new Date().toISOString()
): Activity[] {
  const name = (id?: string) => members.find((m) => m.id === id)?.name
  const title = (id?: string) => recipes.find((r) => r.id === id)?.title
  const out: Activity[] = []
  const push = (a: Omit<Activity, 'id' | 'at'>) =>
    out.push({ ...a, id: `${now}-${out.length}`, at: now })
  const notMe = (by?: string) => !by || by !== meId

  // Notes and replies
  const oldNotes = new Set(before.notes.map((n) => n.id))
  for (const n of after.notes) {
    if (oldNotes.has(n.id) || !notMe(n.by)) continue
    const who = name(n.by) ?? t('Someone')
    push({
      by: n.by,
      text: t('{name} left a note: {text}', { name: who, text: n.text }),
      href: n.on === 'shop' ? '/shop' : n.on === 'board' ? '/household' : '/week',
    })
  }
  const oldReplies = new Set(before.replies.map((r) => r.id))
  for (const r of after.replies) {
    if (oldReplies.has(r.id) || !notMe(r.by)) continue
    const note = after.notes.find((n) => n.id === r.noteId)
    const who = name(r.by) ?? t('Someone')
    push({
      by: r.by,
      text: t('{name} replied "{text}"', { name: who, text: r.text }),
      href: note?.on === 'shop' ? '/shop' : note?.on === 'board' ? '/household' : '/week',
      forMe: !!meId && note?.by === meId,
    })
  }

  // Dinners planned or changed
  const key = (p: { date: string; slot: string }) => `${p.date}|${p.slot}`
  const was = new Map(before.plan.map((p) => [key(p), p]))
  for (const p of after.plan) {
    if (p.slot !== 'dinner') continue
    const old = was.get(key(p))
    const what = title(p.recipeId) ?? (p.leftoversOf ? t('leftovers') : p.note)
    const changed =
      !old ||
      old.recipeId !== p.recipeId ||
      old.note !== p.note ||
      old.leftoversOf !== p.leftoversOf
    if (what && changed)
      push({ text: t('{day}: {what}', { day: weekday(p.date), what }), href: '/week' })
    if (old && p.cookId && p.cookId !== old.cookId && notMe(p.cookId)) {
      push({
        by: p.cookId,
        text: t('{name} is cooking {day}', {
          name: name(p.cookId) ?? t('Someone'),
          day: weekday(p.date),
        }),
        href: '/week',
      })
    }
  }

  // Nights handed over
  const oldHandoffs = new Set(before.handoffs.map((h) => h.id))
  for (const h of after.handoffs) {
    if (oldHandoffs.has(h.id) || !notMe(h.fromId)) continue
    const from = name(h.fromId) ?? t('Someone')
    const day = weekday(h.date)
    const toMe = !!meId && h.toId === meId
    push({
      by: h.fromId,
      text: toMe
        ? t('{name} asked you to cook {day}', { name: from, day })
        : t('{name} asked {to} to cook {day}', {
            name: from,
            to: name(h.toId) ?? t('someone'),
            day,
          }),
      href: '/',
      forMe: toMe,
    })
  }

  // Shopping
  const oldShop = new Set(before.shop.map((i) => i.id))
  const added = after.shop.filter((i) => !oldShop.has(i.id) && notMe(i.addedBy))
  const shopping = after.shopTrip?.by === meId && !!meId
  if (added.length) {
    const who = name(added[0].addedBy)
    const items = added
      .slice(0, 3)
      .map((i) => i.name)
      .join(', ')
    const more = added.length > 3 ? t(' and {n} more', { n: added.length - 3 }) : ''
    push({
      by: added[0].addedBy,
      text: who
        ? t('{name} added {items}{more} to the list', { name: who, items, more })
        : t('Added to the list: {items}{more}', { items, more }),
      href: '/shop',
      forMe: shopping,
    })
  }
  if (after.shopTrip?.by && after.shopTrip.by !== before.shopTrip?.by && notMe(after.shopTrip.by)) {
    push({
      by: after.shopTrip.by,
      text: t('{name} is at the shop', { name: name(after.shopTrip.by) ?? t('Someone') }),
      href: '/shop',
    })
  }

  // Ideas and "me too"
  const oldIdeas = new Map(before.ideas.map((i) => [i.id, i]))
  for (const i of after.ideas) {
    const label = title(i.recipeId) ?? i.text ?? ''
    const old = oldIdeas.get(i.id)
    if (!old && notMe(i.by)) {
      push({
        by: i.by,
        text: t('{name} fancies {what}', { name: name(i.by) ?? t('Someone'), what: label }),
        href: '/week',
      })
    } else if (old) {
      for (const v of i.votes ?? []) {
        if (old.votes?.includes(v) || !notMe(v)) continue
        push({
          by: v,
          text: t('{name} also fancies {what}', { name: name(v) ?? t('Someone'), what: label }),
          href: '/week',
          forMe: i.by === meId,
        })
      }
    }
  }

  // Who's out
  for (const [k, v] of Object.entries(after.presence)) {
    if (before.presence[k] === v) continue
    const [date, slot, who] = k.split('|')
    if (slot !== 'dinner' || !notMe(who) || v === 'home') continue
    push({
      by: who,
      text:
        v === 'out'
          ? t('{name} is out for dinner {day}', {
              name: name(who) ?? t('Someone'),
              day: weekday(date),
            })
          : t('{name} is home late {day}', { name: name(who) ?? t('Someone'), day: weekday(date) }),
      href: '/week',
    })
  }

  return out
}

/** Add new activity on top, dropping anything over two weeks old. */
export function keepActivity(list: Activity[], fresh: Activity[], now = Date.now()): Activity[] {
  const cutoff = now - ACTIVITY_DAYS * 86_400_000
  return [...fresh, ...list].filter((a) => new Date(a.at).getTime() >= cutoff).slice(0, MAX)
}
