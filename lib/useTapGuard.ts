'use client'

import { useCallback, useRef } from 'react'

/**
 * Wrap a handler so a quick second tap is ignored. Stops double taps from
 * saving twice, skipping a step, or toggling something straight back.
 */
export function useTapGuard<A extends unknown[]>(fn: (...args: A) => void, ms = 300) {
  const last = useRef(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  return useCallback(
    (...args: A) => {
      const now = Date.now()
      if (now - last.current < ms) return
      last.current = now
      fnRef.current(...args)
    },
    [ms]
  )
}
