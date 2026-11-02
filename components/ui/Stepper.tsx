'use client'

import { Minus, Plus } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from './Button'
import { settle } from '@/lib/motion'

interface StepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  label?: string
}

export function Stepper({ value, onChange, min = 1, max = 12, label }: StepperProps) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-pill bg-surface-2 p-1"
      role="group"
      aria-label={label}
    >
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Decrease"
        disabled={value <= min}
      >
        <Minus className="h-4 w-4" />
      </Button>
      <div className="relative h-7 w-8 overflow-hidden text-center tabular-nums">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={value}
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            transition={settle}
            className="absolute inset-0 flex items-center justify-center font-semibold"
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Increase"
        disabled={value >= max}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  )
}
