'use client'

import * as React from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { tap, tapTransition } from '@/lib/motion'

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-pill font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink shadow-card hover:brightness-105',
        secondary: 'bg-surface-2 text-ink hover:bg-line/60',
        ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
        outline: 'border border-line-strong bg-surface/60 text-ink hover:bg-surface',
        danger: 'bg-danger/10 text-danger hover:bg-danger/15',
        glass: 'glass text-ink',
      },
      size: {
        // Small buttons look small but still have a 44 px tap area.
        sm: "relative h-9 px-3.5 text-sm after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
        md: 'h-11 px-5 text-[0.9375rem]',
        lg: 'h-14 px-7 text-base',
        icon: 'h-11 w-11',
        'icon-sm': "relative h-9 w-9 after:absolute after:-inset-1 after:content-['']",
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
)

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'ref'>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = 'button', ...props }, ref) => (
    <motion.button
      ref={ref}
      type={type}
      whileTap={props.disabled ? undefined : tap}
      transition={tapTransition}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'

export { buttonVariants }
