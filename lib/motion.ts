import type { Transition, Variants } from 'framer-motion'

// Plantry's motion signature. Every animation in the app uses one of these so the
// product has one body language. Only transform and opacity are animated.

export const ease = [0.22, 1, 0.36, 1] as const

export const tap = { scale: 0.97 }
export const tapTransition: Transition = { duration: 0.12, ease: 'easeOut' }

/** Cards entering, sheets opening, tab indicator. */
export const settle: Transition = { type: 'spring', stiffness: 400, damping: 30, mass: 0.8 }

/** Drag and drop, reorder, the shuffle deck. */
export const drift: Transition = { type: 'spring', stiffness: 170, damping: 26 }

/** Lists and grids on mount. */
export const reveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.24, ease, delay: Math.min(i, 12) * 0.04 },
  }),
  exit: { opacity: 0, y: 6, transition: { duration: 0.16, ease: 'easeOut' } },
}

export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
}

/** Page crossfade used by the shell. */
export const page: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.2, ease } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.14, ease: 'easeOut' } },
}

/** Sheet rising from the bottom on touch devices. */
export const sheet: Variants = {
  hidden: { y: '100%', opacity: 0.6 },
  show: { y: 0, opacity: 1, transition: settle },
  exit: { y: '100%', opacity: 0.6, transition: { duration: 0.2, ease: 'easeIn' } },
}

export const backdrop: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.14 } },
}

/** The check pop used by the shop list and cook steps. */
export const checkPop: Transition = { type: 'spring', stiffness: 600, damping: 18 }
