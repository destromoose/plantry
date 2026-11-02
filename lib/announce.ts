'use client'

/** Say something to screen readers without moving focus. */
export function announce(text: string) {
  const el = typeof document !== 'undefined' ? document.getElementById('announcer') : null
  if (!el) return
  // Clear first so the same words are read again.
  el.textContent = ''
  window.setTimeout(() => (el.textContent = text), 50)
}
