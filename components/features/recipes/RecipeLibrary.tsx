'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { RecipeImage } from './RecipeImage'
import { allTastes, tasteLabels } from './tastes'

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

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 180)
    return () => clearTimeout(t)
  }, [query])

  const filtered = useMemo(() => {
    return recipes
      .map((recipe) => ({ recipe, cov: coverage(recipe, pantry) }))
      .filter(({ recipe, cov }) => {
        if (favOnly && !recipe.isFavorite) return false
        if (canMake && !(cov.missing.length === 0 && cov.total > 0)) return false
        if (tastes.length && !tastes.every((t) => recipe.tastes.includes(t))) return false
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
      <header className="flex items-end justify-between gap-4 pt-2">
        <div>
          <h1 className="font-display text-fluid-xl font-semibold leading-tight tracking-tight">
            Recipes
          </h1>
          <p className="text-sm text-ink-3">{recipes.length} saved</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden /> Add
        </Button>
      </header>

      <div className="relative mt-5">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes or ingredients"
          aria-label="Search recipes"
          className="pl-11"
        />
      </div>

      <div
        className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0"
        role="group"
        aria-label="Filters"
      >
        <Chip
          size="sm"
          tone="secondary"
          selected={canMake}
          onClick={() => setCanMake((v) => !v)}
          className="shrink-0"
        >
          Can make now
        </Chip>
        <Chip
          size="sm"
          selected={favOnly}
          onClick={() => setFavOnly((v) => !v)}
          className="shrink-0"
        >
          <Heart className="h-3.5 w-3.5" aria-hidden /> Favorites
        </Chip>
        {allTastes.map((t) => (
          <Chip
            key={t}
            size="sm"
            selected={tastes.includes(t)}
            onClick={() =>
              setTastes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))
            }
            className="shrink-0"
          >
            {tasteLabels[t]}
          </Chip>
        ))}
      </div>

      <p className="sr-only" aria-live="polite">
        {filtered.length === 1 ? '1 recipe' : `${filtered.length} recipes`}
      </p>
      <div className="mt-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Nothing matches"
            body={
              hasFilters
                ? 'Try fewer filters, or a different word.'
                : 'Add your first recipe to get going.'
            }
            action={
              hasFilters ? (
                <Button variant="secondary" onClick={clear}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => router.push('/recipes/new')}>Add a recipe</Button>
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
              {filtered.map(({ recipe, cov }, i) => (
                <motion.li
                  key={recipe.id}
                  layout
                  variants={reveal}
                  custom={i}
                  initial="hidden"
                  animate="show"
                  exit="exit"
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
                          {cov.have} of {cov.total}
                        </span>
                      </p>
                      <AvoidBadge recipe={recipe} />
                      {recipe.tastes.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {recipe.tastes.slice(0, 2).map((t) => (
                            <Tag key={t}>{tasteLabels[t]}</Tag>
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
                        ? `Remove ${recipe.title} from favorites`
                        : `Add ${recipe.title} to favorites`
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
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Add a recipe">
        <div className="space-y-2">
          <Button
            variant="secondary"
            size="lg"
            className="w-full justify-start"
            onClick={() => router.push('/recipes/new')}
          >
            <PencilLine className="h-5 w-5" aria-hidden /> Paste or type
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="w-full justify-start"
            onClick={() => router.push('/recipes/new?tab=link')}
          >
            <Link2 className="h-5 w-5" aria-hidden /> Import from a link
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
