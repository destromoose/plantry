'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Clock, HandHeart, Lock, RefreshCw, Users, UtensilsCrossed } from 'lucide-react'
import { useStore } from '@/lib/store'
import { pickNext, coverage, type Scored } from '@/lib/suggest'
import type { Energy, PlanEntry, Recipe } from '@/lib/types'
import { daysBetween, formatMinutes, cn } from '@/lib/utils'
import { drift, settle } from '@/lib/motion'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { Eyebrow } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { EmptyState } from '@/components/ui/EmptyState'
import { toast } from '@/components/ui/Toast'
import { Thumb } from '@/components/features/week/Thumb'
import { HandoffSheet, SaveSheet } from './TonightSheets'

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
        <p className="mt-1 text-[15px] text-ink-2">Dinner is handled. Nothing to wash.</p>
        <Button
          variant="secondary"
          className="mt-5"
          onClick={() => clearPlanEntry(targetDate, 'dinner')}
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
          <p className="mt-1 text-[15px] text-ink-2">Already cooked. Heat, plate, done.</p>
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
            enter: { opacity: 0, scale: 0.96, y: 10 },
            center: { opacity: 1, scale: 1, y: 0, x: 0, rotate: 0, transition: drift },
            exit: (d: number) => ({ x: d * 380, rotate: d * 10, opacity: 0, transition: drift }),
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
            if (Math.abs(info.offset.x) > 100) shuffle(info.offset.x > 0 ? 1 : -1)
          }}
          onClickCapture={(e) => {
            if (moved.current) {
              e.preventDefault()
              e.stopPropagation()
            }
          }}
        >
          <PlannedOrSuggested
            recipe={scored.recipe}
            scored={scored}
            onShuffle={() => shuffle(1)}
            {...props}
          />
        </motion.div>
      </AnimatePresence>
      <p className="mt-3 text-center text-xs text-ink-3">Swipe the card to shuffle</p>
      <span className="sr-only" aria-live="polite">
        Showing {scored.recipe.title}
      </span>
      <span className="hidden">{targetDate}</span>
    </div>
  )
}

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

  function lockIn() {
    setPlanEntry({ date: targetDate, slot: 'dinner', recipeId: recipe.id, cookId: entry?.cookId })
    setSeen([])
    toast("Tonight's handled.")
  }

  return (
    <article className="card overflow-hidden">
      <Link
        href={`/recipes/${recipe.id}`}
        className="relative block aspect-[4/3] max-h-[420px] w-full bg-surface-2 sm:aspect-[16/9]"
        aria-label={`Open ${recipe.title}`}
        draggable={false}
      >
        <motion.div
          layoutId={`recipe-image-${recipe.id}`}
          transition={settle}
          className="absolute inset-0"
        >
          {recipe.imageUrl && (
            <Image
              src={recipe.imageUrl}
              alt=""
              fill
              priority
              sizes="(min-width: 768px) 700px, 100vw"
              className="object-cover"
              draggable={false}
            />
          )}
        </motion.div>
      </Link>
      <div className="p-5 sm:p-6">
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
                <Users className="h-4 w-4" aria-hidden /> Serves {recipe.servings}
              </span>
            </p>
          </div>
          <ProgressRing
            value={cov.total ? cov.have / cov.total : 0}
            size={48}
            stroke={5}
            tone={cov.missing.length === 0 ? 'secondary' : 'accent'}
          >
            <span className="font-display text-sm font-semibold">{cov.have}</span>
          </ProgressRing>
        </div>

        <p className="mt-3 text-[15px]">
          <span className="font-medium">
            You have {cov.have} of {cov.total}.
          </span>{' '}
          <span className="text-ink-2">{coverLine}.</span>
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

        {planned && cook && <p className="mt-2 text-sm text-ink-3">{cook.name} is cooking.</p>}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {planned ? (
            <Link
              href={`/cook/${recipe.id}?date=${targetDate}`}
              className={buttonVariants({ variant: 'primary', size: 'lg' })}
            >
              Cook <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <Button size="lg" onClick={lockIn}>
              <Lock className="h-4 w-4" aria-hidden /> Lock it in
            </Button>
          )}
          {!planned && (
            <Button variant="secondary" size="lg" onClick={onShuffle}>
              <RefreshCw className="h-4 w-4" aria-hidden /> Shuffle
            </Button>
          )}
          <Button variant="ghost" onClick={() => setHandoff(true)}>
            <HandHeart className="h-4 w-4" aria-hidden /> Hand off
          </Button>
          {planned ? (
            <Button variant="ghost" onClick={() => clearPlanEntry(targetDate, 'dinner')}>
              Not feeling it
            </Button>
          ) : (
            <Button variant="ghost" onClick={() => setSave(true)}>
              Save for another night
            </Button>
          )}
        </div>
      </div>

      <HandoffSheet
        open={handoff}
        onClose={() => setHandoff(false)}
        recipe={recipe}
        date={targetDate}
        onBeforeHandoff={() => {
          if (!planned) lockIn()
        }}
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
      <p className="mt-1 text-[15px] text-ink-2">Pick whichever takes the least from you.</p>

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
                    toast("Tonight's handled.")
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
            <span className="block font-medium">Order in, no guilt</span>
            <span className="block text-sm text-ink-2">We&apos;ll mark tonight as takeout.</span>
          </span>
        </button>
      </div>
    </section>
  )
}
