'use client'

import { t } from '@/lib/i18n'

import { memo, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, ListChecks, Pencil, Plus, Share2, ShoppingBasket, Trash2, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { formatMoney, shopCost } from '@/lib/cost'
import { formatAmounts, niceNumber, parseAmount } from '@/lib/quantity'
import { useTapGuard } from '@/lib/useTapGuard'
import { withUndo } from '@/lib/undo'
import { useAppContext } from '@/components/shell/Providers'
import { cn, pluralize, weekOf } from '@/lib/utils'
import { checkPop, reveal, settle } from '@/lib/motion'
import type { Aisle, ShopItem } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Label, Textarea } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { toast } from '@/components/ui/Toast'
import { CaptureForm, Usuals } from './Capture'
import { InstacartButton } from './InstacartButton'

const aisles: { id: Aisle; label: string }[] = [
  { id: 'produce', label: t('Produce') },
  { id: 'meat-fish', label: t('Meat and fish') },
  { id: 'dairy', label: t('Dairy') },
  { id: 'bakery', label: t('Bakery') },
  { id: 'pantry', label: t('Pantry') },
  { id: 'frozen', label: t('Frozen') },
  { id: 'spices', label: t('Spices') },
  { id: 'drinks', label: t('Drinks') },
  { id: 'other', label: t('Other') },
]

export function Shop() {
  const shop = useStore((s) => s.shop)
  const recipes = useStore((s) => s.recipes)
  const generateShop = useStore((s) => s.generateShop)
  const addShopItem = useStore((s) => s.addShopItem)
  const finishShopping = useStore((s) => s.finishShopping)
  const clearChecked = useStore((s) => s.clearChecked)
  const dismissed = useStore((s) => s.shopDismissed)
  const restoreDismissed = useStore((s) => s.restoreDismissed)
  const clearShop = useStore((s) => s.clearShop)
  const { targetDate } = useAppContext()
  const [copyFallback, setCopyFallback] = useState<string | null>(null)
  const [editing, setEditing] = useState<ShopItem | null>(null)

  const titles = useMemo(() => new Map(recipes.map((r) => [r.id, r.title])), [recipes])
  const unchecked = shop.filter((i) => !i.checked).length
  const checked = shop.length - unchecked
  const currency = useStore((s) => s.settings.currency)
  const priceLevel = useStore((s) => s.settings.priceLevel)
  const cost = useMemo(() => shopCost(shop, { currency, priceLevel }), [shop, currency, priceLevel])

  const groups = useMemo(
    () =>
      aisles
        .map((a) => {
          const items = shop.filter((i) => i.aisle === a.id)
          return {
            ...a,
            items: [...items.filter((i) => !i.checked), ...items.filter((i) => i.checked)],
          }
        })
        .filter((g) => g.items.length > 0),
    [shop]
  )

  function fromPlan() {
    // The same week as the Week screen: the one holding the dinner Tonight is about.
    const res = generateShop(weekOf(targetDate))
    if (res.kept)
      toast(t('Nothing planned for the rest of this week, so your list stayed as it is.'))
    else if (res.fromPlan === 0) toast(t('Your pantry covers everything planned this week.'))
    else toast(t("{v0} for this week's dinners", { v0: pluralize(res.fromPlan, 'item') }))
  }

  function listText() {
    return groups
      .map((g) => {
        const left = g.items.filter((i) => !i.checked)
        if (!left.length) return ''
        return `${g.label}\n${left.map((i) => `- ${i.name}${amountText(i) ? ` (${amountText(i)})` : ''}`).join('\n')}`
      })
      .filter(Boolean)
      .join('\n\n')
  }

  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function shareList() {
    const text = listText()
    if (canShare) {
      try {
        await navigator.share({ title: t('Shopping list'), text })
        return
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(text)
      toast(t('Copied. Paste it into a message or a note.'))
    } catch {
      // Some browsers block the clipboard. Show the list so it can be copied by hand.
      setCopyFallback(text)
    }
  }

  const planButton = (
    <Button variant="secondary" onClick={fromPlan}>
      <ListChecks className="h-4 w-4" aria-hidden /> {t("Add from this week's plan")}
    </Button>
  )

  return (
    <div className="pb-32">
      <PageHeader
        title={t('Shop')}
        subtitle={
          shop.length === 0
            ? t('Your list is empty')
            : unchecked === 0
              ? t('Everything is in the basket')
              : t('{v0} to get{v1}', {
                  v0: pluralize(unchecked, 'thing'),
                  v1:
                    cost.total > 0.5
                      ? t(', about {v0}', { v0: formatMoney(cost.total, currency) })
                      : '',
                })
        }
        actions={
          <>
            {unchecked > 0 && (
              <Button variant="ghost" onClick={shareList}>
                {canShare ? (
                  <Share2 className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}{' '}
                {canShare ? t('Share list') : t('Copy list')}
              </Button>
            )}
            {shop.length > 0 && (
              <Button
                variant="ghost"
                onClick={() => withUndo(t('List cleared'), clearShop)}
                className="text-ink-2"
              >
                <Trash2 className="h-4 w-4" aria-hidden /> {t('Clear list')}
              </Button>
            )}
            {shop.length > 0 && planButton}
            <InstacartButton />
          </>
        }
      />

      {shop.length > 0 && <BasketProgress done={checked} total={shop.length} />}

      <CaptureForm />
      <Usuals />

      {shop.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title={t('Nothing to buy')}
          body={t('Plan a few dinners on Week, then add what they need here in one tap.')}
          action={planButton}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-2">
          {groups.map((g) => (
            <section key={g.id} aria-labelledby={`aisle-${g.id}`}>
              <h2
                id={`aisle-${g.id}`}
                className="mb-2 font-display text-xl font-semibold tracking-tight"
              >
                {g.label}
              </h2>
              <ul className="card divide-y divide-line overflow-hidden p-0">
                <AnimatePresence mode="popLayout" initial={false}>
                  {g.items.map((item) => (
                    <Row
                      key={item.id}
                      item={item}
                      onEdit={setEditing}
                      fromTitle={
                        item.fromRecipeIds
                          .map((id) => titles.get(id))
                          .filter(Boolean)
                          .join(', ') || undefined
                      }
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      {dismissed.length > 0 && (
        <p className="mt-6 text-center text-sm text-ink-3">
          {t('{v0} you removed will stay off this list.', {
            v0: pluralize(dismissed.length, 'item'),
          })}
          <button
            type="button"
            className="min-h-[44px] font-medium text-accent underline-offset-2 hover:underline"
            onClick={() => {
              restoreDismissed()
              fromPlan()
            }}
          >
            {t('Bring them back')}
          </button>
        </p>
      )}

      <Sheet open={!!copyFallback} onClose={() => setCopyFallback(null)} title={t('Your list')}>
        <p className="mb-3 text-ink-2">
          {t('This browser blocked copying. Select the text below and copy it yourself.')}
        </p>
        <Textarea
          readOnly
          rows={10}
          value={copyFallback ?? ''}
          aria-label={t('Shopping list as text')}
          onFocus={(e) => e.currentTarget.select()}
        />
      </Sheet>

      <EditSheet item={editing} onClose={() => setEditing(null)} />

      <AnimatePresence>
        {checked > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="glass fixed inset-x-5 bottom-24 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-pill py-2 pl-5 pr-2 md:bottom-6"
          >
            <span className="text-sm font-medium">{t('{checked} in the basket', { checked })}</span>
            <span className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => withUndo(t('Cleared the ticked items'), clearChecked)}
              >
                {t('Clear checked')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  finishShopping()
                  toast(t('Added to your pantry'))
                }}
              >
                {t('Done shopping')}
              </Button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** "350 g + 2 tbsp", with countable things rounded up. */
function amountText(i: ShopItem) {
  const list = [
    ...(i.quantity ? [{ quantity: i.quantity, unit: i.unit ?? '' }] : []),
    ...(i.more ?? []),
  ]
  // Read once per render: the list remounts when units change in Settings.
  return formatAmounts(list, { forShopping: true, system: useStore.getState().settings.units })
}

function EditSheet({ item, onClose }: { item: ShopItem | null; onClose: () => void }) {
  const update = useStore((s) => s.updateShopItem)
  const [draft, setDraft] = useState({ id: '', name: '', qty: '', unit: '' })
  // Load the item when the sheet opens for it.
  if (item && draft.id !== item.id)
    setDraft({
      id: item.id,
      name: item.name,
      qty: item.quantity && !item.more?.length ? niceNumber(item.quantity) : '',
      unit: item.more?.length ? '' : (item.unit ?? ''),
    })
  const qty = draft.qty.trim() ? parseAmount(draft.qty) : undefined
  const bad = !!draft.qty.trim() && !(qty && qty > 0)
  return (
    <Sheet open={!!item} onClose={onClose} title={t('Change this item')}>
      {item && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (bad || !draft.name.trim()) return
            update(item.id, { name: draft.name, quantity: qty, unit: draft.unit.trim() })
            toast(t('Saved'))
            onClose()
          }}
        >
          <div>
            <Label htmlFor="shop-name">{t('Name')}</Label>
            <Input
              id="shop-name"
              value={draft.name}
              maxLength={60}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>
          {item.more?.length ? (
            <p className="text-sm text-ink-3">
              {t('Now {v0}. Type an amount to replace it.', { v0: amountText(item) })}
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="shop-qty">{t('Amount')}</Label>
              <Input
                id="shop-qty"
                inputMode="decimal"
                value={draft.qty}
                maxLength={12}
                aria-invalid={bad}
                aria-describedby={bad ? 'shop-qty-err' : undefined}
                onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="shop-unit">{t('Unit')}</Label>
              <Input
                id="shop-unit"
                value={draft.unit}
                maxLength={20}
                placeholder={t('g, ml, tins')}
                onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
              />
            </div>
          </div>
          {bad && (
            <p id="shop-qty-err" className="text-sm text-danger">
              {t('Try a number like 2, 1.5 or ½, or leave it blank.')}
            </p>
          )}
          <Button type="submit" className="w-full">
            {t('Save')}
          </Button>
        </form>
      )}
    </Sheet>
  )
}

const Row = memo(function Row({
  item,
  fromTitle,
  onEdit,
}: {
  item: ShopItem
  fromTitle?: string
  onEdit: (item: ShopItem) => void
}) {
  const toggle = useStore((s) => s.toggleShopItem)
  const toggleOnce = useTapGuard(toggle)
  const remove = useStore((s) => s.removeShopItem)
  const dragged = useRef(false)
  const qty = amountText(item)

  return (
    <motion.li
      layout
      variants={reveal}
      initial="hidden"
      animate="show"
      exit="exit"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0.5, right: 0 }}
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={(_, info) => {
        setTimeout(() => (dragged.current = false), 0)
        if (info.offset.x < -120) withUndo(`${item.name} removed`, () => remove(item.id))
      }}
      className="group relative flex touch-pan-y items-center gap-1 bg-surface pr-2"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={item.checked}
        aria-label={qty ? `${item.name}, ${qty}` : item.name}
        onClick={() => {
          if (dragged.current) return
          // A tiny tap of feedback on phones that support it.
          if (!item.checked) navigator.vibrate?.(8)
          toggleOnce(item.id)
        }}
        className="flex h-14 min-w-0 flex-1 items-center gap-3 pl-3 text-left"
      >
        <span
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            item.checked ? 'border-secondary bg-secondary text-secondary-ink' : 'border-ink-3'
          )}
        >
          {item.checked && (
            <motion.svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={checkPop}
            >
              <motion.path
                d="M5 12.5l4.5 4.5L19 7.5"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.18 }}
              />
            </motion.svg>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'relative inline-block max-w-full truncate align-top transition-colors duration-200',
              item.checked ? 'text-ink-3' : 'text-ink'
            )}
          >
            {item.name}
            {/* A strike that draws across, instead of snapping on. */}
            <motion.span
              aria-hidden
              initial={false}
              animate={{ scaleX: item.checked ? 1 : 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              style={{ originX: 0 }}
              className="pointer-events-none absolute left-0 right-0 top-1/2 h-px bg-current"
            />
          </span>
          {fromTitle && (
            <span className="block truncate text-xs text-ink-3">
              {t('from {fromTitle}', { fromTitle })}
            </span>
          )}
        </span>
        {qty && <span className="shrink-0 text-sm text-ink-2">{qty}</span>}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('Change {name}', { name: item.name })}
        onClick={() => onEdit(item)}
        className={hoverReveal}
      >
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t('Remove {name}', { name: item.name })}
        onClick={() => withUndo(`${item.name} removed`, () => remove(item.id))}
        className={hoverReveal}
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.li>
  )
})

// Hidden until hover only where there is a mouse. Touch screens of any width always see them.
const hoverReveal =
  'shrink-0 opacity-70 hover:opacity-100 focus-visible:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:focus-visible:opacity-100'

/** How full the basket is. Fills smoothly as things are ticked off. */
function BasketProgress({ done, total }: { done: number; total: number }) {
  const all = done === total
  return (
    <div className="-mt-2 mb-6" aria-hidden>
      <div className="h-1.5 overflow-hidden rounded-pill bg-surface-2">
        <motion.div
          className={cn('h-full w-full rounded-pill', all ? 'bg-secondary' : 'bg-accent')}
          style={{ originX: 0 }}
          initial={false}
          animate={{ scaleX: total ? done / total : 0 }}
          transition={settle}
        />
      </div>
      <AnimatePresence initial={false}>
        {all && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={settle}
            className="mt-2 font-display text-base italic text-ink-2"
          >
            {t('All in. Tap Done shopping to put it away.')}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}
