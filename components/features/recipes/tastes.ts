import type { Taste } from '@/lib/types'

export const tasteLabels: Record<Taste, string> = {
  cozy: 'Cozy',
  fresh: 'Fresh',
  fast: 'Fast',
  'one-pan': 'One pan',
  'veg-forward': 'Veg-forward',
  spicy: 'Spicy',
  'big-batch': 'Big batch',
  'kid-friendly': 'Kid-friendly',
}

export const allTastes = Object.keys(tasteLabels) as Taste[]
