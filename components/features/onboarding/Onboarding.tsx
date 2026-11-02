'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
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

const steps = ['who', 'taste', 'pantry'] as const

export function Onboarding() {
  const router = useRouter()
  const complete = useStore((s) => s.completeOnboarding)
  const [step, setStep] = useState<(typeof steps)[number]>('who')
  const [names, setNames] = useState<string[]>([''])
  const [tastes, setTastes] = useState<Taste[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set(quickPicks.slice(0, 8)))
  const idx = steps.indexOf(step)

  const canNext = useMemo(() => {
    if (step === 'who') return names.some((n) => n.trim())
    if (step === 'taste') return tastes.length > 0
    return true
  }, [step, names, tastes])

  function next() {
    if (idx < steps.length - 1) setStep(steps[idx + 1])
    else {
      complete({ members: names.map((name) => ({ name })), tastes, pantryNames: [...picked] })
      router.replace('/')
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
            <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
              Who eats here?
            </h1>
            <p className="mt-3 text-[15px] text-ink-2">
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
            {names.length < 6 && (
              <Button
                variant="ghost"
                className="-ml-2 mt-3"
                onClick={() => setNames((arr) => [...arr, ''])}
              >
                <Plus className="h-4 w-4" /> Add someone
              </Button>
            )}
          </section>
        )}

        {step === 'taste' && (
          <section>
            <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
              How do you like to eat?
            </h1>
            <p className="mt-3 text-[15px] text-ink-2">
              Pick a few. These are tastes, not rules. No diets here.
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
                      <span className="text-[15px]">{t.label}</span>
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

        {step === 'pantry' && (
          <section>
            <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
              What&apos;s already in the kitchen?
            </h1>
            <p className="mt-3 text-[15px] text-ink-2">
              Tap what you have. Plantry uses this to suggest dinners you can make right now, and to
              shorten your list.
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

      <div className="mt-8 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => idx > 0 && setStep(steps[idx - 1])}
          className={cn(idx === 0 && 'invisible')}
        >
          Back
        </Button>
        <Button size="lg" onClick={next} disabled={!canNext}>
          {idx === steps.length - 1 ? 'Show me tonight' : 'Next'}
          <ArrowRight className="h-5 w-5" />
        </Button>
      </div>
    </div>
  )
}
