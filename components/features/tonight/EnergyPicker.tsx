'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { Energy } from '@/lib/types'
import { settle, tap, tapTransition } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { Eyebrow } from '@/components/ui/Card'

export const energyOptions: { id: Energy; label: string; hint: string }[] = [
  { id: 'up-for-it', label: 'Up for it', hint: 'Happy to cook 40 min' },
  { id: 'quick', label: 'Something quick', hint: '20 minutes, tops' },
  { id: 'cant-tonight', label: "Can't tonight", hint: "And that's fine" },
]

export function EnergyPicker({ energy, label, onSet }: { energy?: Energy; label: string; onSet: (e: Energy) => void }) {
  const [editing, setEditing] = useState(false)
  const current = energyOptions.find((o) => o.id === energy)

  if (current && !editing) {
    return (
      <motion.div layout transition={settle} className="flex items-center gap-2" aria-label="Your energy">
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

  return (
    <motion.section layout transition={settle} aria-labelledby="energy-q">
      <h2 id="energy-q" className="mb-3 font-display text-xl font-semibold tracking-tight">
        How are you {label.toLowerCase() === 'tomorrow' ? 'tomorrow' : 'tonight'}?
      </h2>
      <div role="radiogroup" aria-labelledby="energy-q" className="grid gap-2.5 sm:grid-cols-3">
        {energyOptions.map((o) => {
          const selected = o.id === energy
          return (
            <motion.button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={selected}
              whileTap={tap}
              transition={tapTransition}
              onClick={() => {
                onSet(o.id)
                setEditing(false)
              }}
              className={cn(
                'relative min-h-[64px] overflow-hidden rounded-card border px-4 py-3.5 text-left transition-colors',
                selected ? 'border-accent' : 'border-line bg-surface hover:border-ink-3'
              )}
            >
              {selected && (
                <motion.span layoutId="energy-selected" transition={settle} className="absolute inset-0 bg-accent" aria-hidden />
              )}
              <span className={cn('relative block font-display text-lg font-semibold', selected && 'text-accent-ink')}>{o.label}</span>
              <Eyebrow className={cn('relative mt-0.5 normal-case tracking-normal text-[13px] font-normal', selected && 'text-accent-ink/80')}>
                {o.hint}
              </Eyebrow>
            </motion.button>
          )
        })}
      </div>
    </motion.section>
  )
}
