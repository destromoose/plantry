'use client'

import { locale, t } from '@/lib/i18n'
import { useState } from 'react'
import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react'
import { useStore } from '@/lib/store'
import { monthGrid, repeatFor } from '@/lib/planTogether'
import { cn, fromDateKey } from '@/lib/utils'
import type { Member } from '@/lib/types'
import { Button } from '@/components/ui/Button'

const dot: Record<Member['color'], string> = {
  terracotta: 'bg-terracotta',
  saffron: 'bg-saffron',
  sage: 'bg-sage',
  plum: 'bg-plum',
}

/**
 * The month at a glance: what's for dinner each night, who cooks, and the weekly meals
 * still to come. Tapping a day opens its week.
 */
export function Month({
  today,
  onPickWeek,
}: {
  today: string
  onPickWeek: (date: string) => void
}) {
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const members = useStore((s) => s.members)
  const repeats = useStore((s) => s.repeats)
  const base = fromDateKey(today)
  const [shift, setShift] = useState(0)
  const year = new Date(base.getFullYear(), base.getMonth() + shift, 1).getFullYear()
  const month = new Date(base.getFullYear(), base.getMonth() + shift, 1).getMonth()
  const weeks = monthGrid(year, month)
  const title = new Date(year, month, 1).toLocaleDateString(locale(), {
    month: 'long',
    year: 'numeric',
  })
  const weekdays = weeks[0].map((d) =>
    fromDateKey(d).toLocaleDateString(locale(), { weekday: 'narrow' })
  )
  const planned = weeks
    .flat()
    .filter((d) => fromDateKey(d).getMonth() === month)
    .filter((d) =>
      plan.some(
        (p) => p.date === d && p.slot === 'dinner' && (p.recipeId || p.leftoversOf || p.note)
      )
    ).length

  return (
    <section aria-label={title}>
      <div className="mb-3 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('Previous month')}
          onClick={() => setShift((s) => s - 1)}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="min-w-0 flex-1 text-center font-display text-xl font-semibold capitalize">
          {title}
        </h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('Next month')}
          onClick={() => setShift((s) => s + 1)}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <p className="mb-3 text-center text-sm text-ink-2">
        {t('{n} dinners planned this month', { n: planned })}
      </p>
      <div
        className="grid grid-cols-7 gap-1 text-center text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-3"
        aria-hidden
      >
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1" role="grid">
        {weeks.flat().map((d) => {
          const day = fromDateKey(d)
          const inMonth = day.getMonth() === month
          const e = plan.find((p) => p.date === d && p.slot === 'dinner')
          const r = recipes.find((x) => x.id === (e?.recipeId ?? e?.leftoversOf))
          const label = r ? (e?.leftoversOf ? t('Leftovers') : r.title) : e?.note
          const weekly = !label && d >= today ? repeatFor(repeats, d, 'dinner') : undefined
          const weeklyLabel = weekly
            ? (recipes.find((x) => x.id === weekly.recipeId)?.title ?? weekly.note)
            : undefined
          const cook = members.find((m) => m.id === e?.cookId)
          const isToday = d === today
          const longDay = day.toLocaleDateString(locale(), {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              onClick={() => onPickWeek(d)}
              aria-label={`${longDay}: ${label ?? (weeklyLabel ? t('{what}, every week', { what: weeklyLabel }) : t('nothing planned'))}${cook ? `, ${t('{name} cooks', { name: cook.name })}` : ''}`}
              className={cn(
                'flex min-h-[4.25rem] flex-col items-start gap-0.5 overflow-hidden rounded-lg border p-1 text-left',
                inMonth ? 'border-line bg-surface' : 'border-transparent bg-transparent opacity-50',
                isToday && 'ring-2 ring-accent',
                e?.done && 'bg-surface-2'
              )}
            >
              <span
                className={cn(
                  'flex w-full items-center justify-between text-xs font-semibold',
                  isToday ? 'text-accent' : 'text-ink-2'
                )}
              >
                {day.getDate()}
                {cook && (
                  <span className={cn('h-2 w-2 rounded-full', dot[cook.color])} aria-hidden />
                )}
              </span>
              {label ? (
                <span
                  className={cn(
                    'line-clamp-3 hyphens-auto text-[0.6875rem] leading-tight [overflow-wrap:anywhere]',
                    e?.done ? 'text-ink-3' : 'text-ink'
                  )}
                >
                  {label}
                </span>
              ) : weeklyLabel ? (
                <span className="flex items-start gap-0.5 text-[0.6875rem] leading-tight text-ink-3">
                  <Repeat className="mt-px h-2.5 w-2.5 shrink-0" aria-hidden />
                  <span className="line-clamp-2 hyphens-auto [overflow-wrap:anywhere]">
                    {weeklyLabel}
                  </span>
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
