'use client'

import { t } from '@/lib/i18n'

import { memo, useMemo, useRef, useState } from 'react'
import { Thumb } from '@/components/features/week/Thumb'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ChefHat, Plus, Refrigerator, Sprout } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useAvoid } from '@/lib/useAvoid'
import { withUndo } from '@/lib/undo'
import { useAppContext } from '@/components/shell/Providers'
import { suggest, coverage } from '@/lib/suggest'
import { quickPicks, staples } from '@/lib/seed/pantry'
import { guessZone } from '@/lib/pantryGuess'
import { reveal, staggerContainer } from '@/lib/motion'
import { formatAmount } from '@/lib/quantity'
import { cn, freshnessOf, isUseSoon, pluralize, toDateKey } from '@/lib/utils'
import type { PantryItem, PantryZone } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/Field'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Sheet } from '@/components/ui/Sheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { toast } from '@/components/ui/Toast'

const zones: { id: PantryZone; label: string }[] = [
  { id: 'fridge', label: t('Fridge') },
  { id: 'freezer', label: t('Freezer') },
  { id: 'cupboard', label: t('Cupboard') },
  { id: 'counter', label: t('Counter') },
]

const freshness = freshnessOf

export function Pantry() {
  const pantry = useStore((s) => s.pantry)
  const recipes = useStore((s) => s.recipes)
  const cooked = useStore((s) => s.cooked)
  const settings = useStore((s) => s.settings)
  const addPantryItem = useStore((s) => s.addPantryItem)
  const ctx = useAppContext()
  const today = toDateKey(new Date(ctx.now))

  const [cookOpen, setCookOpen] = useState(false)
  const [active, setActive] = useState<PantryItem | null>(null)
  const [name, setName] = useState('')
  // 'auto' guesses from the name; a choice only applies to the next item.
  const [zone, setZone] = useState<PantryZone | 'auto'>('auto')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'soon' | 'az' | 'new'>('soon')
  const guessed = guessZone(name)

  const soon = pantry.filter((p) => isUseSoon(p, today)).length

  const grouped = useMemo(
    () =>
      zones
        .map((z) => ({
          ...z,
          items: pantry
            .filter((p) => p.zone === z.id)
            .filter(
              (p) => !search.trim() || p.name.toLowerCase().includes(search.trim().toLowerCase())
            )
            .sort((a, b) =>
              sort === 'az'
                ? a.name.localeCompare(b.name)
                : sort === 'new'
                  ? b.addedAt.localeCompare(a.addedAt)
                  : freshness(a, today) - freshness(b, today)
            ),
        }))
        .filter((z) => z.items.length > 0),
    [pantry, today, search, sort]
  )

  const options = useMemo(() => {
    const seen = new Map<string, { name: string; zone?: PantryZone }>()
    for (const s of staples) seen.set(s.key, { name: s.name, zone: s.zone })
    for (const r of recipes)
      for (const i of r.ingredients) if (!seen.has(i.key)) seen.set(i.key, { name: i.name })
    return [...seen.values()]
  }, [recipes])

  const q = name.trim().toLowerCase()
  const matches = q
    ? options
        .filter((o) => o.name.toLowerCase().includes(q) && o.name.toLowerCase() !== q)
        .slice(0, 6)
    : []

  function add(n = name, z = zone) {
    const clean = n.trim()
    if (!clean) return
    const res = addPantryItem({ name: clean, zone: z === 'auto' ? guessZone(clean) : z })
    setZone('auto')
    toast(
      res === 'added'
        ? t('{clean} is in the pantry', { clean })
        : t('{clean} was already there. Marked as fresh.', { clean })
    )
    setName('')
  }

  function pickSuggestion(o: { name: string; zone?: PantryZone }) {
    setName(o.name)
  }

  function onNameChange(v: string) {
    setName(v)
  }

  function addStarter() {
    let added = 0
    for (const n of quickPicks.slice(0, 12)) if (addPantryItem({ name: n }) === 'added') added++
    toast(added ? t('{added} staples added', { added }) : t('You already have these staples'))
  }

  return (
    <div className="pb-8">
      <PageHeader
        title={t('Pantry')}
        subtitle={
          <>
            {pluralize(pantry.length, 'thing')}
            {soon > 0 ? t(', {soon} to use soon', { soon }) : ''}
          </>
        }
        actions={
          <Button
            variant="secondary"
            onClick={() => setCookOpen(true)}
            disabled={pantry.length === 0}
          >
            <ChefHat className="h-4 w-4" aria-hidden /> {t('Cook from what I have')}
          </Button>
        }
      />

      <form
        className="mb-8 flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Input
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={t('Add something you have')}
            aria-label={t('Add a pantry item')}
            autoComplete="off"
          />
          {matches.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={t('Suggestions')}>
              {matches.map((o) => (
                <li key={o.name}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(o)}
                    className="h-8 rounded-pill border border-line bg-surface/70 px-3 text-[0.8125rem] text-ink-2 hover:text-ink"
                  >
                    {o.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Select
          value={zone}
          onChange={(e) => setZone(e.target.value as PantryZone | 'auto')}
          aria-label={t('Where it lives')}
          className="w-36 shrink-0"
        >
          <option value="auto">
            {name.trim()
              ? t('{v0} (guess)', { v0: zones.find((z) => z.id === guessed)?.label })
              : t('Where it lives')}
          </option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </Select>
        <Button
          type="submit"
          size="icon"
          aria-label={t('Add to pantry')}
          aria-disabled={!name.trim()}
          variant={name.trim() ? 'primary' : 'secondary'}
        >
          <Plus className="h-5 w-5" />
        </Button>
      </form>

      {pantry.length === 0 ? (
        <EmptyState
          icon={Refrigerator}
          title={t('Your pantry is empty')}
          body={t('Add a few staples and Plantry can tell you what you can make tonight.')}
          action={<Button onClick={addStarter}>{t('Add 12 staples')}</Button>}
        />
      ) : (
        <div className="space-y-8">
          {pantry.length > 8 && (
            <div className="flex gap-2">
              <Input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('Find in your pantry')}
                aria-label={t('Find in your pantry')}
              />
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                aria-label={t('Sort')}
                className="w-40 shrink-0"
              >
                <option value="soon">{t('Use soon first')}</option>
                <option value="az">{t('A to Z')}</option>
                <option value="new">{t('Newest first')}</option>
              </Select>
            </div>
          )}
          {grouped.length === 0 && (
            <p className="text-center text-ink-2">{t('Nothing called “{search}”.', { search })}</p>
          )}
          {grouped.map((z) => (
            <section key={z.id} aria-labelledby={`zone-${z.id}`}>
              <h2
                id={`zone-${z.id}`}
                className="mb-3 font-display text-xl font-semibold tracking-tight"
              >
                {z.label}
              </h2>
              <motion.ul
                variants={staggerContainer}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              >
                <AnimatePresence mode="popLayout">
                  {z.items.map((item, i) => (
                    <Tile key={item.id} item={item} index={i} today={today} onOpen={setActive} />
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          ))}
        </div>
      )}

      <ItemSheet item={active} onClose={() => setActive(null)} />

      <Sheet
        open={cookOpen}
        onClose={() => setCookOpen(false)}
        title={t('Cook from what I have')}
        tall
      >
        <CookList
          open={cookOpen}
          recipes={recipes}
          pantry={pantry}
          tastes={settings.tastes}
          ctx={ctx}
          recent={cooked.map((c) => c.recipeId)}
          onPick={() => setCookOpen(false)}
        />
      </Sheet>
    </div>
  )
}

const Tile = memo(function Tile({
  item,
  index,
  today,
  onOpen,
}: {
  item: PantryItem
  index: number
  today: string
  onOpen: (item: PantryItem) => void
}) {
  const restock = useStore((s) => s.restockPantryItem)
  const usedUp = useStore((s) => s.useUpPantryItem)
  const f = freshness(item, today)
  const tone = f > 0.5 ? 'secondary' : f >= 0.2 ? 'accent' : 'danger'
  const dragged = useRef(false)

  return (
    <motion.li
      layout
      variants={reveal}
      custom={index}
      exit="exit"
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.5}
      onDragStart={() => {
        dragged.current = true
      }}
      onDragEnd={(_, info) => {
        setTimeout(() => (dragged.current = false), 0)
        if (info.offset.x < -120) {
          markUsedUp(item, usedUp)
        } else if (info.offset.x > 120) {
          restock(item.id)
          toast(`${item.name} restocked`)
        }
      }}
      className="card touch-pan-y list-none"
    >
      <button
        type="button"
        onClick={() => !dragged.current && onOpen(item)}
        aria-label={t('{name}, options', { name: item.name })}
        className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-card p-3.5 text-left"
      >
        <ProgressRing value={f} size={40} stroke={4} tone={tone}>
          <Sprout className="h-4 w-4 text-ink-2" aria-hidden />
        </ProgressRing>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{item.name}</span>
          {item.quantity !== undefined && (
            <span className="block text-xs text-ink-3">
              {formatAmount(item.quantity, item.unit, {
                system: useStore.getState().settings.units,
              })}
            </span>
          )}
          {isUseSoon(item, today) && (
            <Tag className={cn('mt-1', 'text-ink-2')}>{t('Use soon')}</Tag>
          )}
        </span>
      </button>
    </motion.li>
  )
})

/** Used it up: staples go back on the list so you can buy more. Undo puts both back. */
function markUsedUp(item: PantryItem, usedUp: (id: string) => boolean) {
  let listed = false
  withUndo(
    item.staple
      ? t('{name} used up and added to your list', { name: item.name })
      : t('{name} used up', { name: item.name }),
    () => {
      listed = usedUp(item.id)
    }
  )
  return listed
}

const lifeOptions = [3, 5, 7, 14, 30, 90, 180, 365]

function ItemSheet({ item, onClose }: { item: PantryItem | null; onClose: () => void }) {
  const restock = useStore((s) => s.restockPantryItem)
  const usedUp = useStore((s) => s.useUpPantryItem)
  const remove = useStore((s) => s.removePantryItem)
  const update = useStore((s) => s.updatePantryItem)
  // Always show the live item, and keep the last one so the sheet doesn't empty mid-exit.
  const live = useStore((s) => (item ? s.pantry.find((p) => p.id === item.id) : undefined))
  const last = useRef<PantryItem | null>(null)
  if (live) last.current = live
  const shown = live ?? last.current
  return (
    <Sheet open={!!item} onClose={onClose} title={shown?.name}>
      {shown && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium text-ink-2">
              {t('How much')}
              <Input
                inputMode="decimal"
                className="mt-1"
                defaultValue={shown.quantity ?? ''}
                placeholder={t('Not sure')}
                onBlur={(e) => {
                  const n = Number(e.target.value.replace(',', '.'))
                  update(shown.id, { quantity: e.target.value.trim() && n > 0 ? n : undefined })
                }}
              />
            </label>
            <label className="text-sm font-medium text-ink-2">
              {t('Unit')}
              <Input
                className="mt-1"
                defaultValue={shown.unit ?? ''}
                placeholder={t('g, ml, whole')}
                onBlur={(e) => update(shown.id, { unit: e.target.value.trim() || undefined })}
              />
            </label>
            <label className="text-sm font-medium text-ink-2">
              {t('Where it lives')}
              <Select
                className="mt-1"
                value={shown.zone}
                onChange={(e) => update(shown.id, { zone: e.target.value as PantryZone })}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="text-sm font-medium text-ink-2">
              {t('Keeps for')}
              <Select
                className="mt-1"
                value={String(shown.softLifeDays)}
                onChange={(e) => update(shown.id, { softLifeDays: Number(e.target.value) })}
              >
                {[...new Set([...lifeOptions, shown.softLifeDays])]
                  .sort((a, b) => a - b)
                  .map((d) => (
                    <option key={d} value={d}>
                      {d >= 365
                        ? t('A year or more')
                        : d >= 30
                          ? `${Math.round(d / 30)} months`.replace(/^1 months/, t('1 month'))
                          : `${d} days`}
                    </option>
                  ))}
              </Select>
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                restock(shown.id)
                toast(`${shown.name} restocked`)
                onClose()
              }}
            >
              {t('Restock (just bought more)')}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                markUsedUp(shown, usedUp)
                onClose()
              }}
            >
              {shown.staple ? t('Used it up (add to my list)') : t('Used it up')}
            </Button>
            <Button
              variant="ghost"
              className="text-danger"
              onClick={() => {
                withUndo(`${shown.name} removed`, () => remove(shown.id))
                onClose()
              }}
            >
              {t('Remove (added by mistake)')}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  )
}

function CookList({
  open,
  recipes,
  pantry,
  tastes,
  ctx,
  recent,
  onPick,
}: {
  open: boolean
  recipes: ReturnType<typeof useStore.getState>['recipes']
  pantry: PantryItem[]
  tastes: ReturnType<typeof useStore.getState>['settings']['tastes']
  ctx: ReturnType<typeof useAppContext>
  recent: string[]
  onPick: () => void
}) {
  const avoid = useAvoid()
  const results = useMemo(() => {
    if (!open) return []
    return suggest({ recipes, pantry, tastes, context: ctx, recent, avoid })
      .map((s) => ({ ...s, total: coverage(s.recipe, pantry).total }))
      .sort((a, b) => b.have / (b.total || 1) - a.have / (a.total || 1) || b.score - a.score)
      .slice(0, 6)
  }, [open, recipes, pantry, tastes, ctx, recent, avoid])

  if (results.length === 0)
    return <p className="text-ink-2">{t('Nothing to cook from yet. Add a few things first.')}</p>
  return (
    <ul className="space-y-2">
      {results.map((s) => (
        <li key={s.recipe.id}>
          <Link
            href={`/recipes/${s.recipe.id}`}
            onClick={onPick}
            className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface-2"
          >
            <Thumb src={s.recipe.imageUrl} sizes="64px" className="h-16 w-16 rounded-2xl" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg font-semibold leading-tight">
                {s.recipe.title}
              </span>
              <span className="block text-sm text-ink-2">
                {t('You have {have} of {total}', { have: s.have, total: s.total })}
              </span>
              {s.missing.length > 0 && (
                <span className="block truncate text-xs text-ink-3">
                  {t('Missing {v0}', { v0: s.missing.join(', ') })}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
