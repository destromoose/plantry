'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowRight, Plus, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Taste } from '@/lib/types'
import { quickPicks } from '@/lib/seed/pantry'
import { ease, settle, reveal, staggerContainer } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Logo } from '@/components/ui/Logo'
import { toast } from '@/components/ui/Toast'
import { AvoidPicker } from '@/components/features/household/AvoidPicker'
import { cn } from '@/lib/utils'

export const tasteOptions: { id: Taste; label: string; hint: string }[] = [
  { id: 'cozy', label: 'Cozy', hint: 'braises, soups, bakes' },
  { id: 'fresh', label: 'Fresh', hint: 'herbs, citrus, crunch' },
  { id: 'fast', label: 'Fast', hint: 'on the table in 20' },
  { id: 'one-pan', label: 'One pan', hint: 'less washing up' },
  { id: 'veg-forward', label: 'Veg-forward', hint: 'plants do the work' },
  { id: 'spicy', label: 'Spicy', hint: 'bring the chili' },
  { id: 'big-batch', label: 'Big batch', hint: 'cook once, eat twice' },
  { id: 'kid-friendly', label: 'Kid-friendly', hint: 'nobody pushes it around the plate' },
]

const steps = ['who', 'taste', 'avoid', 'pantry'] as const
/** The same limit as the Household screen. */
export const MAX_PEOPLE = 12

const DRAFT = 'plantry-onboarding'
interface Draft {
  step: (typeof steps)[number]
  names: string[]
  tastes: Taste[]
  avoid: string[]
  picked: string[]
}
function loadDraft(): Draft | undefined {
  try {
    const raw = window.sessionStorage.getItem(DRAFT) ?? window.localStorage.getItem(DRAFT)
    return raw ? (JSON.parse(raw) as Draft) : undefined
  } catch {
    return undefined
  }
}
function saveDraft(d: Draft) {
  try {
    window.localStorage.setItem(DRAFT, JSON.stringify(d))
  } catch {
    /* a draft is a nicety */
  }
}
function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT)
  } catch {
    /* ignore */
  }
}

export function Onboarding() {
  const router = useRouter()
  const complete = useStore((s) => s.completeOnboarding)
  // A draft is kept as you go, so a reload or a phone call doesn't lose it.
  const [draft] = useState(loadDraft)
  const [step, setStepState] = useState<(typeof steps)[number]>(draft?.step ?? 'who')
  const [names, setNames] = useState<string[]>(draft?.names ?? [''])
  const [tastes, setTastes] = useState<Taste[]>(draft?.tastes ?? [])
  const [avoid, setAvoid] = useState<string[]>(draft?.avoid ?? [])
  const [picked, setPicked] = useState<Set<string>>(new Set(draft?.picked ?? []))
  const [tried, setTried] = useState(false)
  const importData = useStore((s) => s.importData)
  const fileRef = useRef<HTMLInputElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const idx = steps.indexOf(step)

  // Set while finishing, so the history rewind below doesn't change steps or save a draft.
  const finishing = useRef(false)
  useEffect(() => {
    if (finishing.current) return
    saveDraft({ step, names, tastes, avoid, picked: [...picked] })
  }, [step, names, tastes, avoid, picked])

  // Each step forward is a history entry, so the phone's Back button goes to the previous step.
  // depth counts the entries this flow added, so Back and Finish can take them off again.
  const depth = useRef(0)
  const setStep = (s: (typeof steps)[number]) => {
    setStepState(s)
    setTried(false)
    depth.current += 1
    window.history.pushState({ onboarding: s, depth: depth.current }, '')
  }
  const back = () => {
    if (idx <= 0) return
    // Step back through history when we added the entry, so Back and the phone agree.
    if (depth.current > 0) window.history.back()
    else {
      // Restored from a draft with no entries of our own: change this entry in place.
      const prev = steps[idx - 1]
      window.history.replaceState({ ...window.history.state, onboarding: prev, depth: 0 }, '')
      setStepState(prev)
      setTried(false)
    }
  }
  useEffect(() => {
    // Mark the entry we started on, so stepping back to it restores a step restored from a draft.
    window.history.replaceState({ ...window.history.state, onboarding: step, depth: 0 }, '')
    const onPop = (e: PopStateEvent) => {
      if (finishing.current) return
      const st = e.state as { onboarding?: (typeof steps)[number]; depth?: number } | null
      const s = st?.onboarding
      depth.current = st?.depth ?? 0
      setStepState(s && steps.includes(s) ? s : 'who')
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move focus to the new step's heading.
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    heading.current?.focus({ preventScroll: true })
  }, [step])

  async function restore(file?: File) {
    if (!file) return
    const res = importData(await file.text())
    if (!res.ok) {
      toast(res.error ?? 'Could not read that file.', { tone: 'error' })
      return
    }
    clearDraft()
    toast('Welcome back. Everything is restored.')
    router.replace('/')
  }

  const canNext = useMemo(() => {
    if (step === 'who') return names.some((n) => n.trim())
    if (step === 'taste') return tastes.length > 0
    return true
  }, [step, names, tastes])

  const hint =
    step === 'who' ? 'Add your name to continue.' : step === 'taste' ? 'Pick at least one.' : ''

  function next() {
    // Already finishing: a second tap must not finish again.
    if (finishing.current) return
    if (!canNext) {
      setTried(true)
      return
    }
    if (idx < steps.length - 1) setStep(steps[idx + 1])
    else {
      finishing.current = true
      clearDraft()
      // Take the step entries off history first, then finish, so Back from Tonight doesn't land
      // here. Finishing after the rewind also keeps the shell's redirect from racing it.
      // Runs once: on the rewind's popstate, or after a short wait if that never fires.
      let ran = false
      const finish = () => {
        if (ran) return
        ran = true
        window.removeEventListener('popstate', finish)
        complete({
          members: names.map((name) => ({ name: name.trim().slice(0, 40) })),
          tastes,
          avoid,
          pantryNames: [...picked],
        })
        router.replace('/')
      }
      const n = depth.current
      depth.current = 0
      if (n > 0) {
        window.addEventListener('popstate', finish)
        window.setTimeout(finish, 600)
        window.history.go(-n)
      } else finish()
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-6 pb-8 pt-10">
      <div className="mb-8 flex items-center justify-between">
        <Logo className="text-ink" />
        <div className="flex gap-1.5" aria-label={`Step ${idx + 1} of ${steps.length}`}>
          {steps.map((s, i) => (
            <motion.span
              key={s}
              layout
              transition={settle}
              className={cn('h-1.5 rounded-pill', i <= idx ? 'w-8 bg-accent' : 'w-3 bg-line')}
            />
          ))}
        </div>
      </div>

      <motion.div
        key={step}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, ease }}
        className="flex-1"
      >
        {step === 'who' && (
          <section>
            <h1
              ref={heading}
              tabIndex={-1}
              className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight outline-none"
            >
              Who eats here?
            </h1>
            <p className="mt-3 text-base text-ink">
              Plantry picks tonight&apos;s dinner from what you have, plans the week and writes the
              shopping list.
            </p>
            <p className="mt-3 text-[0.9375rem] text-ink-2">
              First names only. You first. Nobody signs in, nobody gets an email. This stays on your
              device.
            </p>
            <motion.ul
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="mt-8 flex flex-col gap-3"
            >
              {names.map((n, i) => (
                <motion.li
                  key={i}
                  variants={reveal}
                  custom={i}
                  layout
                  className="flex items-center gap-2"
                >
                  <Input
                    autoFocus={i === 0}
                    value={n}
                    placeholder={i === 0 ? 'Your name' : 'Another name'}
                    onChange={(e) =>
                      setNames((arr) => arr.map((v, j) => (j === i ? e.target.value : v)))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canNext) next()
                    }}
                    aria-label={i === 0 ? 'Your name' : `Household member ${i + 1}`}
                    maxLength={40}
                  />
                  {i > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove"
                      onClick={() => setNames((arr) => arr.filter((_, j) => j !== i))}
                    >
                      <X className="h-5 w-5" />
                    </Button>
                  )}
                </motion.li>
              ))}
            </motion.ul>
            {names.length < MAX_PEOPLE && (
              <Button
                variant="ghost"
                className="-ml-2 mt-3"
                onClick={() => setNames((arr) => [...arr, ''])}
              >
                <Plus className="h-4 w-4" /> Add someone
              </Button>
            )}
            <p className="mt-8 text-sm text-ink-2">
              Moving from another phone?{' '}
              <button
                type="button"
                className="min-h-[44px] font-medium text-accent underline-offset-2 hover:underline"
                onClick={() => fileRef.current?.click()}
              >
                Restore from a Plantry backup
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                aria-label="Plantry backup file"
                onChange={(e) => restore(e.target.files?.[0])}
              />
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Someone at home already uses Plantry?{' '}
              <Link
                href="/join"
                className="inline-flex min-h-[44px] items-center font-medium text-accent underline-offset-2 hover:underline"
              >
                Join with their code
              </Link>
            </p>
          </section>
        )}

        {step === 'taste' && (
          <section>
            <h1
              ref={heading}
              tabIndex={-1}
              className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight outline-none"
            >
              How do you like to eat?
            </h1>
            <p className="mt-3 text-[0.9375rem] text-ink-2">
              Pick a few. These are tastes, not rules. Allergies and diets come next.
            </p>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="mt-8 flex flex-wrap gap-2.5"
            >
              {tasteOptions.map((t, i) => {
                const on = tastes.includes(t.id)
                return (
                  <motion.div key={t.id} variants={reveal} custom={i}>
                    <Chip
                      selected={on}
                      size="md"
                      onClick={() =>
                        setTastes((arr) => (on ? arr.filter((x) => x !== t.id) : [...arr, t.id]))
                      }
                      className="h-auto flex-col items-start gap-0 px-4 py-2.5"
                    >
                      <span className="text-[0.9375rem]">{t.label}</span>
                      <span
                        className={cn(
                          'text-xs font-normal',
                          on ? 'text-accent-ink/80' : 'text-ink-3'
                        )}
                      >
                        {t.hint}
                      </span>
                    </Chip>
                  </motion.div>
                )
              })}
            </motion.div>
          </section>
        )}

        {step === 'avoid' && (
          <section>
            <h1
              ref={heading}
              tabIndex={-1}
              className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight outline-none"
            >
              Anything to keep off the table?
            </h1>
            <p className="mt-3 text-[0.9375rem] text-ink-2">
              Plantry will never suggest a dinner with these. You can set it per person later. Skip
              if nothing applies.
            </p>
            <AvoidPicker value={avoid} onChange={setAvoid} className="mt-8" />
            <p className="mt-4 text-sm text-ink-3">
              Plantry checks ingredient names. Always check packaging for allergens.
            </p>
          </section>
        )}

        {step === 'pantry' && (
          <section>
            <h1
              ref={heading}
              tabIndex={-1}
              className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight outline-none"
            >
              What&apos;s already in the kitchen?
            </h1>
            <p className="mt-3 text-[0.9375rem] text-ink-2">
              Tap what you have. Nothing is ticked for you. Plantry uses this to suggest dinners you
              can make right now, and to shorten your list.
            </p>
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="mt-8 flex flex-wrap gap-2"
            >
              {quickPicks.map((name, i) => {
                const on = picked.has(name)
                return (
                  <motion.div key={name} variants={reveal} custom={i}>
                    <Chip
                      selected={on}
                      tone="secondary"
                      size="sm"
                      onClick={() =>
                        setPicked((set) => {
                          const n = new Set(set)
                          if (n.has(name)) n.delete(name)
                          else n.add(name)
                          return n
                        })
                      }
                    >
                      {name}
                    </Chip>
                  </motion.div>
                )
              })}
            </motion.div>
            <p className="mt-4 text-sm text-ink-3">
              {picked.size} picked. You can add anything else later.
            </p>
          </section>
        )}
      </motion.div>

      <div className="safe-bottom sticky bottom-0 -mx-6 mt-8 flex flex-wrap items-center justify-between gap-2 bg-canvas/85 px-6 pt-3 backdrop-blur">
        <Button variant="ghost" onClick={back} className={cn(idx === 0 && 'invisible')}>
          Back
        </Button>
        <div className="flex flex-col items-end">
          <Button
            size="lg"
            onClick={next}
            aria-disabled={!canNext}
            aria-describedby={!canNext ? 'next-hint' : undefined}
            className={cn(!canNext && 'opacity-60')}
          >
            {idx === steps.length - 1 ? 'Show me tonight' : 'Next'}
            <ArrowRight className="h-5 w-5" />
          </Button>
          {!canNext && (
            <p
              id="next-hint"
              className={cn('mt-1 text-sm', tried ? 'font-medium text-danger' : 'text-ink-3')}
              role={tried ? 'alert' : undefined}
            >
              {hint}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
