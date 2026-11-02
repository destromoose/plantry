'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export interface TimerState {
  durationMs: number
  /** Remaining time while paused or idle. */
  remainingMs: number
  /** Wall-clock end while running, else null. */
  endsAt: number | null
  finished: boolean
}

export function remainingOf(t: TimerState, now: number): number {
  return t.endsAt ? Math.max(0, t.endsAt - now) : t.remainingMs
}

function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const times = [0, 0.28, 0.56]
    times.forEach((at) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + at)
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.2)
      osc.connect(gain).connect(ctx.destination)
      osc.start(ctx.currentTime + at)
      osc.stop(ctx.currentTime + at + 0.22)
    })
    setTimeout(() => void ctx.close().catch(() => {}), 1200)
  } catch {
    /* audio is a nicety */
  }
}

function vibrate() {
  try {
    navigator.vibrate?.([400, 200, 400, 200, 400])
  } catch {
    /* not supported */
  }
}

/** Ask once, the first time someone starts a timer, so a locked phone can still alert. */
function askToNotify() {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
    if (window.localStorage.getItem('plantry-asked-notify')) return
    window.localStorage.setItem('plantry-asked-notify', '1')
    void Notification.requestPermission()
  } catch {
    /* ignore */
  }
}

function notify(body: string) {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    if (document.visibilityState === 'visible') return
    new Notification('Timer done', { body, tag: 'plantry-timer', requireInteraction: true })
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

const RING_EVERY_MS = 4000
const RING_FOR_MS = 3 * 60 * 1000

/**
 * Timers keyed by step id. Accurate via Date.now() deltas, independent of render rate.
 * A finished timer keeps ringing until someone dismisses it (or for three minutes).
 */
export function useTimers(
  initial: Record<string, TimerState> = {},
  labelOf: (id: string) => string = () => 'Your timer'
) {
  const [timers, setTimers] = useState<Record<string, TimerState>>(initial)
  const [now, setNow] = useState(() => Date.now())
  const [announce, setAnnounce] = useState('')
  const timersRef = useRef(timers)
  timersRef.current = timers
  const labelRef = useRef(labelOf)
  labelRef.current = labelOf
  const ringStarted = useRef<number | null>(null)

  const anyRunning = Object.values(timers).some((t) => t.endsAt !== null)
  const anyRinging = Object.values(timers).some((t) => t.finished)

  useEffect(() => {
    if (!anyRunning) return
    const iv = setInterval(() => {
      const n = Date.now()
      setNow(n)
      const done = Object.entries(timersRef.current).filter(
        ([, t]) => t.endsAt !== null && t.endsAt <= n
      )
      if (done.length) {
        const names = done.map(([id]) => labelRef.current(id)).join(', ')
        beep()
        vibrate()
        notify(names)
        setAnnounce(`Timer done: ${names}`)
        setTimers((prev) => {
          const next = { ...prev }
          for (const [id] of done) {
            const t = next[id]
            if (t && t.endsAt !== null && t.endsAt <= n)
              next[id] = { ...t, endsAt: null, remainingMs: 0, finished: true }
          }
          return next
        })
      }
    }, 250)
    return () => clearInterval(iv)
  }, [anyRunning])

  // Keep ringing until dismissed, so a timer is not missed while hands are busy.
  useEffect(() => {
    if (!anyRinging) {
      ringStarted.current = null
      return
    }
    ringStarted.current ??= Date.now()
    const iv = setInterval(() => {
      if (Date.now() - (ringStarted.current ?? 0) > RING_FOR_MS) return
      beep()
      vibrate()
    }, RING_EVERY_MS)
    return () => clearInterval(iv)
  }, [anyRinging])

  const start = useCallback((id: string, minutes: number) => {
    askToNotify()
    const n = Date.now()
    setNow(n)
    const t0 = timersRef.current[id]
    const rem0 = t0 && !t0.finished && t0.remainingMs > 0 ? t0.remainingMs : minutes * 60_000
    setAnnounce(`Timer started: ${Math.max(1, Math.round(rem0 / 60_000))} minutes`)
    setTimers((prev) => {
      const t = prev[id] ?? {
        durationMs: minutes * 60_000,
        remainingMs: minutes * 60_000,
        endsAt: null,
        finished: false,
      }
      if (t.endsAt !== null) return prev
      const rem = t.finished || t.remainingMs <= 0 ? t.durationMs : t.remainingMs
      return { ...prev, [id]: { ...t, remainingMs: rem, endsAt: n + rem, finished: false } }
    })
  }, [])

  const pause = useCallback((id: string) => {
    const n = Date.now()
    setAnnounce('Timer paused')
    setTimers((prev) => {
      const t = prev[id]
      if (!t || t.endsAt === null) return prev
      return { ...prev, [id]: { ...t, remainingMs: Math.max(0, t.endsAt - n), endsAt: null } }
    })
  }, [])

  /** Back to the full time. Also how a ringing timer is dismissed. */
  const reset = useCallback((id: string) => {
    setTimers((prev) => {
      const t = prev[id]
      if (!t) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  return { timers, now, start, pause, reset, announce }
}
