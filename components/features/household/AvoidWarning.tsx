'use client'

import { andList, t } from '@/lib/i18n'

import { AlertTriangle } from 'lucide-react'
import { conflicts, conflictText } from '@/lib/diet'
import { useAvoid } from '@/lib/useAvoid'
import type { Recipe } from '@/lib/types'
import { cn } from '@/lib/utils'

/** A clear warning when a recipe breaks a household allergy or diet. */
export function AvoidWarning({ recipe, className }: { recipe: Recipe; className?: string }) {
  const avoid = useAvoid()
  const c = conflicts(recipe, avoid)
  if (!c.blocking.length && !c.leaveOut.length) return null
  return (
    <div
      role="note"
      className={cn(
        'flex gap-3 rounded-2xl border p-3 text-[0.9375rem]',
        c.blocking.length ? 'border-danger/40 bg-danger/10' : 'border-line bg-surface-2',
        className
      )}
    >
      <AlertTriangle
        className={cn('mt-0.5 h-5 w-5 shrink-0', c.blocking.length ? 'text-danger' : 'text-ink-2')}
        aria-hidden
      />
      <p>
        {c.blocking.length ? (
          <>
            <strong className="font-semibold">{conflictText(c)}.</strong>{' '}
            {t('Your household avoids this: {v0}.', { v0: c.culprits.join(', ').toLowerCase() })}
          </>
        ) : null}
        {c.leaveOut.length ? (
          <span className={cn(c.blocking.length && 'mt-1 block')}>
            {t('Leave out the {v0} to keep it safe.', {
              v0: andList(c.leaveOut).toLowerCase(),
            })}
          </span>
        ) : null}
      </p>
    </div>
  )
}

/** A small tag for recipe cards. */
export function AvoidBadge({ recipe }: { recipe: Recipe }) {
  const avoid = useAvoid()
  const c = conflicts(recipe, avoid)
  if (!c.blocking.length) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-danger/15 px-2 py-0.5 text-xs font-semibold text-danger">
      <AlertTriangle className="h-3 w-3" aria-hidden /> {conflictText(c)}
    </span>
  )
}
