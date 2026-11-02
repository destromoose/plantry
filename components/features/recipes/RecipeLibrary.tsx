'use client'

import { t } from '@/lib/i18n'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, Link2, PencilLine, Plus, Search, SearchX } from 'lucide-react'
import { useStore } from '@/lib/store'
import { AvoidBadge } from '@/components/features/household/AvoidWarning'
import { coverage } from '@/lib/suggest'
import type { Taste } from '@/lib/types'
import { formatMinutes, cn } from '@/lib/utils'
import { reveal, staggerContainer } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { Chip, Tag } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { RecipeImage } from './RecipeImage'
import { allTastes, tasteLabels } from './tastes'

/** How many recipes to show at a time. */
const PAGE = 24

export function RecipeLibrary() {
  const router = useRouter()
  const recipes = useStore((s) => s.recipes)
  const pantry = useStore((s) => s.pantry)
  const toggleFavorite = useStore((s) => s.toggleFavorite)

  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [tastes, setTastes] = useState<Taste[]>([])
  const [favOnly, setFavOnly] = useState(false)
  const [canMake, setCanMake] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [shown, setShown] = useState(PAGE)
  const searchRef = useRef<HTMLInputElement>(null)

  // A new search or filter starts from the top of the list again.
  useEffect(() => setShown(PAGE), [debounced, tastes, favOnly, canMake])

  // "/" jumps to search, as on many sites.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tItem = e.target as HTMLElement
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      if (tItem.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]'))
        return
      e.preventDefault()
      searchRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const tItem = setTimeout(() => setDebounced(query.trim().toLowerCase()), 180)
    return () => clearTimeout(tItem)
  }, [query])

  const filtered = useMemo(() => {
    return recipes
      .map((recipe) => ({ recipe, cov: coverage(recipe, pantry) }))
      .filter(({ recipe, cov }) => {
        if (favOnly && !recipe.isFavorite) return false
        if (canMake && !(cov.missing.length === 0 && cov.total > 0)) return false
        if (tastes.length && !tastes.every((tItem) => recipe.tastes.includes(tItem))) return false
        if (debounced) {
          const hay = [recipe.title, recipe.description, ...recipe.ingredients.map((i) => i.name)]
            .join(' ')
            .toLowerCase()
          if (!hay.includes(debounced)) return false
        }
        return true
      })
  }, [recipes, pantry, debounced, tastes, favOnly, canMake])

  const hasFilters = !!debounced || query !== '' || tastes.length > 0 || favOnly || canMake
  function clear() {
    setQuery('')
    setDebounced('')
    setTastes([])
    setFavOnly(false)
    setCanMake(false)
  }

  return (
    <div className="pb-6">
      <PageHeader
        className="mb-0"
        title={t('Recipes')}
        subtitle={`${recipes.length} saved`}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> {t('Add')}
          </Button>
        }
      />

      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('Search recipes or ingredients')}
          aria-label={t('Search recipes')}
          ref={searchRef}
          className="pl-11"
        />
      </div>

      <div
        className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:px-0"
        role="group"
        aria-label={t('Filters')}
      >
        <Chip
          size="sm"
          tone="secondary"
          selected={canMake}
          onClick={() => setCanMake((v) => !v)}
          className="shrink-0"
        >
          {t('Can make now')}
        </Chip>
        <Chip
          size="sm"
          selected={favOnly}
          onClick={() => setFavOnly((v) => !v)}
          className="shrink-0"
        >
          <Heart className="h-3.5 w-3.5" aria-hidden /> {t('Favorites')}
        </Chip>
        {allTastes.map((tItem) => (
          <Chip
            key={tItem}
            size="sm"
            selected={tastes.includes(tItem)}
            onClick={() =>
              setTastes((cur) =>
                cur.includes(tItem) ? cur.filter((x) => x !== tItem) : [...cur, tItem]
              )
            }
            className="shrink-0"
          >
            {tasteLabels[tItem]}
          </Chip>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {filtered.length === 1 ? t('1 recipe') : `${filtered.length} recipes`}
      </p>
      <div className="mt-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={t('Nothing matches')}
            body={
              hasFilters
                ? t('Try fewer filters, or a different word.')
                : t('Add your first recipe to get going.')
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clear}>
                  {t('Clear filters')}
                </Button>
              ) : (
                <Button onClick={() => router.push('/recipes/new')}>{t('Add a recipe')}</Button>
              )
            }
          />
        ) : (
          <motion.ul
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4"
          >
            <AnimatePresence mode="popLayout" initial>
              {filtered.slice(0, shown).map(({ recipe, cov }, i) => (
                <motion.li
                  key={recipe.id}
                  // Only the first page animates in. Long lists appear at once and stay quick.
                  layout={filtered.length <= PAGE}
                  variants={i < PAGE ? reveal : undefined}
                  custom={i}
                  initial={i < PAGE ? 'hidden' : false}
                  animate="show"
                  exit={i < PAGE ? 'exit' : undefined}
                  className="card group relative overflow-hidden"
                >
                  <Link
                    href={`/recipes/${recipe.id}`}
                    className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <motion.div
                      layoutId={`recipe-image-${recipe.id}`}
                      className="relative aspect-[4/3] overflow-hidden"
                    >
                      <RecipeImage
                        url={recipe.imageUrl}
                        seed={recipe.id}
                        sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
                      />
                    </motion.div>
                    <div className="space-y-1.5 p-3">
                      <h2 className="font-display text-[1.0625rem] font-semibold leading-snug tracking-tight">
                        {recipe.title}
                      </h2>
                      <p className="flex items-center gap-1.5 text-[0.8125rem] text-ink-2">
                        <span>{formatMinutes(recipe.activeMinutes)}</span>
                        <span aria-hidden className="text-ink-3">
                          ·
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span
                            aria-hidden
                            className={cn(
                              'h-2 w-2 rounded-full',
                              cov.missing.length === 0 ? 'bg-secondary' : 'bg-ink-3/60'
                            )}
                          />
                          {t('{have} of {total} at home', { have: cov.have, total: cov.total })}
                        </span>
                      </p>
                      <AvoidBadge recipe={recipe} />
                      {recipe.tastes.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {recipe.tastes.slice(0, 2).map((tItem) => (
                            <Tag key={tItem}>{tasteLabels[tItem]}</Tag>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                  <Button
                    variant="glass"
                    size="icon-sm"
                    className="absolute right-2 top-2"
                    aria-label={
                      recipe.isFavorite
                        ? t('Remove {title} from favorites', { title: recipe.title })
                        : t('Add {title} to favorites', { title: recipe.title })
                    }
                    aria-pressed={recipe.isFavorite}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      toggleFavorite(recipe.id)
                    }}
                  >
                    <Heart
                      className={cn('h-4 w-4', recipe.isFavorite && 'fill-accent text-accent')}
                      aria-hidden
                    />
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
        {filtered.length > shown && (
          <div className="mt-6 flex flex-col items-center gap-1">
            <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
              {t('Show more')}
            </Button>
            <p className="text-sm text-ink-3">
              {t('Showing {shown} of {length}', { shown, length: filtered.length })}
            </p>
          </div>
        )}
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={t('Add a recipe')}>
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="lg"
            className="w-full justify-start"
            onClick={() => router.push('/recipes/new')}
          >
            <PencilLine className="h-5 w-5" aria-hidden /> {t('Type it in')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full justify-start"
            onClick={() => router.push('/recipes/new?tab=link')}
          >
            <Link2 className="h-5 w-5" aria-hidden /> {t('Paste recipe text')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
