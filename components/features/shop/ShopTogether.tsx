'use client'

import { t } from '@/lib/i18n'

import { useEffect, useState } from 'react'
import { Scissors, ShoppingCart } from 'lucide-react'
import { useStore } from '@/lib/store'
import { activeTrip } from '@/lib/shopTogether'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { toast } from '@/components/ui/Toast'

/** Re-render every minute so a trip that ran out of time disappears on its own. */
export function useNow(everyMs = 60_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

export function useTrip() {
  const trip = useStore((s) => s.shopTrip)
  const now = useNow()
  return activeTrip(trip, now)
}

/** "I'm at the shop", who's out shopping, and splitting the list between two people. */
export function ShopTogether({
  mineOnly,
  setMineOnly,
}: {
  mineOnly: boolean
  setMineOnly: (v: boolean) => void
}) {
  const members = useStore((s) => s.members)
  const shop = useStore((s) => s.shop)
  const start = useStore((s) => s.startShopTrip)
  const end = useStore((s) => s.endShopTrip)
  const split = useStore((s) => s.splitShop)
  const clearSplit = useStore((s) => s.clearSplit)
  const trip = useTrip()
  if (members.length < 2) return null

  const me = members.find((m) => m.isMe)
  const shopper = trip && members.find((m) => m.id === trip.by)
  const mine = !!trip && trip.by === me?.id
  const open = shop.filter((i) => !i.checked)
  const isSplit = shop.some((i) => i.splitTo)
  const myCount = open.filter((i) => !i.splitTo || i.splitTo === me?.id).length
  const since = trip
    ? new Date(trip.since).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : ''

  return (
    <section
      aria-label={t('Shopping together')}
      className={cn('card mb-5 p-4', trip && 'border-accent/40 bg-accent/5')}
    >
      {trip ? (
        <div className="flex flex-wrap items-center gap-3">
          {shopper && <Avatar member={shopper} />}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink" aria-live="polite">
              {mine
                ? t("You're at the shop")
                : t('{name} is at the shop', { name: shopper?.name ?? t('Someone') })}
            </p>
            <p className="text-xs text-ink-3">{t('since {time}', { time: since })}</p>
            <p className="text-sm text-ink-2">
              {mine
                ? t('Anything the others add shows up here, marked New.')
                : t('Add anything now and it goes straight onto their list.')}
            </p>
          </div>
          {mine && (
            <Button variant="secondary" size="sm" onClick={end}>
              {t("I'm done")}
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              start()
              toast(t("The others can see you're at the shop"))
            }}
          >
            <ShoppingCart className="h-4 w-4" aria-hidden /> {t("I'm at the shop")}
          </Button>
          {!isSplit && open.length >= 4 && (
            <Button
              variant="secondary"
              onClick={() => {
                const n = split()
                if (n) toast(t('Split by aisle. Each of you has your own part of the shop.'))
              }}
            >
              <Scissors className="h-4 w-4" aria-hidden /> {t('Split the list')}
            </Button>
          )}
        </div>
      )}
      {isSplit && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Chip size="sm" selected={mineOnly} onClick={() => setMineOnly(true)}>
            {t('Just mine ({n})', { n: myCount })}
          </Chip>
          <Chip size="sm" selected={!mineOnly} onClick={() => setMineOnly(false)}>
            {t('Everything ({n})', { n: open.length })}
          </Chip>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              clearSplit()
              setMineOnly(false)
            }}
          >
            {t('Undo split')}
          </Button>
        </div>
      )}
    </section>
  )
}
