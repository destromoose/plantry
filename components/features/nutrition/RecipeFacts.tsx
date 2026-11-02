'use client'

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
  const showNutrition = settings.showNutrition && n.known > 0

  if (!showCost && !showNutrition) return null
  return (
    <section aria-labelledby="facts-h" className="card p-4">
      <h2 id="facts-h" className="sr-only">
        Cost and nutrition
      </h2>
      {showCost && (
        <p className="text-[0.9375rem] text-ink-2">
          About <span className="font-semibold text-ink">{money(cost.total)}</span> for {servings},{' '}
          {money(cost.perServing)} a serving.
          {cost.toBuy > 0.05 && cost.toBuy < cost.total - 0.05 && (
            <> You&apos;d spend about {money(cost.toBuy)} on what you don&apos;t have.</>
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
            Per serving, roughly, from food tables
            {isReliable(n) ? '' : ` (counted ${n.known} of ${n.total} ingredients)`}. Not a label.
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
