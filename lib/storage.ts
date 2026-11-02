'use client'

import { create } from 'zustand'
import type { PersistStorage, StorageValue } from 'zustand/middleware'

// A careful wrapper around localStorage for the persisted store:
// - unreadable saved data is backed up and skipped instead of hanging the app,
// - writes are batched so a burst of changes is one write,
// - a full or blocked storage is reported instead of silently losing changes,
// - if localStorage is unavailable the app still runs from memory.

export interface StorageStatus {
  /** Saved data could not be read and was set aside under this key. */
  backupKey?: string
  /** Some saved items had the wrong shape and were skipped. */
  droppedItems: number
  /** The last write failed. */
  writeError?: 'full' | 'blocked'
  /** Storage is not available at all, so nothing is kept after closing the tab. */
  memoryOnly: boolean
  /** Approximate bytes used by Plantry's saved data. */
  bytes: number
}

export const useStorageStatus = create<StorageStatus>(() => ({
  droppedItems: 0,
  memoryOnly: false,
  bytes: 0,
}))

const memory = new Map<string, string>()

function backend(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  try {
    const ls = window.localStorage
    const probe = '__plantry_probe__'
    ls.setItem(probe, '1')
    ls.removeItem(probe)
    return ls
  } catch {
    useStorageStatus.setState({ memoryOnly: true })
    return {
      getItem: (k) => memory.get(k) ?? null,
      setItem: (k, v) => void memory.set(k, v),
      removeItem: (k) => void memory.delete(k),
    }
  }
}

function isQuotaError(e: unknown) {
  return (
    e instanceof DOMException &&
    (e.name === 'QuotaExceededError' || e.code === 22 || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

type Listener = (status: StorageStatus['writeError']) => void
let onWriteError: Listener | undefined
export function setWriteErrorListener(fn: Listener) {
  onWriteError = fn
}

export function createSafeStorage<S>(delayMs = 200): PersistStorage<S> & { flush: () => void } {
  let store: ReturnType<typeof backend> | undefined
  const get = () => (store ??= backend())
  let pending: { name: string; text: string } | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const write = () => {
    timer = undefined
    if (!pending) return
    const { name, text } = pending
    pending = undefined
    try {
      // Skip identical writes: this also stops two open tabs echoing each other forever.
      if (get().getItem(name) === text) return
      get().setItem(name, text)
      useStorageStatus.setState({ bytes: text.length * 2 })
      if (useStorageStatus.getState().writeError)
        useStorageStatus.setState({ writeError: undefined })
    } catch (e) {
      const kind = isQuotaError(e) ? 'full' : 'blocked'
      useStorageStatus.setState({ writeError: kind })
      onWriteError?.(kind)
    }
  }

  if (typeof window !== 'undefined') {
    const flushNow = () => {
      if (timer) clearTimeout(timer)
      write()
    }
    window.addEventListener('pagehide', flushNow)
    document.addEventListener(
      'visibilitychange',
      () => document.visibilityState === 'hidden' && flushNow()
    )
  }

  return {
    getItem: (name) => {
      let text: string | null
      try {
        text = get().getItem(name)
      } catch {
        return null
      }
      if (text === null) return null
      useStorageStatus.setState({ bytes: text.length * 2 })
      try {
        const parsed = JSON.parse(text) as StorageValue<S>
        if (!parsed || typeof parsed !== 'object' || !('state' in parsed))
          throw new Error('not a saved state')
        return parsed
      } catch {
        // Keep the unreadable copy so nothing is lost for good, then start clean.
        const backupKey = `${name}-unreadable-${Date.now()}`
        try {
          get().setItem(backupKey, text)
          get().removeItem(name)
        } catch {}
        useStorageStatus.setState({ backupKey })
        return null
      }
    },
    setItem: (name, value) => {
      let text: string
      try {
        text = JSON.stringify(value)
      } catch {
        return
      }
      pending = { name, text }
      if (!timer) timer = setTimeout(write, delayMs)
    },
    removeItem: (name) => {
      pending = undefined
      try {
        get().removeItem(name)
      } catch {}
    },
    flush: () => {
      if (timer) clearTimeout(timer)
      write()
    },
  }
}

/** Raw saved text, for "Download my data" when the app cannot start. */
export function readRawSaved(name: string): string | null {
  try {
    return window.localStorage.getItem(name)
  } catch {
    return memory.get(name) ?? null
  }
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
