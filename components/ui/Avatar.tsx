import type { Member } from '@/lib/types'
import { cn } from '@/lib/utils'

const colors: Record<Member['color'], string> = {
  terracotta: 'bg-terracotta text-cream',
  saffron: 'bg-saffron text-espresso',
  sage: 'bg-sage text-cream',
  plum: 'bg-plum text-cream',
}

export function Avatar({
  member,
  size = 'md',
  className,
}: {
  member: Member
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const dim =
    size === 'sm'
      ? 'h-6 w-6 text-[0.6875rem]'
      : size === 'lg'
        ? 'h-12 w-12 text-lg'
        : 'h-8 w-8 text-sm'
  return (
    <span
      title={member.name}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        dim,
        colors[member.color],
        className
      )}
    >
      {member.name.trim().charAt(0).toUpperCase()}
    </span>
  )
}

export function memberColorClass(color: Member['color']) {
  return colors[color]
}
