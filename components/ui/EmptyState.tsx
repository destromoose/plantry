import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  body?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, body, action, className }: EmptyStateProps) {
  return (
    <div className={cn('card flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-accent">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
      {body && <p className="mt-1.5 max-w-xs text-[0.9375rem] text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
