'use client'

import { allergenOptions, dietOptions } from '@/lib/diet'
import { Chip } from '@/components/ui/Chip'
import { cn } from '@/lib/utils'

/** Chips for allergens and diets. Used in onboarding, Settings and per person. */
export function AvoidPicker({
  value,
  onChange,
  className,
}: {
  value: string[]
  onChange: (v: string[]) => void
  className?: string
}) {
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-2">Allergies</p>
        <div role="group" aria-label="Allergies" className="flex flex-wrap gap-2">
          {allergenOptions.map((o) => (
            <Chip key={o.id} selected={value.includes(o.id)} onClick={() => toggle(o.id)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-ink-2">Diets</p>
        <div role="group" aria-label="Diets" className="flex flex-wrap gap-2">
          {dietOptions.map((o) => (
            <Chip key={o.id} selected={value.includes(o.id)} onClick={() => toggle(o.id)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  )
}
