'use client'

import { t } from '@/lib/i18n'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Copy, RefreshCw, Share2, Users } from 'lucide-react'
import { leaveHousehold, startSharing, syncNow, useSync } from '@/lib/sync'
import { formatCode } from '@/lib/syncCode'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'

function ago(iso?: string) {
  if (!iso) return ''
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return t('just now')
  const m = Math.round(s / 60)
  if (m < 60) return t('{m} min ago', { m })
  const h = Math.round(m / 60)
  return h < 24 ? t('{h} h ago', { h }) : new Date(iso).toLocaleDateString()
}

/** Share the household's plan, pantry, list and recipes between phones. */
export function SyncCard() {
  const sync = useSync()
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [, rerender] = useState(0)

  useEffect(() => {
    let live = true
    fetch('/api/sync', { cache: 'no-store' })
      .then((r) => r.json())
      .then((b: { enabled?: boolean }) => live && setEnabled(!!b.enabled))
      .catch(() => live && setEnabled(null))
    // Keep "synced 2 min ago" fresh.
    const id = setInterval(() => rerender((n) => n + 1), 30_000)
    return () => {
      live = false
      clearInterval(id)
    }
  }, [])

  async function share() {
    setBusy(true)
    try {
      await startSharing()
      toast(t('Shared. Send the code to the people you live with.'))
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  const link = sync.code
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join?code=${sync.code}`
    : ''

  async function invite() {
    if (!sync.code) return
    const text = t('Join our Plantry household: {link} (code {v1})', {
      link,
      v1: formatCode(sync.code),
    })
    try {
      if (navigator.share) {
        await navigator.share({ title: t('Plantry'), text, url: link })
        return
      }
      await navigator.clipboard.writeText(text)
      toast(t('Invite copied. Paste it into a message.'))
    } catch (e) {
      if ((e as Error).name !== 'AbortError')
        toast(t('The code is {v0}', { v0: formatCode(sync.code) }))
    }
  }

  const status =
    sync.status === 'syncing'
      ? t('Syncing…')
      : sync.status === 'offline'
        ? t('Offline. Changes stay on this phone and sync when you are back online.')
        : sync.status === 'error'
          ? (sync.error ?? t('Could not sync just now. It tries again by itself.'))
          : sync.lastSyncedAt
            ? t('Up to date, synced {v0}.', { v0: ago(sync.lastSyncedAt) })
            : t('Up to date.')

  return (
    <Card id="sharing" className="scroll-mt-24">
      <SectionTitle as="h3">{t('Share with your household')}</SectionTitle>
      {sync.code ? (
        <>
          <p className="text-[0.9375rem] text-ink-2">
            {t(
              'This phone shares the plan, pantry, list, recipes and history. Other phones join with this code:'
            )}
          </p>
          <p
            className="my-4 select-all text-center font-display text-3xl font-semibold tabular-nums tracking-[0.08em]"
            aria-label={t('Household code {v0}', { v0: sync.code.split('').join(' ') })}
          >
            {formatCode(sync.code)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={invite}>
              {typeof navigator !== 'undefined' && 'share' in navigator ? (
                <Share2 className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {t('Invite someone')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => void syncNow()}
              disabled={sync.status === 'syncing'}
            >
              <RefreshCw className="h-4 w-4" aria-hidden /> {t('Sync now')}
            </Button>
          </div>
          <p className="mt-3 text-sm text-ink-3" role="status">
            {status}
          </p>
          <div className="mt-4 border-t border-line pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2 text-ink-2"
              onClick={() => setLeaving(true)}
            >
              {t('Stop sharing on this phone')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[0.9375rem] text-ink-2">
            {t(
              "Put the plan, pantry, list and recipes on everyone's phone. A change on one shows up on the others within seconds."
            )}
          </p>
          {sync.error && <p className="mt-2 text-sm text-danger">{sync.error}</p>}
          {enabled === false ? (
            <p className="mt-3 text-sm text-ink-3">
              {t("Sharing between phones isn't switched on for this copy of Plantry yet.")}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={share} disabled={busy}>
                <Users className="h-4 w-4" aria-hidden />{' '}
                {busy ? t('Sharing…') : t('Share from this phone')}
              </Button>
              <Link
                href="/join"
                className="inline-flex h-11 items-center rounded-pill px-5 text-[0.9375rem] font-medium text-ink-2 hover:bg-surface-2"
              >
                {t('I have a code')}
              </Link>
            </div>
          )}
          <p className="mt-3 text-sm text-ink-3">
            {t(
              "Your household's data is kept on Plantry's server under a private 12-letter code. Anyone with the code can see and change it, so only send it to people you live with. No accounts, no email."
            )}
          </p>
        </>
      )}

      <Sheet
        open={leaving}
        onClose={() => setLeaving(false)}
        title={t('Stop sharing on this phone?')}
      >
        <p className="mb-5 text-ink-2">
          {t(
            'Everything stays on this phone, but it stops getting changes from the others. The other phones keep sharing. You can join again with the code.'
          )}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            onClick={() => {
              leaveHousehold()
              setLeaving(false)
              toast(t('Stopped sharing on this phone'))
            }}
          >
            {t('Stop sharing')}
          </Button>
          <Button variant="ghost" onClick={() => setLeaving(false)}>
            {t('Keep sharing')}
          </Button>
        </div>
      </Sheet>
    </Card>
  )
}
