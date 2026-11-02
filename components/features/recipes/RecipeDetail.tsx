'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Clock,
  Flame,
  Heart,
  Pencil,
  Trash2,
  Users,
  UtensilsCrossed,
  Timer,
  ShoppingBasket,
  CalendarPlus,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { loadCookSession } from '@/lib/cookSession'
import { withFahrenheit } from '@/lib/safety'
import { AvoidWarning } from '@/components/features/household/AvoidWarning'
import { withUndo } from '@/lib/undo'
import {
  cn,
  addDays,
  dayLabel,
  formatMinutes,
  formatQuantity,
  pluralize,
  toDateKey,
} from '@/lib/utils'
import { reveal, staggerContainer } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { Stepper } from '@/components/ui/Stepper'
import { SectionTitle } from '@/components/ui/Card'
import { toast } from '@/components/ui/Toast'
import { RecipeImage } from './RecipeImage'
import { tasteLabels } from './tastes'

export function RecipeDetail({ id }: { id: string }) {
  const router = useRouter()
  const recipe = useStore((s) => s.recipes.find((r) => r.id === id))
  const pantry = useStore((s) => s.pantry)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const addShopItem = useStore((s) => s.addShopItem)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const deleteRecipe = useStore((s) => s.deleteRecipe)
  const cookingFor = useStore((s) => s.settings.cookingFor)

  const [servings, setServings] = useState<number | null>(null)
  // A cook session for this recipe that was left part-way.
  const [resume] = useState(() => {
    if (typeof window === 'undefined') return undefined
    const s = loadCookSession(id)
    return s && (s.index > 0 || Object.keys(s.timers).length > 0) ? s : undefined
  })
  const [planOpen, setPlanOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const pantryKeys = useMemo(() => new Set(pantry.map((p) => p.key)), [pantry])
  const days = useMemo(() => {
    const today = toDateKey(new Date())
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(today, i)
      return { key, label: dayLabel(key, today) }
    })
  }, [])

  if (!recipe) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="That recipe isn't here"
        body="It may have been deleted, or the link is off."
        action={
          <Link
            href="/recipes"
            className="inline-flex h-11 items-center rounded-pill bg-surface-2 px-5 text-[15px] font-medium hover:bg-line/60"
          >
            Back to recipes
          </Link>
        }
      />
    )
  }

  const current = servings ?? cookingFor ?? recipe.servings
  const scale = current / recipe.servings
  const missing = recipe.ingredients.filter((i) => !i.optional && !pantryKeys.has(i.key))

  function addMissing() {
    if (!recipe) return
    let added = 0
    for (const i of missing) {
      const res = addShopItem(i.name, i.aisle, {
        quantity: i.quantity > 0 ? i.quantity * scale : undefined,
        unit: i.unit,
        recipeId: recipe.id,
      })
      if (res === 'added') added++
    }
    const already = missing.length - added
    toast(
      already
        ? `${pluralize(added, 'item')} added. ${already} already on your list, amounts updated.`
        : `${pluralize(added, 'item')} added to your list`
    )
  }

  function planFor(date: string, label: string) {
    if (!recipe) return
    setPlanEntry({ date, slot: 'dinner', recipeId: recipe.id, servings: current })
    setPlanOpen(false)
    toast(`Planned for ${label}`)
  }

  function remove() {
    if (!recipe) return
    const id = recipe.id
    router.replace('/recipes')
    withUndo('Recipe deleted', () => deleteRecipe(id))
  }

  return (
    <article className="pb-36 lg:pb-28">
      <div className="relative -mx-5 aspect-[4/3] overflow-hidden lg:mx-0 lg:aspect-[16/9] lg:rounded-card">
        <motion.div layoutId={`recipe-image-${recipe.id}`} className="absolute inset-0">
          <RecipeImage
            url={recipe.imageUrl}
            seed={recipe.id}
            sizes="(min-width: 1024px) 800px, 100vw"
            priority
          />
        </motion.div>
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <Button
            variant="glass"
            size="icon"
            aria-label="Back to recipes"
            onClick={() => router.push('/recipes')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Button>
          <Button
            variant="glass"
            size="icon"
            aria-label={recipe.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={recipe.isFavorite}
            onClick={() => toggleFavorite(recipe.id)}
          >
            <Heart
              className={cn('h-5 w-5', recipe.isFavorite && 'fill-accent text-accent')}
              aria-hidden
            />
          </Button>
        </div>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="mx-auto mt-6 max-w-2xl space-y-8"
      >
        <motion.header variants={reveal} custom={0}>
          <h1 className="font-display text-fluid-xl font-semibold leading-tight tracking-tight">
            {recipe.title}
          </h1>
          {recipe.description && (
            <p className="mt-2 text-[16px] text-ink-2">{recipe.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.tastes.map((t) => (
              <Tag key={t}>{tasteLabels[t]}</Tag>
            ))}
            {recipe.leftovers && <Tag>Leftovers</Tag>}
          </div>
          <AvoidWarning recipe={recipe} className="mt-4" />
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <Stat icon={Flame} label="Active" value={formatMinutes(recipe.activeMinutes)} />
            <Stat icon={Clock} label="Total" value={formatMinutes(recipe.totalMinutes)} />
            <Stat icon={Users} label="Serves" value={String(recipe.servings)} />
          </dl>
          {recipe.custom && (
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/recipes/new?id=${recipe.id}`)}
              >
                <Pencil className="h-4 w-4" aria-hidden /> Edit
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden /> Delete
              </Button>
            </div>
          )}
        </motion.header>

        <motion.section variants={reveal} custom={1} aria-labelledby="ing-title">
          <SectionTitle
            action={
              <Stepper value={current} onChange={setServings} min={1} max={24} label="Servings" />
            }
          >
            <span id="ing-title">Ingredients</span>
          </SectionTitle>
          <p className="-mt-2 mb-3 text-sm text-ink-3">
            For {current} {current === 1 ? 'serving' : 'servings'}
          </p>
          <ul className="card divide-y divide-line overflow-hidden">
            {recipe.ingredients.map((ing) => {
              const have = pantryKeys.has(ing.key)
              return (
                <li key={ing.id} className="flex items-center gap-3 px-4 py-3">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                      have ? 'bg-secondary text-secondary-ink' : 'border border-line'
                    )}
                  >
                    {have && <Check className="h-3.5 w-3.5" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-[15px]">{ing.name}</span>
                    {ing.optional && <span className="text-sm text-ink-3"> (optional)</span>}
                    <span className="sr-only">
                      {have ? ', you have it' : ', not in your pantry'}
                    </span>
                  </span>
                  {have && (
                    <span aria-hidden className="text-xs font-medium text-secondary">
                      You have it
                    </span>
                  )}
                  <span className="shrink-0 text-sm tabular-nums text-ink-2">
                    {formatQuantity(ing.quantity * scale, ing.unit)}
                  </span>
                </li>
              )
            })}
          </ul>
          {missing.length > 0 && (
            <Button variant="outline" className="mt-3" onClick={addMissing}>
              <ShoppingBasket className="h-4 w-4" aria-hidden /> Add missing to list (
              {missing.length})
            </Button>
          )}
        </motion.section>

        <motion.section variants={reveal} custom={2} aria-labelledby="steps-title">
          <SectionTitle>
            <span id="steps-title">Steps</span>
          </SectionTitle>
          <ol className="space-y-5">
            {recipe.steps.map((step, i) => (
              <li key={step.id} className="flex gap-4">
                <span
                  className="w-7 shrink-0 font-display text-2xl font-semibold leading-none text-accent"
                  aria-hidden
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] leading-relaxed">{withFahrenheit(step.text)}</p>
                  {step.timerMinutes && (
                    <Tag className="mt-2 gap-1">
                      <Timer className="h-3 w-3" aria-hidden /> {step.timerMinutes} min
                    </Tag>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </motion.section>
      </motion.div>

      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 lg:bottom-6">
        <div className="glass pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-pill p-2">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={() => setPlanOpen(true)}
          >
            <CalendarPlus className="h-5 w-5" aria-hidden /> Plan it
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={() =>
              router.push(
                resume?.date
                  ? `/cook/${recipe.id}?date=${resume.date}`
                  : `/cook/${recipe.id}?servings=${current}`
              )
            }
          >
            {resume ? `Resume at step ${resume.index + 1}` : 'Cook'}
          </Button>
        </div>
      </div>

      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title="Plan it for dinner">
        <ul className="space-y-1">
          {days.map((d) => (
            <li key={d.key}>
              <Button
                variant="ghost"
                className="h-12 w-full justify-start text-base"
                onClick={() => planFor(d.key, d.label)}
              >
                {d.label}
              </Button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete this recipe?">
        <p className="mb-5 text-[15px] text-ink-2">
          {recipe.title} will be removed from your recipes. Any night you planned it for goes back
          to empty.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)}>
            Keep it
          </Button>
          <Button variant="danger" className="flex-1" onClick={remove}>
            <Trash2 className="h-4 w-4" aria-hidden /> Delete
          </Button>
        </div>
      </Sheet>
    </article>
  )
}

function Stat({ icon: Icon, label, value }: { icon: typeof Clock; label: string; value: string }) {
  return (
    <div className="card px-3 py-3">
      <dt className="flex items-center gap-1.5 text-xs font-medium text-ink-3">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {label}
      </dt>
      <dd className="mt-1 font-display text-lg font-semibold">{value}</dd>
    </div>
  )
}
