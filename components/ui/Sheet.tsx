'use client'

import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { backdrop, sheet } from '@/lib/motion'
import { Button } from './Button'

interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  className?: string
  /** Full height on phones. */
  tall?: boolean
}

/**
 * A bottom sheet on touch screens and a centered panel on wide screens.
 * The grabber is draggable: a flick down closes it.
 */
export function Sheet({ open, onClose, title, children, className, tall }: SheetProps) {
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6">
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-espresso/40 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={sheet}
            initial="hidden"
            animate="show"
            exit="exit"
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
            className={cn(
              'relative flex w-full flex-col rounded-t-sheet bg-surface shadow-float sm:max-w-lg sm:rounded-sheet',
              tall ? 'h-[92dvh] sm:h-auto sm:max-h-[85vh]' : 'max-h-[88dvh] sm:max-h-[85vh]',
              className
            )}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-3 sm:pt-5">
              <div className="mx-auto h-1.5 w-10 rounded-pill bg-line sm:hidden" />
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-3 top-3"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {title && (
              <h2 className="px-6 pb-2 font-display text-2xl font-semibold tracking-tight">
                {title}
              </h2>
            )}
            <div className="safe-bottom flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
