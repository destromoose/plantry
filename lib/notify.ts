'use client'

// Alerts only for what concerns you: a reply to your note, a night handed to you, something
// added while you're at the shop. Shown by the browser when Plantry isn't the tab in front.
// Turned on per device; nothing is sent anywhere.

import type { Activity } from './activity'
import { t } from './i18n'

const KEY = 'plantry-notify'

export function notifySupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notifyOn(): boolean {
  try {
    return (
      notifySupported() &&
      Notification.permission === 'granted' &&
      localStorage.getItem(KEY) === '1'
    )
  } catch {
    return false
  }
}

/** Ask the browser, then remember the choice on this device. */
export async function setNotify(on: boolean): Promise<boolean> {
  try {
    if (!on) {
      localStorage.removeItem(KEY)
      return false
    }
    if (!notifySupported()) return false
    const p =
      Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission
    if (p !== 'granted') return false
    localStorage.setItem(KEY, '1')
    return true
  } catch {
    return false
  }
}

export function notifyForMe(fresh: Activity[]) {
  if (typeof document === 'undefined' || document.visibilityState === 'visible' || !notifyOn())
    return
  const mine = fresh.filter((a) => a.forMe)
  if (!mine.length) return
  try {
    const n = new Notification(t('Plantry'), {
      body: mine.length === 1 ? mine[0].text : mine.map((a) => a.text).join('\n'),
      tag: 'plantry-household',
    })
    n.onclick = () => {
      window.focus()
      if (mine[0].href) window.location.assign(mine[0].href)
      n.close()
    }
  } catch {
    /* some browsers only allow alerts from a service worker; the card still shows it */
  }
}
