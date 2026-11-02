'use client'

import type { TimerState } from '@/components/features/cook/useTimers'

// The cook session lives outside the main store: it changes every second while a
// timer runs, and only matters for the dinner being cooked right now.

export interface CookSession {
  recipeId: string
  date?: string
  index: number
  servings?: number
  timers: Record<string, TimerState>
  savedAt: number
}

const KEY = 'plantry-cook'
const MAX_AGE = 12 * 60 * 60 * 1000

export function loadCookSession(recipeId?: string): CookSession | undefined {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return undefined
    const s = JSON.parse(raw) as CookSession
    if (!s || typeof s.index !== 'number' || Date.now() - s.savedAt > MAX_AGE) return undefined
    if (recipeId && s.recipeId !== recipeId) return undefined
    return s
  } catch {
    return undefined
  }
}

export function saveCookSession(s: Omit<CookSession, 'savedAt'>) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...s, savedAt: Date.now() }))
  } catch {
    /* progress is a nicety */
  }
}

export function clearCookSession() {
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
