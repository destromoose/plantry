import * as React from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('card p-5', className)} {...props} />
}

export function SectionTitle({
  children,
  className,
  action,
  as: Tag = 'h2',
}: {
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
  /** h3 when the section sits under a page-level group heading. */
  as?: 'h2' | 'h3'
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-3', className)}>
      <Tag className="font-display text-xl font-semibold tracking-tight text-ink">{children}</Tag>
      {action}
    </div>
  )
}

export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <p className={cn('text-xs font-semibold uppercase tracking-[0.14em] text-ink-3', className)}>
      {children}
    </p>
  )
}
