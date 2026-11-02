'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useIsPresent } from 'framer-motion'
import {
  ArrowRight,
  Clock,
  HandHeart,
  Lock,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Users,
  UtensilsCrossed,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { AvoidWarning } from '@/components/features/household/AvoidWarning'
import { withUndo } from '@/lib/undo'
import { pickNext, coverage, type Scored } from '@/lib/suggest'
import type { Energy, PlanEntry, Recipe } from '@/lib/types'
import { daysBetween, formatMinutes, cn } from '@/lib/utils'
import { drift, settle } from '@/lib/motion'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { Eyebrow } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { Thumb } from '@/components/features/week/Thumb'
import { HandoffSheet, SaveSheet } from './TonightSheets'
import { RecipeImage } from '@/components/features/recipes/RecipeImage'

interface HeroProps {
  ranked: Scored[]
  entry?: PlanEntry
  energy?: Energy
  targetDate: string
  today: string
  reason: string
}

export function TonightHero(props: HeroProps) {
  const { ranked, entry, energy, targetDate, today } = props
  const recipes = useStore((s) => s.recipes)
  const clearPlanEntry = useStore((s) => s.clearPlanEntry)
  const setEnergy = useStore((s) => s.setEnergy)

  const planned = entry?.recipeId ? recipes.find((r) => r.id === entry.recipeId) : undefined
  const leftoverOf = entry?.leftoversOf
    ? recipes.find((r) => r.id === entry.leftoversOf)
    : undefined

  if (recipes.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="No recipes yet"
        body="Add a recipe and Plantry can start deciding for you."
        action={
          <Link href="/recipes" className={buttonVariants({ variant: 'primary' })}>
            Open recipes
          </Link>
        }
      />
    )
  }

  if (entry?.note && !planned && !leftoverOf) {
    return (
      <div className="card p-6">
        <Eyebrow>Decided</Eyebrow>
        <h2 className="mt-1 font-display text-fluid-xl font-semibold">{entry.note}</h2>
        <p className="mt-1 text-[0.9375rem] text-ink-2">Dinner is handled. Nothing to wash.</p>
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => {
            // Also move off "Can't tonight", or the takeout option just comes back.
            clearPlanEntry(targetDate, 'dinner')
            setEnergy(targetDate, 'quick')
          }}
        >
          Pick something to cook instead
        </Button>
      </div>
    )
  }

  if (leftoverOf) {
    return (
      <div className="card flex flex-col gap-4 bg-surface-2 p-5 sm:flex-row sm:items-center">
        <Link
          href={`/recipes/${leftoverOf.id}`}
          className="block"
          aria-label={`Open ${leftoverOf.title}`}
        >
          <Thumb
            src={leftoverOf.imageUrl}
            sizes="160px"
            className="h-28 w-full rounded-2xl sm:w-40"
          />
        </Link>
        <div className="flex-1">
          <Eyebrow>Calm night</Eyebrow>
          <h2 className="mt-1 font-display text-fluid-xl font-semibold leading-tight">
            Leftovers: {leftoverOf.title}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-ink-2">Already cooked. Heat, plate, done.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => clearPlanEntry(targetDate, 'dinner')}>
              Cook something else
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (planned) {
    return <PlannedOrSuggested recipe={planned} planned entry={entry} {...props} />
  }

  if (energy === 'cant-tonight')
    return <CantTonight ranked={ranked} targetDate={targetDate} today={today} />

  if (ranked.length === 0) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="Nothing fits tonight"
        body="Try a different energy level."
      />
    )
  }
  return <Deck {...props} />
}

/* ------------------------------------------------------------------ */

function Deck(props: HeroProps) {
  const { ranked, targetDate } = props
  const seen = useStore((s) => s.shuffleSeen)
  const setSeen = useStore((s) => s.setShuffleSeen)
  const [shownId, setShownId] = useState<string | undefined>()
  const [dir, setDir] = useState(1)
  const moved = useRef(false)

  const scored = ranked.find((r) => r.recipe.id === shownId) ?? ranked[0]

  function shuffle(direction = 1) {
    if (ranked.length < 2) {
      toast('That is the only one that fits tonight')
      return
    }
    let nextSeen = seen.includes(scored.recipe.id) ? seen : [...seen, scored.recipe.id]
    if (nextSeen.length >= ranked.length) nextSeen = [scored.recipe.id]
    const next = pickNext(ranked, nextSeen)
    setDir(direction)
    setSeen(nextSeen)
    setShownId(
      next && next.recipe.id !== scored.recipe.id
        ? next.recipe.id
        : ranked.find((r) => r.recipe.id !== scored.recipe.id)?.recipe.id
    )
  }

  return (
    <div className="relative">
      <AnimatePresence mode="popLayout" initial={false} custom={dir}>
        <motion.div
          key={scored.recipe.id}
          custom={dir}
          variants={{
            enter: { opacity: 0, scale: 0.97, y: 8 },
            center: { opacity: 1, scale: 1, y: 0, x: 0, rotate: 0, transition: quickDeal },
            exit: (d: number) => ({
              x: d * 320,
              rotate: d * 8,
              opacity: 0,
              transition: { duration: 0.18, ease: 'easeIn' },
            }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          drag="x"
          dragSnapToOrigin
          dragElastic={0.5}
          onDragStart={() => (moved.current = true)}
          onDragEnd={(_, info) => {
            setTimeout(() => (moved.current = false), 0)
            if (
              Math.abs(info.offset.x) > 140 &&
              Math.abs(info.offset.x) > Math.abs(info.offset.y) * 1.5
            )
              shuffle(info.offset.x > 0 ? 1 : -1)
          }}
          onClickCapture={(e) => {
            if (moved.current) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          <WhilePresent>
            <PlannedOrSuggested
              recipe={scored.recipe}
              scored={scored}
              onShuffle={() => shuffle(1)}
              {...props}
            />
          </WhilePresent>
        </motion.div>
      </AnimatePresence>
      <p className="mt-3 text-center text-sm text-ink-2">Swipe the card sideways to shuffle</p>
      <span className="sr-only" aria-live="polite">
        Showing {scored.recipe.title}
      </span>
      <span className="hidden">{targetDate}</span>
    </div>
  )
}

/** The card leaving the screen can't be tapped or read out, so there is only ever one set of buttons. */
function WhilePresent({ children }: { children: React.ReactNode }) {
  const present = useIsPresent()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.toggleAttribute('inert', !present)
  }, [present])
  return (
    <div ref={ref} aria-hidden={present ? undefined : true}>
      {children}
    </div>
  )
}

const quickDeal = { type: 'spring', stiffness: 380, damping: 32 } as const

/* ------------------------------------------------------------------ */

function PlannedOrSuggested({
  recipe,
  scored,
  planned,
  entry,
  targetDate,
  today,
  reason,
  onShuffle,
}: HeroProps & { recipe: Recipe; scored?: Scored; planned?: boolean; onShuffle?: () => void }) {
  const pantry = useStore((s) => s.pantry)
  const members = useStore((s) => s.members)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const clearPlanEntry = useStore((s) => s.clearPlanEntry)
  const setSeen = useStore((s) => s.setShuffleSeen)
  const [handoff, setHandoff] = useState(false)
  const [save, setSave] = useState(false)
  const [more, setMore] = useState(false)
  const addShopItem = useStore((s) => s.addShopItem)
  const seen = useStore((s) => s.shuffleSeen)
  const missingIngs = recipe.ingredients.filter(
    (i) => !i.optional && !pantry.some((p) => p.key === i.key)
  )
  function addMissing() {
    let added = 0
    for (const i of missingIngs)
      if (
        addShopItem(i.name, i.aisle, {
          quantity: i.quantity || undefined,
          unit: i.unit,
          recipeId: recipe.id,
        }) === 'added'
      )
        added++
    toast(added ? `${added} added to your list` : 'Already on your list')
  }

  const cov = coverage(recipe, pantry)
  const coverLine =
    cov.missing.length === 0
      ? 'You have everything'
      : cov.missing.length <= 2
        ? `Only missing ${cov.missing.join(' and ')}`
        : `Missing ${cov.missing.length} things`
  const tags = (scored?.reasons ?? []).filter(
    (r) => !r.startsWith('Only missing') && r !== 'You have everything'
  )
  const cook = members.find((m) => m.id === entry?.cookId)
  const cookingFor = useStore((s) => s.settings.cookingFor)
  const handoffs = useStore((s) => s.handoffs)
  const note = handoffs.find((h) => h.date === targetDate)
  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? 'Someone'
  const canHandOff = members.filter((m) => m.cooks !== false).length > 1

  function lockIn() {
    setPlanEntry({ date: targetDate, slot: 'dinner', recipeId: recipe.id, cookId: entry?.cookId })
    setSeen([])
    toast(targetDate === today ? 'Planned for tonight' : 'Planned for tomorrow')
  }

  return (
    <article className="card overflow-hidden lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Link
        href={`/recipes/${recipe.id}`}
        className="relative block aspect-[16/9] max-h-[32vh] w-full bg-surface-2 sm:max-h-[420px] lg:aspect-auto lg:h-full lg:max-h-none lg:min-h-[340px]"
        aria-hidden
        tabIndex={-1}
        draggable={false}
      >
        <motion.div
          layoutId={`recipe-image-${recipe.id}`}
          transition={settle}
          className="absolute inset-0"
        >
          <RecipeImage
            url={recipe.imageUrl}
            seed={recipe.title}
            priority
            sizes="(min-width: 1024px) 560px, (min-width: 768px) 700px, 100vw"
          />
        </motion.div>
      </Link>
      <div className="p-5 sm:p-6 lg:flex lg:flex-col lg:justify-center lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/recipes/${recipe.id}`} draggable={false}>
              <h2 className="font-display text-fluid-xl font-semibold leading-tight tracking-tight">
                {recipe.title}
              </h2>
            </Link>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-4 w-4" aria-hidden /> {formatMinutes(recipe.activeMinutes)}{' '}
                hands-on
              </span>
              <span className="inline-flex items-center gap-1">
                <Users className="h-4 w-4" aria-hidden /> For{' '}
                {(entry?.recipeId === recipe.id && entry.servings) || cookingFor}
              </span>
            </p>
            <AvoidWarning recipe={recipe} className="mt-3" />
          </div>
          <ProgressRing
            value={cov.total ? cov.have / cov.total : 0}
            size={48}
            stroke={5}
            tone={cov.missing.length === 0 ? 'secondary' : 'accent'}
            label={`${cov.have} of ${cov.total} ingredients at home`}
          >
            <span className="font-display text-sm font-semibold" aria-hidden>
              {cov.have}/{cov.total}
            </span>
          </ProgressRing>
        </div>

        <p className="mt-3 text-[0.9375rem]">
          <span className="font-medium">
            You have {cov.have} of {cov.total}.
          </span>{' '}
          <span className="text-ink-2">{coverLine}.</span>
          {missingIngs.length > 0 && (
            <Button variant="ghost" size="sm" className="ml-1 text-accent" onClick={addMissing}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add {missingIngs.length} to list
            </Button>
          )}
        </p>

        {tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Why this one">
            {tags.map((t) => (
              <li key={t}>
                <Tag>{t}</Tag>
              </li>
            ))}
          </ul>
        )}

        {note ? (
          <div className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-[0.9375rem]">
            <p className="font-medium">
              {memberName(note.toId)} is cooking{note.recipeId ? '' : ' and picks what to make'}.
            </p>
            {note.message && (
              <p className="mt-0.5 text-ink-2">
                {memberName(note.fromId)} says: &ldquo;{note.message}&rdquo;
              </p>
            )}
          </div>
        ) : (
          planned && cook && <p className="mt-2 text-sm text-ink-3">{cook.name} is cooking.</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {planned ? (
            <Link
              href={`/cook/${recipe.id}?date=${targetDate}`}
              className={buttonVariants({ variant: 'primary', size: 'lg' })}
            >
              Start cooking <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <Button size="lg" onClick={lockIn}>
              <Lock className="h-4 w-4" aria-hidden /> Cook this{' '}
              {targetDate === today ? 'tonight' : 'tomorrow'}
            </Button>
          )}
          {!planned && (
            <Button variant="secondary" size="lg" onClick={onShuffle}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Shuffle
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            aria-label="More options"
            className="ml-auto"
            onClick={() => setMore(true)}
          >
            <MoreHorizontal className="h-5 w-5" aria-hidden />
          </Button>
        </div>
      </div>

      <Sheet open={more} onClose={() => setMore(false)} title={recipe.title}>
        <div className="flex flex-col gap-2">
          {canHandOff && (
            <Button
              variant="secondary"
              onClick={() => {
                setMore(false)
                setHandoff(true)
              }}
            >
              <HandHeart className="h-4 w-4" aria-hidden /> Ask someone else to cook
            </Button>
          )}
          {planned ? (
            <Button
              variant="secondary"
              onClick={() => {
                setMore(false)
                // Don't offer the same dish again straight away.
                setSeen([...seen, recipe.id])
                withUndo('Cleared tonight. Pick another.', () =>
                  clearPlanEntry(targetDate, 'dinner')
                )
              }}
            >
              Not feeling it
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setMore(false)
                setSave(true)
              }}
            >
              Save for another night
            </Button>
          )}
          <Link
            href={`/recipes/${recipe.id}`}
            className={buttonVariants({ variant: 'ghost' })}
            onClick={() => setMore(false)}
          >
            Open the recipe
          </Link>
        </div>
      </Sheet>

      <HandoffSheet
        open={handoff}
        onClose={() => setHandoff(false)}
        recipe={recipe}
        date={targetDate}
        planned={planned}
        when={targetDate === today ? 'tonight' : 'tomorrow'}
      />
      {!planned && (
        <SaveSheet
          open={save}
          onClose={() => setSave(false)}
          recipe={recipe}
          targetDate={targetDate}
          today={today}
          onSaved={() => onShuffle?.()}
        />
      )}
    </article>
  )
}

/* ------------------------------------------------------------------ */

function CantTonight({
  ranked,
  targetDate,
  today,
}: {
  ranked: Scored[]
  targetDate: string
  today: string
}) {
  const recipes = useStore((s) => s.recipes)
  const cooked = useStore((s) => s.cooked)
  const setPlanEntry = useStore((s) => s.setPlanEntry)

  const leftoverRecipe = cooked
    .filter((c) => daysBetween(c.date, today) >= 0 && daysBetween(c.date, today) <= 2)
    .map((c) => recipes.find((r) => r.id === c.recipeId))
    .find((r) => r?.leftovers)
  const easy = ranked.filter((r) => r.recipe.activeMinutes <= 15).slice(0, 2)

  return (
    <section className="card p-6" aria-labelledby="easy-way">
      <Eyebrow>Can&apos;t tonight</Eyebrow>
      <h2 id="easy-way" className="mt-1 font-display text-fluid-xl font-semibold leading-tight">
        Fair. Here&apos;s the easy way out.
      </h2>
      <p className="mt-1 text-[0.9375rem] text-ink-2">Pick whichever takes the least from you.</p>

      <div className="mt-5 space-y-3">
        {leftoverRecipe && (
          <button
            type="button"
            onClick={() => {
              setPlanEntry({ date: targetDate, slot: 'dinner', leftoversOf: leftoverRecipe.id })
              toast('Leftovers it is')
            }}
            className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-3 text-left hover:border-ink-3"
          >
            <Thumb src={leftoverRecipe.imageUrl} className="h-12 w-12 rounded-xl" sizes="48px" />
            <span>
              <span className="block font-medium">Leftovers</span>
              <span className="block text-sm text-ink-2">{leftoverRecipe.title}, already made</span>
            </span>
          </button>
        )}

        {easy.length > 0 && (
          <ul className="grid gap-2 sm:grid-cols-2">
            {easy.map(({ recipe }) => (
              <li key={recipe.id}>
                <button
                  type="button"
                  onClick={() => {
                    setPlanEntry({ date: targetDate, slot: 'dinner', recipeId: recipe.id })
                    toast('Planned')
                  }}
                  className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left hover:border-ink-3"
                >
                  <Thumb src={recipe.imageUrl} className="h-12 w-12 rounded-xl" sizes="48px" />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{recipe.title}</span>
                    <span className="block text-sm text-ink-2">
                      {formatMinutes(recipe.activeMinutes)} hands-on
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={() => {
            setPlanEntry({ date: targetDate, slot: 'dinner', note: 'Takeout' })
            toast('Takeout, sorted')
          }}
          className={cn(
            'flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-dashed border-ink-3 p-3 text-left hover:bg-surface-2'
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-2">
            <UtensilsCrossed className="h-5 w-5 text-ink-2" aria-hidden />
          </span>
          <span>
            <span className="block font-medium">Order in tonight</span>
            <span className="block text-sm text-ink-2">We&apos;ll mark tonight as takeout.</span>
          </span>
        </button>
      </div>
    </section>
  )
}
