'use client'

import { useMemo } from 'react'
import { householdAvoid } from './diet'
import { useStore } from './store'

/** Everything the household avoids, kept stable between renders. */
export function useAvoid() {
  const avoid = useStore((s) => s.settings.avoid)
  const members = useStore((s) => s.members)
  return useMemo(() => householdAvoid({ avoid }, members), [avoid, members])
}
