'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'
import { addDays, toDateKey } from '@/lib/utils'

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<unknown> }

// Chrome fires beforeinstallprompt once, early, on whatever screen is open.
// Keep it here (mounted on every page) so the Settings card can use it later.
let deferred: PromptEvent | null = null
const listeners = new Set<(e: PromptEvent | null) => void>()

export function getInstallPrompt() {
  return deferred
}

export function onInstallPrompt(fn: (e: PromptEvent | null) => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

export function clearInstallPrompt() {
  deferred = null
  listeners.forEach((fn) => fn(null))
}

/** Registers the offline service worker in production, and saves recipe and cook pages for offline. */
export function ServiceWorker() {
  const recipeIds = useStore((s) => s.recipes.map((r) => r.id).join(','))
  // Cook links from Tonight and Week carry the plan date, and cook mode reads it from the URL
  // the page was rendered for. Save those exact URLs so cooking a planned dinner offline still
  // marks that night as cooked.
  const plannedCooks = useStore((s) => {
    const today = toDateKey(new Date())
    const last = addDays(today, 14)
    return s.plan
      .filter((p) => p.slot === 'dinner' && p.recipeId && p.date >= today && p.date <= last)
      .map((p) => `/cook/${encodeURIComponent(p.recipeId!)}?date=${p.date}`)
      .join(',')
  })

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      deferred = e as PromptEvent
      listeners.forEach((fn) => fn(deferred))
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', clearInstallPrompt)
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator)
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {})
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', clearInstallPrompt)
    }
  }, [])

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator) || !recipeIds)
      return
    const urls = [
      ...(plannedCooks ? plannedCooks.split(',') : []),
      ...recipeIds.split(',').flatMap((id) => {
        const e = encodeURIComponent(id)
        return [`/recipes/${e}`, `/cook/${e}`]
      }),
    ]
    // Wait for a quiet moment so warming never competes with the first screen.
    const t = window.setTimeout(() => {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: 'warm', urls }))
        .catch(() => {})
    }, 4000)
    return () => window.clearTimeout(t)
  }, [recipeIds, plannedCooks])

  return null
}
