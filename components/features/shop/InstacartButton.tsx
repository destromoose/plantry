'use client'

import { t } from '@/lib/i18n'

import { useEffect, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useStore } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'

/** Send what's left on the list to Instacart. Shown only when this copy of Plantry has a key. */
export function InstacartButton() {
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)
  const left = useStore((s) => s.shop.filter((i) => !i.checked).length)

  useEffect(() => {
    let live = true
    fetch('/api/instacart', { cache: 'no-store' })
      .then((r) => r.json())
      .then((b: { enabled?: boolean }) => live && setEnabled(!!b.enabled))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  if (!enabled || left === 0) return null

  async function order() {
    // Open the tab now, while the tap still counts, so it isn't blocked as a pop-up.
    const tab = window.open('', '_blank')
    setBusy(true)
    try {
      const items = useStore
        .getState()
        .shop.filter((i) => !i.checked)
        .map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit }))
      const res = await fetch('/api/instacart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, title: t('Shopping list') }),
      })
      const body = (await res.json()) as { url?: string }
      if (!res.ok || !body.url) throw new Error()
      if (tab) tab.location.href = body.url
      else window.location.href = body.url
    } catch {
      tab?.close()
      toast(t("Instacart didn't answer. Try again in a minute."), { tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Button variant="secondary" onClick={order} disabled={busy}>
      <ShoppingCart className="h-4 w-4" aria-hidden />{' '}
      {busy ? t('Opening Instacart…') : t('Order on Instacart')}
    </Button>
  )
}
