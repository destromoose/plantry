'use client'

import { useStore, type PlantryState } from './store'
import { toast } from '@/components/ui/Toast'

const keys = [
  'settings',
  'members',
  'recipes',
  'pantry',
  'plan',
  'shop',
  'handoffs',
  'energyByDate',
  'cooked',
  'shuffleSeen',
] as const
type Snapshot = Pick<PlantryState, (typeof keys)[number]>

function snapshot(): Snapshot {
  const s = useStore.getState()
  return Object.fromEntries(keys.map((k) => [k, s[k]])) as Snapshot
}

/**
 * Run a destructive change and show a toast with Undo. Every collection in the store
 * is replaced immutably, so keeping the previous references is a full, cheap snapshot.
 */
export function withUndo(message: string, change: () => void) {
  const before = snapshot()
  change()
  toast(message, {
    action: {
      label: 'Undo',
      onClick: () => {
        useStore.setState(before)
        toast('Put back')
      },
    },
  })
}
