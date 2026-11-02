'use client'

import { t } from '@/lib/i18n'
import { useMemo } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Recipe } from '@/lib/types'
import { useStore } from '@/lib/store'
import { useAvoid } from '@/lib/useAvoid'
import { similarRecipes } from '@/lib/similar'
import { reveal } from '@/lib/motion'
import { formatMinutes } from '@/lib/utils'
import { SectionTitle } from '@/components/ui/Card'
import { RecipeImage } from './RecipeImage'

/** A short row of close dishes, so a recipe you like leads to the next one. */
export function MoreLikeThis({ recipe }: { recipe: Recipe }) {
  const recipes = useStore((s) => s.recipes)
  const avoid = useAvoid()
  const similar = useMemo(() => similarRecipes(recipe, recipes, avoid), [recipe, recipes, avoid])
  if (!similar.length) return null
  return (
    <motion.section variants={reveal} custom={3} aria-labelledby="more-title">
      <SectionTitle>
        <span id="more-title">{t('More like this')}</span>
      </SectionTitle>
      <ul className="-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0">
        {similar.map((r) => (
          <li key={r.id} className="flex w-40 shrink-0 snap-start md:w-auto">
            <Link
              href={`/recipes/${r.id}`}
              className="card group block w-full overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
            >
              <div className="relative aspect-[4/3] overflow-hidden">
                <RecipeImage url={r.imageUrl} seed={r.id} sizes="(min-width: 768px) 200px, 160px" />
              </div>
              <div className="p-2.5">
                <p className="line-clamp-2 font-display text-[0.9375rem] font-semibold leading-snug tracking-tight">
                  {r.title}
                </p>
                <p className="mt-0.5 text-[0.8125rem] text-ink-2">
                  {formatMinutes(r.activeMinutes)}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </motion.section>
  )
}
