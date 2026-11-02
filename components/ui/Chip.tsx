'use client'

import * as React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { tap, tapTransition } from '@/lib/motion'

interface ChipProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'onAnimationStart' | 'onDragStart' | 'onDragEnd' | 'onDrag'
> {
  selected?: boolean
  tone?: 'default' | 'accent' | 'secondary'
  size?: 'sm' | 'md'
}

/** A pill the user can toggle. Used for tastes, filters, quick picks. */
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  (
    { className, selected, tone = 'default', size = 'md', type = 'button', children, ...props },
    ref
  ) => (
    <motion.button
      ref={ref}
      type={type}
      whileTap={tap}
      transition={tapTransition}
      aria-pressed={selected}
      className={cn(
        'inline-flex select-none items-center gap-1.5 rounded-pill border font-medium transition-colors',
        "relative after:absolute after:-inset-x-0.5 after:-inset-y-1.5 after:content-['']",
        size === 'sm' ? 'h-8 px-3 text-[0.8125rem]' : 'h-11 px-4 text-sm',
        selected
          ? tone === 'secondary'
            ? 'border-secondary bg-secondary text-secondary-ink'
            : 'border-accent bg-accent text-accent-ink'
          : 'border-line-strong bg-surface/70 text-ink-2 hover:border-ink-3 hover:text-ink',
        className
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
)
Chip.displayName = 'Chip'

export function Tag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-pill bg-surface-2 px-2.5 py-1 text-xs font-medium text-ink-2',
        className
      )}
    >
      {children}
    </span>
  )
}
