'use client'

import { t } from '@/lib/i18n'

import { Component, type ReactNode } from 'react'
import { downloadText, readRawSaved } from '@/lib/storage'

const KEY = 'plantry-v1'

/**
 * Last line of defence. If anything throws while rendering, show a calm screen that
 * lets people keep a copy of their data and start again, instead of a blank error page.
 * It deliberately uses no store or context, since those may be what broke.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {}

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Plantry crashed:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    const download = () => {
      const raw = readRawSaved(KEY) ?? '{}'
      downloadText(`plantry-saved-data-${new Date().toISOString().slice(0, 10)}.json`, raw)
    }
    const startFresh = () => {
      try {
        const raw = window.localStorage.getItem(KEY)
        if (raw) window.localStorage.setItem(`${KEY}-before-reset-${Date.now()}`, raw)
        window.localStorage.removeItem(KEY)
      } catch {}
      window.location.assign('/')
    }
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-6 py-12">
        <h1 className="font-display text-fluid-2xl font-semibold leading-tight tracking-tight">
          {t('Something went wrong.')}
        </h1>
        <p className="text-ink-2">
          {t(
            'Plantry hit a problem reading your saved data. Your data is still on this device. Download a copy first, then try again or start fresh.'
          )}
        </p>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={download}
            className="min-h-[48px] rounded-pill bg-accent px-5 font-semibold text-accent-ink"
          >
            {t('Download my data')}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[48px] rounded-pill border border-line bg-surface px-5 font-semibold text-ink"
          >
            {t('Try again')}
          </button>
          <button
            type="button"
            onClick={startFresh}
            className="min-h-[48px] rounded-pill px-5 font-semibold text-danger"
          >
            {t('Start fresh (keeps a backup)')}
          </button>
        </div>
      </main>
    )
  }
}
