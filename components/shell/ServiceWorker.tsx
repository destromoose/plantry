'use client'

import { useEffect } from 'react'
import { useStore } from '@/lib/store'

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
    const urls = recipeIds.split(',').flatMap((id) => {
      const e = encodeURIComponent(id)
      return [`/recipes/${e}`, `/cook/${e}`]
    })
    // Wait for a quiet moment so warming never competes with the first screen.
    const t = window.setTimeout(() => {
      navigator.serviceWorker.ready
        .then((reg) => reg.active?.postMessage({ type: 'warm', urls }))
        .catch(() => {})
    }, 4000)
    return () => window.clearTimeout(t)
  }, [recipeIds])

  return null
}
