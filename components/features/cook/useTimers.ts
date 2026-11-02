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
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
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

/** Timers keyed by step id. Accurate via Date.now() deltas, independent of render rate. */
export function useTimers() {
  const [timers, setTimers] = useState<Record<string, TimerState>>({})
  const [now, setNow] = useState(() => Date.now())
  const timersRef = useRef(timers)
  timersRef.current = timers

  const anyRunning = Object.values(timers).some((t) => t.endsAt !== null)

  useEffect(() => {
    if (!anyRunning) return
    const iv = setInterval(() => {
      const n = Date.now()
      setNow(n)
      const cur = timersRef.current
      const done = Object.entries(cur).filter(([, t]) => t.endsAt !== null && t.endsAt <= n)
      if (done.length) {
        beep()
        setTimers((prev) => {
          const next = { ...prev }
          for (const [id] of done) {
            const t = next[id]
            if (t && t.endsAt !== null && t.endsAt <= n) next[id] = { ...t, endsAt: null, remainingMs: 0, finished: true }
          }
          return next
        })
      }
    }, 250)
    return () => clearInterval(iv)
  }, [anyRunning])

  const start = useCallback((id: string, minutes: number) => {
    const n = Date.now()
    setNow(n)
    setTimers((prev) => {
      const t = prev[id] ?? { durationMs: minutes * 60_000, remainingMs: minutes * 60_000, endsAt: null, finished: false }
      if (t.endsAt !== null) return prev
      const rem = t.finished || t.remainingMs <= 0 ? t.durationMs : t.remainingMs
      return { ...prev, [id]: { ...t, remainingMs: rem, endsAt: n + rem, finished: false } }
    })
  }, [])

  const pause = useCallback((id: string) => {
    const n = Date.now()
    setTimers((prev) => {
      const t = prev[id]
      if (!t || t.endsAt === null) return prev
      return { ...prev, [id]: { ...t, remainingMs: Math.max(0, t.endsAt - n), endsAt: null } }
    })
  }, [])

  const reset = useCallback((id: string) => {
    setTimers((prev) => {
      const t = prev[id]
      if (!t) return prev
      return { ...prev, [id]: { ...t, remainingMs: t.durationMs, endsAt: null, finished: false } }
    })
  }, [])

  return { timers, now, start, pause, reset }
}
