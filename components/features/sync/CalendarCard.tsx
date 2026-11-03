'use client'

import { getLang, t } from '@/lib/i18n'

import { useEffect, useState } from 'react'
import { CalendarPlus, Copy } from 'lucide-react'
import { startSharing, useSync } from '@/lib/sync'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'

/** Subscribe once and every planned dinner, with who's cooking, shows in the phone's calendar. */
export function CalendarCard() {
  const sync = useSync()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [feed, setFeed] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    fetch('/api/sync', { cache: 'no-store' })
      .then((r) => r.json())
      .then((b: { enabled?: boolean }) => live && setEnabled(!!b.enabled))
      .catch(() => live && setEnabled(null))
    return () => {
      live = false
    }
  }, [])

  if (enabled === false) return null

  async function getLink() {
    setBusy(true)
    try {
      // The calendar reads the shared plan, so sharing has to be on first.
      const code = sync.code ?? (await startSharing())
      if (!code) throw new Error(t('Could not make a calendar link just now. Try again.'))
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const body = (await res.json()) as { token?: string }
      if (!res.ok || !body.token)
        throw new Error(t('Could not make a calendar link just now. Try again.'))
      const lang = getLang() === 'es' ? '?lang=es' : ''
      setFeed(`${window.location.host}/api/calendar/${body.token}.ics${lang}`)
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const https = feed ? `https://${feed}` : ''
  const webcal = feed ? `webcal://${feed}` : ''

  async function copy() {
    try {
      await navigator.clipboard.writeText(https)
      toast(t('Calendar link copied'))
    } catch {
      toast(https)
    }
  }

  return (
    <Card>
      <SectionTitle as="h3">{t('Dinners in your calendar')}</SectionTitle>
      <p className="text-[0.9375rem] text-ink-2">
        {t(
          "See what's for dinner and who's cooking without opening Plantry. On mornings when something needs to come out of the freezer, the calendar says so."
        )}
      </p>
      {!sync.code && (
        <p className="mt-2 text-sm text-ink-3">
          {t('This turns on sharing for your household, so the calendar can read the plan.')}
        </p>
      )}
      <div className="mt-4">
        <Button variant="secondary" onClick={getLink} disabled={busy}>
          <CalendarPlus className="h-4 w-4" aria-hidden />
          {busy ? t('Making the link…') : t('Put dinners in my calendar')}
        </Button>
      </div>

      <Sheet open={!!feed} onClose={() => setFeed(null)} title={t('Add to your calendar')}>
        <p className="mb-5 text-ink-2">
          {t(
            'Pick your calendar. It updates by itself when the plan changes. Anyone you give the link to can see the plan, but not change it.'
          )}
        </p>
        <div className="flex flex-col gap-2">
          <a href={webcal} className={buttonVariants({ variant: 'primary' })}>
            {t('Apple Calendar or Outlook')}
          </a>
          <a
            href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: 'secondary' })}
          >
            {t('Google Calendar')}
          </a>
          <Button variant="ghost" onClick={copy}>
            <Copy className="h-4 w-4" aria-hidden /> {t('Copy the link')}
          </Button>
        </div>
      </Sheet>
    </Card>
  )
}
