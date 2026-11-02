'use client'

import { motion } from 'framer-motion'
import { Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { settle } from '@/lib/motion'
import { remainingOf, type TimerState } from './useTimers'

export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function StepTimer({
  minutes,
  state,
  now,
  onStart,
  onPause,
  onReset,
}: {
  minutes: number
  state?: TimerState
  now: number
  onStart: () => void
  onPause: () => void
  onReset: () => void
}) {
  const durationMs = minutes * 60_000
  const remaining = state ? remainingOf(state, now) : durationMs
  const running = !!state && state.endsAt !== null
  const finished = !!state?.finished
  const progress = finished ? 1 : 1 - remaining / durationMs

  return (
    <div className="flex flex-col items-center gap-4" role="group" aria-label="Step timer">
      <motion.div animate={finished ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={finished ? { ...settle, repeat: Infinity, repeatDelay: 0.4 } : settle}>
        <ProgressRing value={progress} size={176} stroke={8} tone={finished ? 'danger' : running ? 'accent' : 'ink'}>
          <div className="text-center">
            <p className="font-display text-4xl font-semibold tabular-nums" role="timer" aria-live="off">
              {formatClock(remaining)}
            </p>
            {finished && <p className="text-sm font-medium text-danger">Time&apos;s up</p>}
          </div>
        </ProgressRing>
      </motion.div>
      <div className="flex items-center gap-2">
        {running ? (
          <Button variant="secondary" onClick={onPause}>
            <Pause className="h-4 w-4" aria-hidden /> Pause
          </Button>
        ) : (
          <Button variant="secondary" onClick={onStart}>
            <Play className="h-4 w-4" aria-hidden /> {state && !finished && remaining < durationMs ? 'Resume' : 'Start'}
          </Button>
        )}
        <Button variant="ghost" onClick={onReset} disabled={!state || (!running && !finished && remaining === durationMs)}>
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset
        </Button>
      </div>
    </div>
  )
}
