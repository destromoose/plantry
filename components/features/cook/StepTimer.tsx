'use client'

import { t } from '@/lib/i18n'

import { motion } from 'framer-motion'
import { BellOff, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { settle } from '@/lib/motion'
import { useTapGuard } from '@/lib/useTapGuard'
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
  // Start and Pause swap places, so one shared guard stops a double tap undoing itself.
  const tap = useTapGuard((f: () => void) => f(), 400)
  const start = () => tap(onStart)
  const pause = () => tap(onPause)

  return (
    <div className="flex flex-col items-center gap-4" role="group" aria-label={t('Step timer')}>
      <motion.div
        animate={finished ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={finished ? { ...settle, repeat: Infinity, repeatDelay: 0.4 } : settle}
      >
        <ProgressRing
          value={progress}
          size={176}
          stroke={8}
          tone={finished ? 'danger' : running ? 'accent' : 'ink'}
        >
          <div className="text-center">
            <p
              className="font-display text-4xl font-semibold tabular-nums"
              role="timer"
              aria-live="off"
            >
              {formatClock(remaining)}
            </p>
            {finished && <p className="text-sm font-medium text-danger">{t("Time's up")}</p>}
          </div>
        </ProgressRing>
      </motion.div>
      {finished ? (
        <Button size="lg" variant="danger" onClick={onReset}>
          <BellOff className="h-5 w-5" aria-hidden /> {t('Stop the alarm')}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-1">
          {running ? (
            <Button variant="secondary" onClick={pause}>
              <Pause className="h-4 w-4" aria-hidden /> {t('Pause')}
            </Button>
          ) : (
            <Button variant="secondary" onClick={start}>
              <Play className="h-4 w-4" aria-hidden />{' '}
              {state && remaining < durationMs ? t('Resume') : t('Start')}
            </Button>
          )}
          {/* Reset only while paused, and away from Pause, so it can't be hit by accident. */}
          {state && !running && remaining < durationMs && (
            <Button variant="ghost" size="sm" className="mt-2 text-ink-3" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />{' '}
              {t('Reset to {minutes} min', { minutes })}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
