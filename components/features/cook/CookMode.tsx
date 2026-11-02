'use client'

import { t } from '@/lib/i18n'

import { formatAmount, withTemperatures } from '@/lib/quantity'
import { useUnits } from '@/lib/useUnits'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ListChecks,
  ShieldAlert,
  Timer,
  UtensilsCrossed,
  X,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { announce as say } from '@/lib/announce'
import { addDays, toDateKey } from '@/lib/utils'
import { clearCookSession, loadCookSession, saveCookSession } from '@/lib/cookSession'
import { cautionsFor, needsGrownUp } from '@/lib/safety'
import { ingredientsInStep } from '@/lib/stepIngredients'
import { withUndo } from '@/lib/undo'
import { AvoidWarning } from '@/components/features/household/AvoidWarning'
import { Stepper } from '@/components/ui/Stepper'
import { useTapGuard } from '@/lib/useTapGuard'
import { cn, pluralize } from '@/lib/utils'
import { checkPop, settle } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Eyebrow } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { StepTimer, formatClock } from './StepTimer'
import { Toggle } from './Toggle'
import { RatingPicker } from '@/components/features/history/RatingPicker'
import { Input } from '@/components/ui/Field'
import type { Rating } from '@/lib/types'
import { remainingOf, useTimers } from './useTimers'

/** A short name for a step's timer: "Simmer the sauce" rather than "Step 3". */
function stepName(text: string) {
  const skip = new Set([
    'the',
    'a',
    'an',
    'some',
    'your',
    'in',
    'of',
    'and',
    'with',
    'to',
    'chopped',
    'sliced',
    'diced',
    'grated',
    'minced',
    'large',
    'small',
    'all',
  ])
  const words = text
    .replace(/[.,;:!].*$/, '')
    .split(/\s+/)
    .filter((w) => w && !skip.has(w.toLowerCase()))
  const name = words.slice(0, 2).join(' ')
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : t('Timer')
}

function StepCautions({ text, own, kids }: { text: string; own?: string; kids: boolean }) {
  const list = cautionsFor(text, own)
  if (!list.length) return null
  return (
    <ul className="space-y-1.5 pt-1">
      {list.map((c) => (
        <li key={c.kind} className="flex items-start gap-2 text-[0.9375rem] text-ink-2">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <span>{c.note}</span>
        </li>
      ))}
      {kids && needsGrownUp(list) && (
        <li className="pl-6 text-[0.9375rem] font-medium text-ink">
          {t('New to this? Ask a grown-up to help with this step.')}
        </li>
      )}
    </ul>
  )
}

const slide = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
}

export function CookMode({
  id,
  date,
  servings: servingsParam,
}: {
  id: string
  date?: string
  servings?: number
}) {
  const router = useRouter()
  const recipe = useStore((s) => s.recipes.find((r) => r.id === id))
  const entry = useStore((s) =>
    date ? s.plan.find((p) => p.date === date && p.slot === 'dinner') : undefined
  )
  const markCooked = useStore((s) => s.markCooked)
  const cookingFor = useStore((s) => s.settings.cookingFor)
  const units = useUnits()
  const setPlanServings = useStore((s) => s.setServings)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const kids = useStore((s) => s.settings.cookingWithKids)
  const tomorrowEntry = useStore((s) =>
    s.plan.find((p) => p.date === addDays(date ?? toDateKey(new Date()), 1) && p.slot === 'dinner')
  )
  const tomorrowTitle = useStore((s) =>
    tomorrowEntry?.recipeId
      ? s.recipes.find((r) => r.id === tomorrowEntry.recipeId)?.title
      : tomorrowEntry?.note
  )
  // Pick up where you left off: same recipe and same night, within 12 hours.
  const [saved] = useState(() => {
    const s = loadCookSession(id)
    return s && s.date === date ? s : undefined
  })
  const [people, setPeople] = useState<number | null>(saved?.servings ?? null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [awake, setAwake] = useState(false)

  // The recipe may have fewer steps than when the session was saved.
  const [index, setIndex] = useState(() =>
    Math.max(0, Math.min(saved?.index ?? 0, (recipe?.steps.length ?? 1) - 1))
  )
  const [dir, setDir] = useState(1)
  const [ingOpen, setIngOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const finishing = useRef(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [usePantry, setUsePantry] = useState(true)
  const [leftovers, setLeftovers] = useState(recipe?.leftovers ?? false)
  const [rating, setRating] = useState<Rating | undefined>()
  const [note, setNote] = useState('')
  const steps = useMemo(() => recipe?.steps ?? [], [recipe])
  const { timers, now, start, pause, reset, announce } = useTimers(saved?.timers ?? {}, (sid) =>
    stepName(steps.find((s) => s.id === sid)?.text ?? '')
  )
  const last = steps.length - 1
  const step = steps[index]
  // One servings number, in order: changed here, passed from the recipe page, the plan, the household.
  const count = recipe
    ? (people ?? servingsParam ?? entry?.servings ?? cookingFor ?? recipe.servings)
    : 1
  const scale = recipe ? count / recipe.servings : 1
  const sheetOpen = ingOpen || finishOpen || leaveOpen

  const go = useCallback(
    (to: number) => {
      setIndex((cur) => {
        const next = Math.max(0, Math.min(last, to))
        if (next !== cur) setDir(next > cur ? 1 : -1)
        return next
      })
    },
    [last]
  )
  const nextRaw = useCallback(() => {
    if (index >= last) setFinishOpen(true)
    else go(index + 1)
  }, [index, last, go])
  const prevRaw = useCallback(() => go(index - 1), [index, go])
  // A quick double tap moves one step, not two.
  const next = useTapGuard(nextRaw)
  const prev = useTapGuard(prevRaw)

  // Keyboard. Escape leaves, asking first if a timer is running.
  const escRef = useRef<() => void>(() => {})
  useEffect(() => {
    if (sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Escape') {
        e.preventDefault()
        escRef.current()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        next()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prev()
      } else if (e.key === ' ' && tag !== 'BUTTON' && tag !== 'A') {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sheetOpen, next, prev])

  // Keep the screen awake
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    let cancelled = false
    const acquire = async () => {
      try {
        const l = await navigator.wakeLock?.request('screen')
        if (!l) return
        if (cancelled) void l.release().catch(() => {})
        else {
          lock = l
          setAwake(true)
          l.addEventListener?.('release', () => setAwake(false))
        }
      } catch {
        /* not supported or denied */
      }
    }
    void acquire()
    const onVis = () => {
      if (document.visibilityState === 'visible') void acquire()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVis)
      try {
        void lock?.release().catch(() => {})
      } catch {
        /* ignore */
      }
    }
  }, [])

  const anyRunning = Object.values(timers).some((tItem) => tItem.endsAt !== null)

  useEffect(() => {
    if (recipe) document.title = t('Cooking {title} · Plantry', { title: recipe.title })
  }, [recipe])

  // Read the new step out when it changes.
  const firstStep = useRef(true)
  useEffect(() => {
    if (firstStep.current) {
      firstStep.current = false
      return
    }
    const s = steps[index]
    if (s)
      say(t('Step {v0} of {length}. {text}', { v0: index + 1, length: steps.length, text: s.text }))
  }, [index, steps])

  // Save the place and timers so a reload, a locked phone or a closed tab can resume.
  useEffect(() => {
    if (!recipe || finishing.current) return
    saveCookSession({ recipeId: recipe.id, date, index, servings: people ?? undefined, timers })
  }, [recipe, date, index, people, timers])

  // Warn before closing the tab while a timer runs.
  useEffect(() => {
    if (!anyRunning) return
    const onLeave = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [anyRunning])

  const activeTimers = useMemo(() => {
    return steps.map((s, i) => ({ s, i, t: timers[s.id] })).filter((x) => !!x.t)
  }, [steps, timers])

  if (!recipe || steps.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center px-5">
        <EmptyState
          icon={UtensilsCrossed}
          title={recipe ? t('No steps yet') : t("That recipe isn't here")}
          body={
            recipe
              ? t('Add some steps to cook along.')
              : t('It may have been deleted, or the link is off.')
          }
          action={
            <Link
              href={recipe ? `/recipes/${recipe.id}` : '/recipes'}
              className="inline-flex h-11 items-center rounded-pill bg-surface-2 px-5 text-[0.9375rem] font-medium hover:bg-line/60"
            >
              {recipe ? t('Back to the recipe') : t('Back to recipes')}
            </Link>
          }
        />
      </div>
    )
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    // A clear sideways swipe only, so a slip while reading doesn't change the step.
    if (Math.abs(info.offset.x) < Math.abs(info.offset.y) * 1.5) return
    if (info.offset.x < -120 || (info.offset.x < -60 && info.velocity.x < -800)) next()
    else if (info.offset.x > 120 || (info.offset.x > 60 && info.velocity.x > 800)) prev()
  }

  const alreadyDone = !!entry?.done
  const swapTomorrow = leftovers && !!tomorrowTitle

  function close() {
    // Go back to where you came from; the recipe page if there is nowhere to go back to.
    if (window.history.length > 1) router.back()
    else router.push(date ? `/` : `/recipes/${recipe!.id}`)
  }

  escRef.current = () => (anyRunning ? setLeaveOpen(true) : close())

  function finish() {
    if (!recipe || finishing.current) return
    finishing.current = true
    clearCookSession()
    if (alreadyDone) {
      router.push('/')
      return
    }
    if (!date || !entry) {
      // Cooked without a plan: log it as tonight's dinner so history and the pantry stay right.
      const today = toDateKey(new Date())
      const tonight = useStore.getState().plan.find((p) => p.date === today && p.slot === 'dinner')
      if (tonight?.done) {
        // Tonight is already logged. Don't overwrite it or use the pantry twice.
        toast(t('Nice work. Tonight was already logged, so nothing changed.'))
        router.push('/')
        return
      }
      const replacing =
        tonight?.recipeId && tonight.recipeId !== recipe.id
          ? useStore.getState().recipes.find((r) => r.id === tonight.recipeId)?.title
          : undefined
      withUndo(
        replacing
          ? t("Logged as tonight's dinner instead of {replacing}.", { replacing })
          : t("Logged as tonight's dinner. Nice work."),
        () => {
          if (tonight?.recipeId !== recipe.id)
            setPlanEntry({
              date: today,
              slot: 'dinner',
              recipeId: recipe.id,
              servings: count,
              cookId: tonight?.cookId,
            })
          markCooked(today, {
            usePantry,
            leftovers,
            replaceTomorrow: swapTomorrow,
            rating,
            note,
          })
        }
      )
      router.push('/')
      return
    }
    if (date && entry) {
      const before = useStore.getState().pantry.length
      withUndo(t('Nice work.'), () =>
        markCooked(date, { usePantry, leftovers, replaceTomorrow: swapTomorrow, rating, note })
      )
      const used = before - useStore.getState().pantry.length
      if (used > 0) toast(t('{v0} used up from your pantry.', { v0: pluralize(used, 'thing') }))
      router.push('/')
    } else {
      router.push(`/recipes/${recipe.id}`)
    }
  }

  const isLast = index === last

  return (
    <div className="relative mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-5">
      <header className="pt-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('Close cook mode')}
            onClick={() => (anyRunning ? setLeaveOpen(true) : close())}
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-center text-sm font-medium text-ink-2">
            {recipe.title}
          </h1>
          <div className="w-11" aria-hidden />
        </div>
        {awake && <p className="mt-1 text-center text-xs text-ink-3">{t('Screen stays on')}</p>}
        <p className="sr-only" role="status" aria-live="polite">
          {announce}
        </p>
        <div
          className="mt-3 flex gap-1.5"
          role="progressbar"
          aria-label={t('Progress')}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-valuetext={t('Step {v0} of {length}', { v0: index + 1, length: steps.length })}
        >
          {steps.map((s, i) => (
            <div key={s.id} className="h-1.5 flex-1 overflow-hidden rounded-pill bg-line">
              <motion.div
                className="h-full origin-left rounded-pill bg-accent"
                initial={false}
                animate={{ scaleX: i <= index ? 1 : 0 }}
                transition={settle}
              />
            </div>
          ))}
        </div>
        <div className="mt-3 flex min-h-9 flex-wrap justify-center gap-2">
          <AnimatePresence initial={false}>
            {activeTimers.map(({ s, i, t: tItem }) => (
              <motion.button
                key={s.id}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={settle}
                onClick={() => {
                  if (tItem.finished) reset(s.id)
                  go(i)
                }}
                aria-label={
                  tItem.finished
                    ? t('{v0} timer done. Stop the alarm and go to step {v1}.', {
                        v0: stepName(s.text),
                        v1: i + 1,
                      })
                    : t('{v0} timer, {v1} left{v2}. Go to step {v3}.', {
                        v0: stepName(s.text),
                        v1: formatClock(remainingOf(tItem, now)),
                        v2: tItem.endsAt === null ? t(', paused') : '',
                        v3: i + 1,
                      })
                }
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-[0.8125rem] font-medium tabular-nums',
                  tItem.finished
                    ? 'animate-pulse bg-danger text-cream'
                    : tItem.endsAt === null
                      ? 'bg-surface-2 text-ink-2'
                      : 'bg-accent text-accent-ink'
                )}
              >
                <Timer className="h-3.5 w-3.5" aria-hidden />
                {stepName(s.text)} ·{' '}
                {tItem.finished
                  ? t('done, tap to stop')
                  : `${formatClock(remainingOf(tItem, now))}${tItem.endsAt === null ? ' paused' : ''}`}
              </motion.button>
            ))}
          </AnimatePresence>
        </div>
      </header>

      <main className="relative flex flex-1 items-center overflow-hidden py-6">
        <AnimatePresence mode="popLayout" custom={dir} initial={false}>
          <motion.section
            key={step.id}
            custom={dir}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={settle}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.25}
            onDragEnd={onDragEnd}
            className="mx-auto w-full max-w-2xl space-y-8"
            aria-label={t('Step {v0} of {length}', { v0: index + 1, length: steps.length })}
          >
            {index === 0 && <AvoidWarning recipe={recipe} />}
            <div className="space-y-3">
              <Eyebrow>
                {t('Step {v0} of {length}', { v0: index + 1, length: steps.length })}
              </Eyebrow>
              <p className="font-display text-fluid-step font-medium leading-tight tracking-tight">
                {withTemperatures(step.text, units)}
              </p>
              <StepIngredients
                items={ingredientsInStep(step.text, recipe.ingredients)}
                scale={scale}
                units={units}
              />
              <StepCautions text={step.text} own={step.caution} kids={kids} />
            </div>
            {step.timerMinutes ? (
              <StepTimer
                minutes={step.timerMinutes}
                state={timers[step.id]}
                now={now}
                onStart={() => start(step.id, step.timerMinutes!)}
                onPause={() => pause(step.id)}
                onReset={() => reset(step.id)}
              />
            ) : null}
          </motion.section>
        </AnimatePresence>
      </main>

      <footer className="safe-bottom sticky bottom-0 z-10 -mx-5 flex items-center gap-2 bg-canvas/85 px-5 pt-2 backdrop-blur">
        <Button variant="glass" size="lg" onClick={() => setIngOpen(true)}>
          <ListChecks className="h-5 w-5" aria-hidden /> {t('Ingredients')}
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="lg"
          className="w-16 px-0"
          onClick={prev}
          disabled={index === 0}
          aria-label={t('Previous step')}
        >
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </Button>
        {isLast ? (
          <Button size="lg" onClick={next}>
            <Check className="h-5 w-5" aria-hidden /> {t('Done')}
          </Button>
        ) : (
          <Button size="lg" className="w-20 px-0" onClick={next} aria-label={t('Next step')}>
            <ArrowRight className="h-6 w-6" aria-hidden />
          </Button>
        )}
      </footer>

      <Sheet open={ingOpen} onClose={() => setIngOpen(false)} title={t('Ingredients')} tall>
        <AvoidWarning recipe={recipe} className="mb-3" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm text-ink-3">
            {t('For {count}', { count: pluralize(count, 'person', 'people') })}
            {t('. Tap to check off.')}
          </p>
          <Stepper
            value={count}
            onChange={(v) => {
              setPeople(v)
              if (date && entry) setPlanServings(date, v)
            }}
            min={1}
            max={24}
            label={t('Servings')}
          />
        </div>
        <ul className="space-y-1">
          {recipe.ingredients.map((ing) => {
            const on = checked.has(ing.id)
            return (
              <li key={ing.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setChecked((cur) => {
                      const n = new Set(cur)
                      if (n.has(ing.id)) n.delete(ing.id)
                      else n.add(ing.id)
                      return n
                    })
                  }
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-surface-2"
                >
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                      on ? 'border-secondary bg-secondary text-secondary-ink' : 'border-line'
                    )}
                  >
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={checkPop}
                        >
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className={cn('flex-1 text-[0.9375rem]', on && 'text-ink-3 line-through')}>
                    {ing.name}
                    {ing.optional && t(' (optional)')}
                  </span>
                  <span className="text-sm tabular-nums text-ink-2">
                    {formatAmount(ing.quantity * scale, ing.unit, { system: units })}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)}>
        <div className="flex flex-col items-center pb-4 text-center">
          <div className="relative mb-4 h-16 w-16">
            {finishOpen && <Burst />}
            <motion.div
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={checkPop}
              className="relative flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-ink"
            >
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ ...checkPop, delay: 0.12 }}
              >
                <Check className="h-8 w-8" aria-hidden />
              </motion.span>
            </motion.div>
          </div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {t("Dinner's done.")}
          </h2>
          <p className="mt-1 text-[0.9375rem] text-ink-2">{recipe.title}</p>
        </div>
        {alreadyDone ? (
          <p className="mb-4 text-center text-[0.9375rem] text-ink-2">
            {t("Already marked as cooked, so it won't be counted twice.")}
          </p>
        ) : (
          <div className="mb-4 space-y-2">
            <div className="mb-3 space-y-2">
              <p className="text-sm font-medium text-ink-2">{t('How was it?')}</p>
              <RatingPicker value={rating} onChange={setRating} />
              <label className="block">
                <span className="sr-only">{t('A note for next time')}</span>
                <Input
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('A note for next time (optional)')}
                />
              </label>
            </div>
            <Toggle
              checked={usePantry}
              onChange={setUsePantry}
              label={t('Take what I used out of my pantry')}
            />
            <Toggle
              checked={leftovers}
              onChange={setLeftovers}
              label={
                tomorrowTitle && leftovers
                  ? t('There are leftovers: have them tomorrow instead of {tomorrowTitle}', {
                      tomorrowTitle,
                    })
                  : t('There are leftovers')
              }
            />
            {!(date && entry) && (
              <p className="px-1 text-sm text-ink-3">
                {t("This will be logged as tonight's dinner.")}
              </p>
            )}
          </div>
        )}
        <Button size="lg" className="w-full" onClick={finish}>
          {alreadyDone ? t('Back to Tonight') : t('Finish')}
        </Button>
      </Sheet>

      <Sheet
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={t('A timer is still running')}
      >
        <p className="mb-5 text-ink-2">
          {t(
            'If you leave, it keeps counting and your place is saved. Come back to this recipe to pick up where you were.'
          )}
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => setLeaveOpen(false)}>{t('Keep cooking')}</Button>
          <Button variant="ghost" onClick={close}>
            {t('Leave for now')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

/** The amounts this step needs, so nobody has to scroll back to the list mid-stir. */
function StepIngredients({
  items,
  scale,
  units,
}: {
  items: { id: string; name: string; quantity: number; unit: string }[]
  scale: number
  units: ReturnType<typeof useUnits>
}) {
  if (items.length === 0) return null
  return (
    <ul className="flex flex-wrap gap-2 pt-1" aria-label={t('For this step')}>
      {items.map((i, n) => {
        const amount = i.quantity ? formatAmount(i.quantity * scale, i.unit, { system: units }) : ''
        return (
          <motion.li
            key={i.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...settle, delay: 0.08 + n * 0.04 }}
            className="inline-flex items-baseline gap-1.5 rounded-pill border border-line bg-surface px-3 py-1.5 text-[0.9375rem]"
          >
            {amount && <span className="font-semibold tabular-nums">{amount}</span>}
            <span className="text-ink-2">{i.name.toLowerCase()}</span>
          </motion.li>
        )
      })}
    </ul>
  )
}

const burstTones = [
  'bg-terracotta',
  'bg-saffron',
  'bg-sage',
  'bg-plum',
  'bg-accent',
  'bg-secondary',
]

/** A small, quick bloom of confetti behind the check when dinner is done. */
function Burst() {
  const bits = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1)
    const dist = 58 + (i % 3) * 14
    return { i, x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, round: i % 3 !== 0 }
  })
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {bits.map((b) => (
        <motion.span
          key={b.i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: b.y, scale: [0, 1, 0.6], opacity: [1, 1, 0], rotate: b.i * 40 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.05 + (b.i % 4) * 0.02 }}
          className={cn(
            'absolute left-1/2 top-1/2 -ml-1 -mt-1',
            b.round ? 'h-2 w-2 rounded-full' : 'h-1.5 w-3 rounded-sm',
            burstTones[b.i % burstTones.length]
          )}
        />
      ))}
    </div>
  )
}
