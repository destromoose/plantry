'use client'

import { t } from '@/lib/i18n'

import { useEffect, useState } from 'react'
import { ExternalLink, Share, SquarePlus } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { fingerprint, isLegacyOrigin, isPlantryKey, SITE_ORIGIN } from '@/lib/site'

// On Plantry's old address: once the new address is live, hand this phone's saved data over
// and continue there. Browsers keep saved data per address, so without this people would
// arrive at the new address to an empty kitchen.

type Phase = { kind: 'idle' } | { kind: 'moving' } | { kind: 'app'; href: string }

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const isIos = () => {
  const ua = navigator.userAgent
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
}

/** Is the new address set up and serving Plantry? */
async function newHomeReady(): Promise<boolean> {
  try {
    const res = await fetch(`${SITE_ORIGIN}/api/move`, { mode: 'cors', cache: 'no-store' })
    if (!res.ok) return false
    const body = (await res.json()) as { app?: string }
    return body.app === 'plantry'
  } catch {
    return false
  }
}

function collect(): Record<string, string> {
  const items: Record<string, string> = {}
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && isPlantryKey(k)) keys.push(k)
    }
    for (const k of keys.sort()) items[k] = localStorage.getItem(k) ?? ''
  } catch {
    /* storage blocked: nothing to bring */
  }
  return items
}

const toBase64Url = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Without server storage, the data can ride in the link itself (never sent to a server). */
async function inLink(text: string): Promise<string | null> {
  if (typeof CompressionStream === 'undefined') return null
  try {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
    const packed = toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))
    return packed.length < 1_500_000 ? packed : null
  } catch {
    return null
  }
}

/** Builds the link that opens the new address with this phone's data. */
async function handover(from: 'web' | 'app'): Promise<string | null> {
  const here = window.location
  const params = new URLSearchParams({ next: here.pathname + here.search, from })
  const items = collect()
  const base = `${SITE_ORIGIN}/move.html?${params}`
  // Nothing saved yet: just continue at the new address.
  if (!items['plantry-v1']) return base
  const text = JSON.stringify({ items, fp: fingerprint(JSON.stringify(items)) })
  try {
    const res = await fetch('/api/move', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: text,
      cache: 'no-store',
    })
    if (res.ok) {
      const { token } = (await res.json()) as { token?: string }
      if (token) return `${base}#t=${token}`
    }
  } catch {
    /* try the link instead */
  }
  const packed = await inLink(text)
  return packed ? `${base}#d=${packed}` : null
}

export function SiteMove() {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })

  useEffect(() => {
    if (!isLegacyOrigin(window.location.origin)) return
    let cancelled = false
    ;(async () => {
      if (!(await newHomeReady()) || cancelled) return
      const app = isStandalone()
      setPhase({ kind: 'moving' })
      // Let any change still waiting to be saved land first.
      await new Promise((r) => setTimeout(r, 400))
      const href = await handover(app ? 'app' : 'web')
      if (cancelled) return
      if (!href) return setPhase({ kind: 'idle' })
      if (app) setPhase({ kind: 'app', href })
      else window.location.replace(href)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (phase.kind === 'idle') return null

  const host = new URL(SITE_ORIGIN).host

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-move-title"
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-canvas px-6 py-10"
    >
      <div className="w-full max-w-sm text-center">
        <Logo className="mb-6 justify-center text-accent" />
        {phase.kind === 'moving' ? (
          <>
            <h1 id="site-move-title" className="font-display text-2xl font-semibold text-ink">
              {t('Plantry has a new home')}
            </h1>
            <p className="mt-2 text-ink-2" aria-live="polite">
              {t('Bringing your kitchen over to {v0}…', { v0: host })}
            </p>
          </>
        ) : (
          <>
            <h1 id="site-move-title" className="font-display text-2xl font-semibold text-ink">
              {t('Plantry has a new home')}
            </h1>
            <p className="mt-2 text-ink-2">
              {t(
                'Plantry now lives at {v0}. Your plan, pantry, recipes and history are packed and ready to come with you.',
                { v0: host }
              )}
            </p>
            <a
              href={phase.href}
              target="_blank"
              rel="noopener"
              className="mt-6 inline-flex h-14 w-full items-center justify-center gap-2 rounded-pill bg-accent px-7 font-medium text-accent-ink shadow-card"
            >
              {t('Open the new Plantry')}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
            <div className="card mt-6 p-5 text-left">
              <h2 className="font-display text-lg font-semibold text-ink">
                {t('Then swap the icon')}
              </h2>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-ink-2">
                {isIos() ? (
                  <>
                    <li>
                      {t('In Safari, tap Share')}{' '}
                      <Share className="inline h-4 w-4 align-[-2px]" aria-hidden />{' '}
                      {t('and choose Add to Home Screen')}{' '}
                      <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden />.
                    </li>
                  </>
                ) : (
                  <li>{t('In your browser menu, choose Install app or Add to Home screen.')}</li>
                )}
                <li>{t('Delete this old Plantry icon. Everything is in the new one.')}</li>
              </ol>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
