'use client'

import { t } from '@/lib/i18n'

import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { InstallCard } from '@/components/shell/InstallCard'
import { NEW_HOME_KEY, SITE_ORIGIN } from '@/lib/site'

/** Says welcome once after someone arrives from Plantry's old address with their data. */
export function NewHomeNote() {
  const [from, setFrom] = useState<'web' | 'app' | null>(null)

  useEffect(() => {
    try {
      const v = localStorage.getItem(NEW_HOME_KEY)
      if (v === 'web' || v === 'app') setFrom(v)
    } catch {
      /* nothing to say */
    }
  }, [])

  const close = () => {
    try {
      localStorage.removeItem(NEW_HOME_KEY)
    } catch {}
    setFrom(null)
  }

  const host = new URL(SITE_ORIGIN).host

  return (
    <Sheet open={from !== null} onClose={close} title={t('Welcome to Plantry’s new home')}>
      <p className="text-ink-2">
        {t('Plantry now lives at {v0}. Your plan, pantry, recipes and history came with you.', {
          v0: host,
        })}
      </p>
      {from === 'app' && (
        <div className="mt-4 space-y-3">
          <InstallCard />
          <p className="text-sm text-ink-3">
            {t('Once the new icon is on your home screen, you can delete the old one.')}
          </p>
        </div>
      )}
      <Button className="mt-5 w-full" size="lg" onClick={close}>
        {t('Got it')}
      </Button>
    </Sheet>
  )
}
