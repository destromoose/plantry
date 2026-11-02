'use client'

import { motion } from 'framer-motion'
import { settle } from '@/lib/motion'
import { cn } from '@/lib/utils'

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface px-4 py-2 text-left text-[15px]"
    >
      {label}
      <span
        className={cn(
          'relative h-6 w-10 shrink-0 rounded-pill transition-colors',
          checked ? 'bg-accent' : 'bg-line'
        )}
        aria-hidden
      >
        <motion.span
          layout
          transition={settle}
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-card',
            checked ? 'right-0.5' : 'left-0.5'
          )}
        />
      </span>
    </button>
  )
}
