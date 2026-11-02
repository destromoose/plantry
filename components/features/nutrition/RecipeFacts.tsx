'use client'

import { t } from '@/lib/i18n'

import { useMemo } from 'react'
import { useStore } from '@/lib/store'
import { nutritionOf, isReliable } from '@/lib/nutrition'
import { formatMoney, recipeCost } from '@/lib/cost'
import type { Recipe } from '@/lib/types'

/** Rough cost and nutrition for a recipe at the servings shown. */
export function RecipeFacts({ recipe, servings }: { recipe: Recipe; servings: number }) {
  const settings = useStore((s) => s.settings)
  const pantry = useStore((s) => s.pantry)
  const cost = useMemo(
    () => recipeCost(recipe, servings, settings, pantry),
    [recipe, servings, settings, pantry]
  )
  const n = useMemo(() => nutritionOf(recipe), [recipe])
  const money = (x: number) => formatMoney(x, settings.currency)
  const showCost = cost.known > 0 && cost.known / cost.count >= 0.6
  // Totals from a few ingredients mislead (a curry at 30 kcal), so wait for most of them.
  const showNutrition = settings.showNutrition && n.total > 0 && n.known / n.total >= 0.6

  if (!showCost && !showNutrition) return null
  return (
    <section aria-labelledby="facts-h" className="card p-4">
      <h2 id="facts-h" className="sr-only">
        {t('Cost and nutrition')}
      </h2>
      {showCost && (
        <p className="text-[0.9375rem] text-ink-2">
          {t('About')} <span className="font-semibold text-ink">{money(cost.total)}</span>{' '}
          {t('for {servings}, {v1} a serving.', { servings, v1: money(cost.perServing) })}
          {cost.toBuy > 0.05 && cost.toBuy < cost.total - 0.05 && (
            <> {t("You'd spend about {v0} on what you don't have.", { v0: money(cost.toBuy) })}</>
          )}
        </p>
      )}
      {showNutrition && (
        <>
          <dl
            className={
              showCost
                ? 'mt-3 grid grid-cols-5 gap-2 border-t border-line pt-3 text-center'
                : 'grid grid-cols-5 gap-2 text-center'
            }
          >
            <Fact label="kcal" value={Math.round(n.kcal)} />
            <Fact label="protein" value={`${Math.round(n.protein)} g`} />
            <Fact label="carbs" value={`${Math.round(n.carbs)} g`} />
            <Fact label="fat" value={`${Math.round(n.fat)} g`} />
            <Fact label="fibre" value={`${Math.round(n.fibre)} g`} />
          </dl>
          <p className="mt-2 text-xs text-ink-3">
            {t('Per serving, roughly, from food tables')}
            {isReliable(n)
              ? ''
              : t(' (counted {known} of {total} ingredients)', { known: n.known, total: n.total })}
            {t('. Not a label.')}
          </p>
        </>
      )}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="font-display text-lg font-semibold tabular-nums leading-tight">{value}</dd>
    </div>
  )
}
