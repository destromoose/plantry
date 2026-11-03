'use client'

import { t } from '@/lib/i18n'

import { useState } from 'react'
import Link from 'next/link'
import { MessageSquare, ShoppingCart } from 'lucide-react'
import { useTrip } from '@/components/features/shop/ShopTogether'
import { useStore } from '@/lib/store'
import { nextPresence, notesFor, presenceLine, presenceOf } from '@/lib/together'
import { NotesSheet } from './Notes'
import type { MealSlot, Presence } from '@/lib/types'
import { cn, fromDateKey } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'

export function presenceLabel(p: Presence): string {
  return p === 'home' ? t('Home') : p === 'late' ? t('Late') : t('Out')
}

/** A face per person for one meal. Tap a face to go Home, Late, Out. */
export function WhoHome({
  date,
  slot,
  className,
  showLine = true,
}: {
  date: string
  slot: MealSlot
  className?: string
  showLine?: boolean
}) {
  const members = useStore((s) => s.members)
  const presence = useStore((s) => s.presence)
  const weekly = useStore((s) => s.presenceWeekly)
  const setPresence = useStore((s) => s.setPresence)
  if (members.length < 2) return null
  const me = members.find((m) => m.isMe)?.id
  const line = presenceLine(members, presence, weekly, date, slot, me, t)

  return (
    <div className={className}>
      <ul className="flex flex-wrap gap-2" aria-label={t("Who's home")}>
        {members.map((m) => {
          const p = presenceOf(presence, weekly, date, slot, m.id)
          const next = nextPresence(p.value)
          return (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setPresence(date, slot, m.id, next)}
                aria-label={t('{name}: {state}. Change to {next}', {
                  name: m.name,
                  state: presenceLabel(p.value),
                  next: presenceLabel(next),
                })}
                className={cn(
                  'flex min-h-[44px] items-center gap-2 rounded-pill border py-1 pl-1 pr-3 text-sm font-medium transition-colors',
                  p.value === 'home' && 'border-line-strong bg-surface text-ink',
                  p.value === 'late' && 'border-saffron bg-saffron/15 text-ink',
                  p.value === 'out' && 'border-dashed border-ink-3 bg-transparent text-ink-3'
                )}
              >
                <Avatar member={m} size="sm" className={cn(p.value === 'out' && 'opacity-50')} />
                <span>
                  {m.name}
                  <span className="ml-1 text-ink-3">· {presenceLabel(p.value)}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {showLine && line && <p className="mt-2 text-sm text-ink-2">{line}</p>}
    </div>
  )
}

/** The Week day sheet: who's home for each meal that day, and their usual week. */
export function WhoHomeBody({ date, slots }: { date: string; slots: MealSlot[] }) {
  const members = useStore((s) => s.members)
  const presence = useStore((s) => s.presence)
  const weekly = useStore((s) => s.presenceWeekly)
  const setWeekly = useStore((s) => s.setWeeklyPresence)
  const dow = fromDateKey(date).getDay()
  const dayName = fromDateKey(date).toLocaleDateString(undefined, { weekday: 'long' })
  if (members.length < 2)
    return (
      <p className="text-ink-2">
        {t('Add the people you live with in Household, then each of you can say when you are out.')}
      </p>
    )
  return (
    <div className="space-y-6">
      {slots.map((slot) => (
        <section key={slot}>
          <h3 className="mb-2 font-display text-lg font-semibold">
            {slot === 'breakfast' ? t('Breakfast') : slot === 'lunch' ? t('Lunch') : t('Dinner')}
          </h3>
          <WhoHome date={date} slot={slot} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {members.map((m) => {
              const p = presenceOf(presence, weekly, date, slot, m.id)
              if (p.value === 'home') return null
              const usual = weekly[`${dow}|${slot}|${m.id}`] === p.value
              return (
                <label
                  key={m.id}
                  className="flex min-h-[40px] items-center gap-2 text-sm text-ink-2"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-accent"
                    checked={usual}
                    onChange={(e) =>
                      setWeekly(dow, slot, m.id, e.target.checked ? p.value : undefined)
                    }
                  />
                  {t('{name} is {state} every {day}', {
                    name: m.name,
                    state: presenceLabel(p.value).toLowerCase(),
                    day: dayName,
                  })}
                </label>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

/** Tonight's card: who's eating, and the notes left for the day. */
export function TonightTogether({ date, label }: { date: string; label: string }) {
  const members = useStore((s) => s.members)
  const notes = useStore((s) => s.notes)
  const [open, setOpen] = useState(false)
  const trip = useTrip()
  if (members.length < 2) return null
  const shopper = trip && members.find((m) => m.id === trip.by && !m.isMe)
  const dayNotes = notesFor(notes, { on: 'day', date })
  const latest = dayNotes[0]
  const author = latest && members.find((m) => m.id === latest.by)
  return (
    <section className="card p-4" aria-labelledby="together-h">
      <h2 id="together-h" className="mb-3 font-display text-lg font-semibold">
        {t("Who's eating {when}", { when: label.toLowerCase() })}
      </h2>
      <WhoHome date={date} slot="dinner" />
      {shopper && (
        <Link
          href="/shop"
          className="mt-3 flex min-h-[44px] items-center gap-2 rounded-xl bg-accent/10 px-3 text-sm font-medium text-ink hover:bg-accent/15"
        >
          <ShoppingCart className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          {t('{name} is at the shop. Need anything?', { name: shopper.name })}
        </Link>
      )}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex min-h-[44px] w-full items-center gap-2 rounded-xl border-t border-line pt-3 text-left text-sm text-ink-2 hover:text-ink"
      >
        <MessageSquare className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
        {latest ? (
          <span className="min-w-0 flex-1 truncate">
            <span className="font-semibold text-ink">{author?.name ?? t('Someone')}:</span>{' '}
            {latest.text}
            {dayNotes.length > 1 && (
              <span className="text-ink-3"> · {t('{n} notes', { n: dayNotes.length })}</span>
            )}
          </span>
        ) : (
          <span className="flex-1">{t('Leave a note for today')}</span>
        )}
      </button>
      <NotesSheet
        where={open ? { on: 'day', date } : null}
        title={t('Notes for {day}', { day: label.toLowerCase() })}
        placeholder={t('Defrost the chicken, back at 8…')}
        onClose={() => setOpen(false)}
      />
    </section>
  )
}
