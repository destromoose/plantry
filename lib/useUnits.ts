'use client'

import { useStore } from './store'
import type { UnitSystem } from './quantity'

/** The household's unit system, for showing amounts and oven temperatures. */
export const useUnits = (): UnitSystem => useStore((s) => s.settings.units)
