'use client'

import { t } from '@/lib/i18n'

import { useMemo } from 'react'
import Link from 'next/link'
import { useStore } from '@/lib/store'
import { formatMoney, planCost } from '@/lib/cost'
import { cn, pluralize } from '@/lib/utils'

/** "About $54 for 6 dinners, $26 under your $80." Quiet when nothing is planned. */
export function WeekBudget({ dates, className }: { dates: string[]; className?: string }) {
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const settings = useStore((s) => s.settings)
  const { total, dinners } = useMemo(
    () => planCost(plan, dates, recipes, settings),
    [plan, dates, recipes, settings]
  )
  const budget = settings.weeklyBudget
  if (!dinners && !budget) return null
  const money = (n: number) => formatMoney(n, settings.currency)
  const over = budget > 0 && total > budget
  const share = budget > 0 ? Math.min(1, total / budget) : 0

  return (
    <div className={cn('card px-4 py-3', className)}>
      <p className="text-[0.9375rem] text-ink-2">
        {dinners ? (
          <>
            {t('About')} <span className="font-semibold text-ink">{money(total)}</span>{' '}
            {t('for {v0}', { v0: pluralize(dinners, 'planned dinner') })}
          </>
        ) : (
          t('Nothing planned yet')
        )}
        {budget > 0 &&
          (over
            ? t(', about {v0} over your {v1}.', { v0: money(total - budget), v1: money(budget) })
            : t(', {v0} left of your {v1}.', { v0: money(budget - total), v1: money(budget) }))}
        {!budget && (
          <>
            .{' '}
            <Link href="/settings#budget" className="text-ink underline underline-offset-2">
              {t('Set a budget')}
            </Link>
          </>
        )}
      </p>
      {budget > 0 && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-label={t('Budget used')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(share * 100)}
        >
          <div
            className={cn('h-full rounded-full', over ? 'bg-danger' : 'bg-secondary')}
            style={{ width: `${share * 100}%` }}
          />
        </div>
      )}
      {over && (
        <p className="mt-2 text-sm text-ink-3">
          {t('Fill my week picks cheaper dinners for the open nights while you have a budget set.')}
        </p>
      )}
    </div>
  )
}
