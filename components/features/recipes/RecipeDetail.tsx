'use client'

import { t } from '@/lib/i18n'

import { RecipeFacts } from '@/components/features/nutrition/RecipeFacts'
import { agoLabel, historyFor, ratingLabels } from '@/lib/history'
import { formatAmount, withTemperatures } from '@/lib/quantity'
import { useUnits } from '@/lib/useUnits'
import { useEffect, useMemo, useState } from 'react'
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
  Copy,
} from 'lucide-react'
import { copyOfRecipe } from '@/lib/recipeCopy'
import { useStore } from '@/lib/store'
import { loadCookSession } from '@/lib/cookSession'
import { AvoidWarning } from '@/components/features/household/AvoidWarning'
import { withUndo } from '@/lib/undo'
import { cn, addDays, dayLabel, formatMinutes, pluralize, toDateKey } from '@/lib/utils'
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
import { MoreLikeThis } from './MoreLikeThis'

export function RecipeDetail({ id }: { id: string }) {
  const router = useRouter()
  const recipe = useStore((s) => s.recipes.find((r) => r.id === id))
  const pantry = useStore((s) => s.pantry)
  const toggleFavorite = useStore((s) => s.toggleFavorite)
  const addShopItem = useStore((s) => s.addShopItem)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const deleteRecipe = useStore((s) => s.deleteRecipe)
  const addRecipe = useStore((s) => s.addRecipe)
  const cookingFor = useStore((s) => s.settings.cookingFor)
  const units = useUnits()

  const [servings, setServings] = useState<number | null>(null)
  useEffect(() => {
    if (recipe) document.title = t('{title} · Plantry', { title: recipe.title })
  }, [recipe])

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
        title={t("That recipe isn't here")}
        body={t('It may have been deleted, or the link is off.')}
        action={
          <Link
            href="/recipes"
            className="inline-flex h-11 items-center rounded-pill bg-surface-2 px-5 text-[0.9375rem] font-medium hover:bg-line/60"
          >
            {t('Back to recipes')}
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
        ? t('{v0} added. {already} already on your list, amounts updated.', {
            v0: pluralize(added, 'item'),
            already,
          })
        : t('{v0} added to your list', { v0: pluralize(added, 'item') })
    )
  }

  function planFor(date: string, label: string) {
    if (!recipe) return
    setPlanEntry({ date, slot: 'dinner', recipeId: recipe.id, servings: current })
    setPlanOpen(false)
    toast(t('Planned for {label}', { label }))
  }

  function remove() {
    if (!recipe) return
    const id = recipe.id
    router.replace('/recipes')
    withUndo(t('Recipe deleted'), () => deleteRecipe(id))
  }

  return (
    <article className="pb-36 md:pb-28">
      <div className="relative -mx-5 aspect-[4/3] overflow-hidden md:mx-0 md:aspect-[16/9] md:rounded-card">
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
            aria-label={t('Back to recipes')}
            onClick={() => router.push('/recipes')}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
          </Button>
          <Button
            variant="glass"
            size="icon"
            aria-label={t('Favorite')}
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
          {recipe.description && <p className="mt-2 text-base text-ink-2">{recipe.description}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {recipe.tastes.map((tItem) => (
              <Tag key={tItem}>{tasteLabels[tItem]}</Tag>
            ))}
            {recipe.leftovers && <Tag>{t('Leftovers')}</Tag>}
          </div>
          <AvoidWarning recipe={recipe} className="mt-4" />
          <CookedLine recipeId={recipe.id} />
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <Stat icon={Flame} label={t('Active')} value={formatMinutes(recipe.activeMinutes)} />
            <Stat icon={Clock} label={t('Total')} value={formatMinutes(recipe.totalMinutes)} />
            <Stat icon={Users} label={t('Serves')} value={String(recipe.servings)} />
          </dl>
          <div className="mt-4">
            <RecipeFacts recipe={recipe} servings={current} />
          </div>
          {!recipe.custom && (
            <div className="mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const copy = addRecipe(copyOfRecipe(recipe))
                  toast(t('Copy made. Change what you like.'))
                  router.push(`/recipes/new?id=${copy.id}`)
                }}
              >
                <Copy className="h-4 w-4" aria-hidden /> {t('Make my own version')}
              </Button>
            </div>
          )}
          {recipe.custom && (
            <div className="mt-4 flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/recipes/new?id=${recipe.id}`)}
              >
                <Pencil className="h-4 w-4" aria-hidden /> {t('Edit')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden /> {t('Delete')}
              </Button>
            </div>
          )}
        </motion.header>

        <motion.section variants={reveal} custom={1} aria-labelledby="ing-title">
          <SectionTitle
            action={
              <Stepper
                value={current}
                onChange={setServings}
                min={1}
                max={24}
                label={t('Servings')}
              />
            }
          >
            <span id="ing-title">{t('Ingredients')}</span>
          </SectionTitle>
          <p className="-mt-2 mb-3 text-sm text-ink-3">
            {t('For {count}', { count: pluralize(current, 'serving') })}
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
                  <span className="min-w-0 flex-1 break-words">
                    <span className="text-[0.9375rem]">{ing.name}</span>
                    {ing.optional && <span className="text-sm text-ink-3"> {t('(optional)')}</span>}
                    <span className="sr-only">
                      {have ? t(', you have it') : t(', not in your pantry')}
                    </span>
                  </span>
                  {have && (
                    <span aria-hidden className="text-xs font-medium text-secondary">
                      {t('You have it')}
                    </span>
                  )}
                  <span className="shrink-0 text-sm tabular-nums text-ink-2">
                    {formatAmount(ing.quantity * scale, ing.unit, { system: units })}
                  </span>
                </li>
              )
            })}
          </ul>
          {missing.length > 0 && (
            <Button variant="outline" className="mt-3" onClick={addMissing}>
              <ShoppingBasket className="h-4 w-4" aria-hidden />{' '}
              {t('Add missing to list ( {length})', { length: missing.length })}
            </Button>
          )}
        </motion.section>

        <motion.section variants={reveal} custom={2} aria-labelledby="steps-title">
          <SectionTitle>
            <span id="steps-title">{t('Steps')}</span>
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
                  <p className="text-base leading-relaxed">{withTemperatures(step.text, units)}</p>
                  {step.timerMinutes && (
                    <Tag className="mt-2 gap-1">
                      <Timer className="h-3 w-3" aria-hidden />{' '}
                      {t('{timerMinutes} min', { timerMinutes: step.timerMinutes })}
                    </Tag>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {recipe.sourceUrl && /^https?:\/\//i.test(recipe.sourceUrl) && (
            <p className="mt-8 text-sm text-ink-3">
              {t('Saved from')}{' '}
              <a
                href={recipe.sourceUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="font-medium text-ink-2 underline decoration-line underline-offset-4 hover:text-ink"
              >
                {recipe.source || recipe.sourceUrl}
              </a>
            </p>
          )}
        </motion.section>

        <MoreLikeThis recipe={recipe} />
      </motion.div>

      <div
        className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 md:bottom-6"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="glass pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-pill p-2">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            onClick={() => setPlanOpen(true)}
          >
            <CalendarPlus className="h-5 w-5" aria-hidden /> {t('Plan it')}
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
            {resume ? t('Resume at step {v0}', { v0: resume.index + 1 }) : t('Cook')}
          </Button>
        </div>
      </div>

      <Sheet open={planOpen} onClose={() => setPlanOpen(false)} title={t('Plan it for dinner')}>
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

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('Delete this recipe?')}
      >
        <p className="mb-5 text-[0.9375rem] text-ink-2">
          {t(
            '{title} will be removed from your recipes. Any night you planned it for goes back to empty.',
            { title: recipe.title }
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setDeleteOpen(false)}>
            {t('Keep it')}
          </Button>
          <Button variant="danger" className="flex-1" onClick={remove}>
            <Trash2 className="h-4 w-4" aria-hidden /> {t('Delete')}
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

/** "Cooked 3 times, last 5 days ago · Loved it", plus the latest note. */
function CookedLine({ recipeId }: { recipeId: string }) {
  const cooked = useStore((s) => s.cooked)
  const h = useMemo(() => historyFor(recipeId, cooked), [recipeId, cooked])
  if (!h.times || !h.lastDate) return null
  const today = toDateKey(new Date())
  return (
    <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-[0.9375rem]">
      <p className="text-ink-2">
        {t('Cooked')} {h.times === 1 ? 'once' : `${h.times} times`}
        {t(', last {v0}', { v0: agoLabel(h.lastDate, today) })}
        {h.rating ? ` · ${ratingLabels[h.rating]}` : ''}.{' '}
        <Link href="/history" className="font-medium text-ink underline underline-offset-2">
          {t('History')}
        </Link>
      </p>
      {h.note && <p className="mt-1 italic text-ink">“{h.note}”</p>}
    </div>
  )
}
