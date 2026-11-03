'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { backHandler, canSwipeBack, parentOf, swipeCommits } from '@/lib/backGesture'

/** How close to the left edge a touch has to start, in CSS pixels. */
const EDGE = 24

function standalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Swipe from the left edge to go back, with the page following your finger, as on
 * any iPhone screen. Only in the home-screen app: in a Safari tab, Safari's own
 * swipe back already does this.
 */
export function EdgeSwipeBack() {
  const pathname = usePathname()
  const router = useRouter()
  const path = useRef(pathname)
  path.current = pathname

  // A new screen arrived: put the page back where it belongs.
  useEffect(() => {
    const main = document.getElementById('main')
    if (!main) return
    main.style.transition = ''
    main.style.transform = ''
    main.style.boxShadow = ''
  }, [pathname])

  useEffect(() => {
    if (!standalone()) return
    let start: { x: number; y: number; t: number } | null = null
    let dragging = false
    let last = { x: 0, t: 0, v: 0 }

    const main = () => document.getElementById('main')

    const reset = (animate: boolean) => {
      const el = main()
      if (!el) return
      el.style.transition = animate ? 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)' : ''
      el.style.transform = ''
      el.style.boxShadow = ''
    }

    const goBack = () => {
      const own = backHandler()
      if (own) return own()
      if (window.history.length > 1) router.back()
      else router.push(parentOf(path.current))
    }

    const onStart = (e: TouchEvent) => {
      start = null
      dragging = false
      if (e.touches.length !== 1 || !canSwipeBack(path.current)) return
      // Leave an open sheet or dialog alone; it has its own way to close.
      if (document.querySelector('[role="dialog"]')) return
      const tch = e.touches[0]
      if (tch.clientX > EDGE) return
      start = { x: tch.clientX, y: tch.clientY, t: e.timeStamp }
      last = { x: tch.clientX, t: e.timeStamp, v: 0 }
    }

    const onMove = (e: TouchEvent) => {
      if (!start) return
      const tch = e.touches[0]
      const dx = tch.clientX - start.x
      const dy = tch.clientY - start.y
      if (!dragging) {
        // Mostly down the screen: a scroll that began at the edge, not a swipe.
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
          start = null
          return
        }
        if (dx < 8) return
        dragging = true
      }
      e.preventDefault()
      const dt = Math.max(1, e.timeStamp - last.t)
      last = { x: tch.clientX, t: e.timeStamp, v: (tch.clientX - last.x) / dt }
      const el = main()
      if (!el) return
      el.style.transition = 'none'
      el.style.transform = `translate3d(${Math.max(0, dx)}px, 0, 0)`
      el.style.boxShadow = '-12px 0 24px -12px rgb(0 0 0 / 0.25)'
    }

    const onEnd = () => {
      if (!start || !dragging) {
        start = null
        return
      }
      const dx = last.x - start.x
      start = null
      dragging = false
      const el = main()
      if (!swipeCommits(dx, window.innerWidth, last.v) || !el) return reset(true)
      if (backHandler()) {
        // The screen decides, maybe by asking first, so the page springs back while it does.
        reset(true)
        return goBack()
      }
      el.style.transition = 'transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)'
      el.style.transform = `translate3d(${window.innerWidth}px, 0, 0)`
      setTimeout(goBack, 180)
    }

    // Swallow the moves of a swipe in progress before anything else on the page sees them,
    // so cook mode's step swipe doesn't also go to the previous step.
    const swallow = (e: PointerEvent) => {
      if (dragging && e.pointerType === 'touch') e.stopPropagation()
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    window.addEventListener('pointermove', swallow, true)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
      window.removeEventListener('pointermove', swallow, true)
    }
  }, [router])

  return null
}
