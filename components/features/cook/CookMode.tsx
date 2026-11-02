'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, ListChecks, Timer, UtensilsCrossed, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn, formatQuantity } from '@/lib/utils'
import { checkPop, settle } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Eyebrow } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { StepTimer, formatClock } from './StepTimer'
import { Toggle } from './Toggle'
import { remainingOf, useTimers } from './useTimers'

const slide = {
  enter: (dir: number) => ({ x: dir * 48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir * -48, opacity: 0 }),
}

export function CookMode({ id, date }: { id: string; date?: string }) {
  const router = useRouter()
  const recipe = useStore((s) => s.recipes.find((r) => r.id === id))
  const entry = useStore((s) => (date ? s.plan.find((p) => p.date === date && p.slot === 'dinner') : undefined))
  const markCooked = useStore((s) => s.markCooked)

  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState(1)
  const [ingOpen, setIngOpen] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [usePantry, setUsePantry] = useState(true)
  const [leftovers, setLeftovers] = useState(recipe?.leftovers ?? false)
  const { timers, now, start, pause, reset } = useTimers()

  const steps = useMemo(() => recipe?.steps ?? [], [recipe])
  const last = steps.length - 1
  const step = steps[index]
  const scale = recipe ? (entry?.servings ?? recipe.servings) / recipe.servings : 1
  const sheetOpen = ingOpen || finishOpen

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
  const next = useCallback(() => {
    if (index >= last) setFinishOpen(true)
    else go(index + 1)
  }, [index, last, go])
  const prev = useCallback(() => go(index - 1), [index, go])

  // Keyboard
  useEffect(() => {
    if (sheetOpen) return
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const tag = el?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowRight') {
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
        else lock = l
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

  const activeTimers = useMemo(() => {
    return steps
      .map((s, i) => ({ s, i, t: timers[s.id] }))
      .filter((x) => x.t && (x.t.endsAt !== null || x.t.finished))
  }, [steps, timers])

  if (!recipe || steps.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md items-center px-5">
        <EmptyState
          icon={UtensilsCrossed}
          title={recipe ? 'No steps yet' : "That recipe isn't here"}
          body={recipe ? 'Add some steps to cook along.' : 'It may have been deleted, or the link is off.'}
          action={
            <Link href={recipe ? `/recipes/${recipe.id}` : '/recipes'} className="inline-flex h-11 items-center rounded-pill bg-surface-2 px-5 text-[15px] font-medium hover:bg-line/60">
              {recipe ? 'Back to the recipe' : 'Back to recipes'}
            </Link>
          }
        />
      </div>
    )
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -80 || info.velocity.x < -500) next()
    else if (info.offset.x > 80 || info.velocity.x > 500) prev()
  }

  function finish() {
    if (!recipe) return
    if (date && entry) {
      markCooked(date, { usePantry, leftovers })
      toast('Nice work.')
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
          <Button variant="ghost" size="icon" aria-label="Close cook mode" onClick={() => router.push(`/recipes/${recipe.id}`)}>
            <X className="h-5 w-5" aria-hidden />
          </Button>
          <p className="min-w-0 flex-1 truncate text-center text-sm font-medium text-ink-2">{recipe.title}</p>
          <div className="w-11" aria-hidden />
        </div>
        <div className="mt-3 flex gap-1.5" role="progressbar" aria-label="Progress" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={index + 1} aria-valuetext={`Step ${index + 1} of ${steps.length}`}>
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
        <div className="mt-3 flex min-h-9 flex-wrap justify-center gap-2" aria-live="polite">
          <AnimatePresence initial={false}>
            {activeTimers.map(({ s, i, t }) => (
              <motion.button
                key={s.id}
                type="button"
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={settle}
                onClick={() => go(i)}
                aria-label={t.finished ? `Step ${i + 1} timer finished. Go to step.` : `Step ${i + 1} timer ${formatClock(remainingOf(t, now))} left. Go to step.`}
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-pill px-3 text-[13px] font-medium tabular-nums',
                  t.finished ? 'bg-danger text-cream' : 'bg-accent text-accent-ink'
                )}
              >
                <Timer className="h-3.5 w-3.5" aria-hidden />
                Step {i + 1} · {t.finished ? 'done' : formatClock(remainingOf(t, now))}
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
            aria-label={`Step ${index + 1} of ${steps.length}`}
          >
            <div className="space-y-3">
              <Eyebrow>
                Step {index + 1} of {steps.length}
              </Eyebrow>
              <p className="font-display text-fluid-step font-medium leading-tight tracking-tight">{step.text}</p>
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

      <footer className="safe-bottom flex items-center gap-2 pt-2">
        <Button variant="glass" size="lg" onClick={() => setIngOpen(true)}>
          <ListChecks className="h-5 w-5" aria-hidden /> Ingredients
        </Button>
        <div className="flex-1" />
        <Button variant="outline" size="lg" className="w-16 px-0" onClick={prev} disabled={index === 0} aria-label="Previous step">
          <ArrowLeft className="h-6 w-6" aria-hidden />
        </Button>
        {isLast ? (
          <Button size="lg" onClick={next}>
            <Check className="h-5 w-5" aria-hidden /> Done
          </Button>
        ) : (
          <Button size="lg" className="w-20 px-0" onClick={next} aria-label="Next step">
            <ArrowRight className="h-6 w-6" aria-hidden />
          </Button>
        )}
      </footer>

      <Sheet open={ingOpen} onClose={() => setIngOpen(false)} title="Ingredients" tall>
        <p className="mb-3 text-sm text-ink-3">For {Math.round(recipe.servings * scale)} servings. Tap to check off.</p>
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
                  <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full border', on ? 'border-secondary bg-secondary text-secondary-ink' : 'border-line')}>
                    <AnimatePresence initial={false}>
                      {on && (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={checkPop}>
                          <Check className="h-3.5 w-3.5" aria-hidden />
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                  <span className={cn('flex-1 text-[15px]', on && 'text-ink-3 line-through')}>
                    {ing.name}
                    {ing.optional && ' (optional)'}
                  </span>
                  <span className="text-sm tabular-nums text-ink-2">{formatQuantity(ing.quantity * scale, ing.unit)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>

      <Sheet open={finishOpen} onClose={() => setFinishOpen(false)}>
        <div className="flex flex-col items-center pb-4 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={checkPop}
            className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary text-secondary-ink"
          >
            <Check className="h-8 w-8" aria-hidden />
          </motion.div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">Dinner&apos;s done.</h2>
          <p className="mt-1 text-[15px] text-ink-2">{recipe.title}</p>
        </div>
        {date && entry && (
          <div className="mb-4 space-y-2">
            <Toggle checked={usePantry} onChange={setUsePantry} label="Use up the fresh stuff from my pantry" />
            <Toggle checked={leftovers} onChange={setLeftovers} label="There are leftovers" />
          </div>
        )}
        <Button size="lg" className="w-full" onClick={finish}>
          {date && entry ? 'Finish' : 'Back to the recipe'}
        </Button>
      </Sheet>
    </div>
  )
}
