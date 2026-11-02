'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { Energy } from '@/lib/types'
import { settle, tap, tapTransition } from '@/lib/motion'
import { cn } from '@/lib/utils'

export const energyOptions: { id: Energy; label: string; hint: string }[] = [
  { id: 'up-for-it', label: 'Up for it', hint: 'Happy to cook 40 min' },
  { id: 'quick', label: 'Something quick', hint: '20 minutes, tops' },
  { id: 'cant-tonight', label: "Can't tonight", hint: "And that's fine" },
]

export function EnergyPicker({
  energy,
  label,
  onSet,
}: {
  energy?: Energy
  label: string
  onSet: (e: Energy) => void
}) {
  const [editing, setEditing] = useState(false)
  const current = energyOptions.find((o) => o.id === energy)

  if (current && !editing) {
    return (
      <motion.div
        layout
        transition={settle}
        className="flex items-center gap-2"
        aria-label="Your energy"
      >
        <span className="inline-flex h-9 items-center gap-1.5 rounded-pill bg-surface-2 px-3.5 text-sm font-medium text-ink">
          <Check className="h-4 w-4 text-secondary" aria-hidden />
          {current.label}
        </span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="h-11 rounded-pill px-3 text-sm font-medium text-ink-2 underline-offset-4 hover:text-ink hover:underline"
        >
          Change
        </button>
      </motion.div>
    )
  }

  // A compact row of three choices, so the dinner itself stays above the fold.
  // Arrow keys move between them, as in any radio group.
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']
    if (!keys.includes(e.key)) return
    e.preventDefault()
    const radios = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=radio]')]
    const i = radios.indexOf(document.activeElement as HTMLButtonElement)
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1
    radios[(i + step + radios.length) % radios.length]?.focus()
  }
  const focusIndex = Math.max(
    0,
    energyOptions.findIndex((o) => o.id === energy)
  )

  return (
    <motion.section layout transition={settle} aria-labelledby="energy-q">
      <h2 id="energy-q" className="mb-2 text-sm font-semibold text-ink-2">
        How are you {label.toLowerCase() === 'tomorrow' ? 'feeling about tomorrow' : 'tonight'}?
      </h2>
      <div
        role="radiogroup"
        aria-labelledby="energy-q"
        onKeyDown={onKey}
        className="flex flex-wrap gap-1.5"
      >
        {energyOptions.map((o, i) => {
          const selected = o.id === energy
          return (
            <motion.button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-describedby={`energy-${o.id}`}
              tabIndex={i === focusIndex ? 0 : -1}
              whileTap={tap}
              transition={tapTransition}
              onClick={() => {
                onSet(o.id)
                setEditing(false)
              }}
              className={cn(
                'inline-flex min-h-11 items-center gap-1 rounded-pill border px-3 text-sm font-medium transition-colors',
                selected
                  ? 'border-accent bg-accent text-accent-ink'
                  : 'border-line-strong bg-surface text-ink hover:border-ink-3'
              )}
            >
              {selected && <Check className="h-4 w-4" aria-hidden />}
              {o.label}
              <span id={`energy-${o.id}`} className="sr-only">
                {o.hint}
              </span>
            </motion.button>
          )
        })}
      </div>
    </motion.section>
  )
}
