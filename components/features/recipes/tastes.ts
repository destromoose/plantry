import { t } from '@/lib/i18n'
import type { Taste } from '@/lib/types'

export const tasteLabels: Record<Taste, string> = {
  cozy: t('Cozy'),
  fresh: t('Fresh'),
  fast: t('Fast'),
  'one-pan': t('One pan'),
  'veg-forward': t('Mostly veg'),
  spicy: t('Spicy'),
  'big-batch': t('Big batch'),
  'kid-friendly': t('Kid-friendly'),
}

export const allTastes = Object.keys(tasteLabels) as Taste[]
