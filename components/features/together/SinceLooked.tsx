'use client'

import { t } from '@/lib/i18n'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { BellRing, Sparkles } from 'lucide-react'
import { useStore } from '@/lib/store'
import { notifyOn, notifySupported, setNotify } from '@/lib/notify'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { timeAgo } from './Notes'

/** Activity this person hasn't seen yet. */
export function useFreshActivity() {
  const activity = useStore((s) => s.activity)
  const seenAt = useStore((s) => s.activitySeenAt)
  return activity.filter((a) => !seenAt || a.at > seenAt)
}

/** What the others changed since this person last looked, so nobody has to ask "did you see?". */
export function SinceLooked() {
  const members = useStore((s) => s.members)
  const markSeen = useStore((s) => s.markActivitySeen)
  const fresh = useFreshActivity()
  if (members.length < 2 || fresh.length === 0) return null
  const shown = fresh.slice(0, 5)
  return (
    <section className="card p-4" aria-labelledby="since-title">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent" aria-hidden />
        <h2 id="since-title" className="font-display text-lg font-semibold">
          {t('Since you last looked')}
        </h2>
      </div>
      <ul className="space-y-1">
        {shown.map((a) => {
          const by = members.find((m) => m.id === a.by)
          const row = (
            <span className="flex min-h-[44px] items-center gap-3">
              {by ? <Avatar member={by} size="sm" /> : <span className="h-6 w-6 shrink-0" />}
              <span className={cn('min-w-0 flex-1 text-[0.9375rem]', a.forMe && 'font-semibold')}>
                {a.text}
              </span>
              <span className="shrink-0 text-xs text-ink-3">{timeAgo(a.at)}</span>
            </span>
          )
          return (
            <li key={a.id}>
              {a.href ? (
                <Link href={a.href} className="block rounded-lg px-1 hover:bg-surface-2">
                  {row}
                </Link>
              ) : (
                <div className="px-1">{row}</div>
              )}
            </li>
          )
        })}
      </ul>
      {fresh.length > shown.length && (
        <p className="mt-1 px-1 text-sm text-ink-3">
          {t('and {n} more', { n: fresh.length - shown.length })}
        </p>
      )}
      <Button variant="secondary" size="sm" className="mt-3" onClick={markSeen}>
        {t('Got it')}
      </Button>
    </section>
  )
}

/** On this device: alert me when something concerns me. */
export function NotifyToggle() {
  const [on, setOn] = useState(false)
  const [supported, setSupported] = useState(true)
  useEffect(() => {
    setSupported(notifySupported())
    setOn(notifyOn())
  }, [])
  if (!supported) return null
  return (
    <div className="mt-4 flex items-start gap-3 border-t border-line pt-3">
      <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-ink-3" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t('Alerts that concern you')}</p>
        <p className="text-sm text-ink-2">
          {t(
            'Only a reply to your note, a night handed to you, or something added while you shop. Never the rest.'
          )}
        </p>
      </div>
      <Button
        variant={on ? 'secondary' : 'outline'}
        size="sm"
        aria-pressed={on}
        onClick={async () => setOn(await setNotify(!on))}
      >
        {on ? t('On') : t('Off')}
      </Button>
    </div>
  )
}
