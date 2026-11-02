'use client'

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, ListChecks, Plus, ShoppingBasket, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useTapGuard } from '@/lib/useTapGuard'
import { withUndo } from '@/lib/undo'
import { useAppContext } from '@/components/shell/Providers'
import { addDays, cn, formatQuantity } from '@/lib/utils'
import { checkPop, reveal } from '@/lib/motion'
import type { Aisle, ShopItem } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'

const aisles: { id: Aisle; label: string }[] = [
  { id: 'produce', label: 'Produce' },
  { id: 'meat-fish', label: 'Meat and fish' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'spices', label: 'Spices' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'other', label: 'Other' },
]

export function Shop() {
  const shop = useStore((s) => s.shop)
  const recipes = useStore((s) => s.recipes)
  const generateShop = useStore((s) => s.generateShop)
  const addShopItem = useStore((s) => s.addShopItem)
  const finishShopping = useStore((s) => s.finishShopping)
  const clearChecked = useStore((s) => s.clearChecked)
  const { targetDate } = useAppContext()
  const [name, setName] = useState('')

  const titles = useMemo(() => new Map(recipes.map((r) => [r.id, r.title])), [recipes])
  const unchecked = shop.filter((i) => !i.checked).length
  const checked = shop.length - unchecked

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
    const dates = Array.from({ length: 7 }, (_, i) => addDays(targetDate, i))
    generateShop(dates)
    toast(
      `${useStore.getState().shop.filter((i) => i.fromRecipeIds.length > 0).length} items from your plan`
    )
  }

  async function copyText() {
    const text = groups
      .map(
        (g) =>
          `${g.label}\n${g.items.map((i) => `- ${i.name}${formatQuantity(i.quantity, i.unit) ? ` (${formatQuantity(i.quantity, i.unit)})` : ''}`).join('\n')}`
      )
      .join('\n\n')
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied')
    } catch {
      toast('Could not copy that')
    }
  }

  function add() {
    if (!name.trim()) return
    if (addShopItem(name) === 'exists') toast(`${name.trim()} is already on your list`)
    setName('')
  }

  const planButton = (
    <Button variant="secondary" onClick={fromPlan}>
      <ListChecks className="h-4 w-4" aria-hidden /> From this week&apos;s plan
    </Button>
  )

  return (
    <div className="pb-32">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
            Shop
          </h1>
          <p className="mt-1 text-ink-2">{unchecked} to get</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {shop.length > 0 && (
            <Button variant="ghost" onClick={copyText}>
              <Copy className="h-4 w-4" aria-hidden /> Copy as text
            </Button>
          )}
          {shop.length > 0 && planButton}
        </div>
      </header>

      <form
        className="mb-8 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add something"
          aria-label="Add a shopping item"
          autoComplete="off"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Add to list"
          disabled={!name.trim()}
          className="shrink-0"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </form>

      {shop.length === 0 ? (
        <EmptyState
          icon={ShoppingBasket}
          title="Nothing to buy"
          body="Plan a few dinners and the list writes itself."
          action={planButton}
        />
      ) : (
        <div className="space-y-8">
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
                      fromTitle={item.fromRecipeIds.map((id) => titles.get(id)).filter(Boolean)[0]}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      <AnimatePresence>
        {checked > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            className="glass fixed inset-x-5 bottom-24 z-30 mx-auto flex max-w-xl items-center justify-between gap-3 rounded-pill py-2 pl-5 pr-2 lg:bottom-6"
          >
            <span className="text-sm font-medium">{checked} in the basket</span>
            <span className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => withUndo('Cleared the ticked items', clearChecked)}
              >
                Clear checked
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  finishShopping()
                  toast('Added to your pantry')
                }}
              >
                Done shopping
              </Button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Row({ item, fromTitle }: { item: ShopItem; fromTitle?: string }) {
  const toggle = useStore((s) => s.toggleShopItem)
  const toggleOnce = useTapGuard(toggle)
  const remove = useStore((s) => s.removeShopItem)
  const dragged = useRef(false)
  const qty = formatQuantity(item.quantity, item.unit)

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
        aria-label={item.name}
        onClick={() => !dragged.current && toggleOnce(item.id)}
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
            className={cn('block truncate', item.checked ? 'text-ink-3 line-through' : 'text-ink')}
          >
            {item.name}
          </span>
          {fromTitle && <span className="block truncate text-xs text-ink-3">from {fromTitle}</span>}
        </span>
        {qty && <span className="shrink-0 text-sm text-ink-2">{qty}</span>}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Remove ${item.name}`}
        onClick={() => withUndo(`${item.name} removed`, () => remove(item.id))}
        className="shrink-0 opacity-60 hover:opacity-100 focus-visible:opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </Button>
    </motion.li>
  )
}
