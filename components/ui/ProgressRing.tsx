'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ProgressRingProps {
  /** 0 to 1 */
  value: number
  size?: number
  stroke?: number
  className?: string
  tone?: 'accent' | 'secondary' | 'danger' | 'ink'
  children?: React.ReactNode
}

export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  className,
  tone = 'accent',
  children,
}: ProgressRingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color =
    tone === 'secondary'
      ? 'rgb(var(--secondary))'
      : tone === 'danger'
        ? '#C0392B'
        : tone === 'ink'
          ? 'rgb(var(--ink-3))'
          : 'rgb(var(--accent))'
  return (
    <div
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="rgb(var(--line))"
          strokeWidth={stroke}
          fill="none"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
