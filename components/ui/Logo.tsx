import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

/** The Plantry mark: a plate seen from above with a leaf, drawn in one stroke. */
export function Logo({ className, withWord = true }: { className?: string; withWord?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
        <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="2" />
        <circle cx="14" cy="14" r="7" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <path d="M14 18c0-4 2.5-6.5 6.5-6.5C20.5 15.5 18 18 14 18Z" fill="currentColor" />
        <path d="M14 18l3-3" stroke="rgb(var(--canvas))" strokeWidth="1" strokeLinecap="round" />
      </svg>
      {withWord && (
        <span className="font-display text-xl font-semibold tracking-tight">{t('Plantry')}</span>
      )}
    </span>
  )
}
