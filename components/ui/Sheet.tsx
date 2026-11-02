'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

let openCount = 0

/**
 * A bottom sheet on touch screens and a centered panel on wide screens. A real modal:
 * focus moves in and stays in, the page behind is inert, and focus returns to the
 * button that opened it. Only the grabber drags, so a slip while scrolling can't close it.
 */
export function Sheet({ open, onClose, title, children, className, tall }: SheetProps) {
  const panel = React.useRef<HTMLDivElement>(null)
  const drag = useDragControls()
  const titleId = React.useId()
  const [host, setHost] = React.useState<HTMLElement | null>(null)
  const onCloseRef = React.useRef(onClose)
  onCloseRef.current = onClose

  React.useEffect(() => setHost(document.body), [])

  React.useEffect(() => {
    if (!open) return
    const trigger = document.activeElement as HTMLElement | null
    openCount++
    // Everything outside the sheet is inert while it is open.
    const others = [...document.body.children].filter(
      (el) => !el.hasAttribute('data-sheet-root') && !el.hasAttribute('inert')
    )
    others.forEach((el) => el.setAttribute('inert', ''))
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusFirst = () => {
      const el = panel.current
      if (!el) return
      const first = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
        (n) => n.getAttribute('aria-label') !== 'Close'
      )
      ;(first ?? el).focus({ preventScroll: true })
    }
    const t = setTimeout(focusFirst, 30)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab' || !panel.current) return
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (n) => n.offsetParent !== null
      )
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      document.removeEventListener('keydown', onKey)
      others.forEach((el) => el.removeAttribute('inert'))
      openCount--
      if (openCount === 0) document.body.style.overflow = prevOverflow
      // Back to whatever opened the sheet, if it is still on the page.
      if (trigger && document.contains(trigger)) trigger.focus({ preventScroll: true })
    }
  }, [open])

  if (!host) return null
  return createPortal(
    <div data-sheet-root="">
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
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-labelledby={title ? titleId : undefined}
              aria-label={title ? undefined : 'Dialog'}
              tabIndex={-1}
              variants={sheet}
              initial="hidden"
              animate="show"
              exit="exit"
              drag="y"
              dragListener={false}
              dragControls={drag}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120 || info.velocity.y > 600) onClose()
              }}
              className={cn(
                'relative flex w-full flex-col rounded-t-sheet bg-surface shadow-float outline-none sm:max-w-lg sm:rounded-sheet',
                tall ? 'h-[92dvh] sm:h-auto sm:max-h-[85vh]' : 'max-h-[88dvh] sm:max-h-[85vh]',
                className
              )}
            >
              <div
                className="flex touch-none items-center justify-between px-5 pb-2 pt-3 sm:pt-5"
                onPointerDown={(e) => drag.start(e)}
              >
                <div className="mx-auto h-1.5 w-10 rounded-pill bg-line sm:hidden" aria-hidden />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  aria-label="Close"
                  className="absolute right-2 top-2"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              {title && (
                <h2
                  id={titleId}
                  className="px-6 pb-2 pr-14 font-display text-2xl font-semibold tracking-tight"
                >
                  {title}
                </h2>
              )}
              <div className="safe-bottom flex-1 overflow-y-auto px-6 pb-6">{children}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>,
    host
  )
}
