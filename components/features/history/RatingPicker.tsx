'use client'

import { Chip } from '@/components/ui/Chip'
import { ratingLabels } from '@/lib/history'
import type { Rating } from '@/lib/types'

const order: Rating[] = ['loved', 'fine', 'not-again']

/** Three plain choices. Tapping the chosen one again clears it. */
export function RatingPicker({
  value,
  onChange,
  label = 'How was it?',
}: {
  value?: Rating
  onChange: (r?: Rating) => void
  label?: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {order.map((r) => (
        <Chip
          key={r}
          role="radio"
          aria-checked={value === r}
          aria-pressed={undefined}
          selected={value === r}
          onClick={() => onChange(value === r ? undefined : r)}
        >
          {ratingLabels[r]}
        </Chip>
      ))}
    </div>
  )
}
