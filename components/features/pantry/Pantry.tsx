'use client'

import { useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { ChefHat, Plus, Refrigerator, Sprout } from 'lucide-react'
import { useStore } from '@/lib/store'
import { withUndo } from '@/lib/undo'
import { useAppContext } from '@/components/shell/Providers'
import { suggest, coverage } from '@/lib/suggest'
import { quickPicks, staples } from '@/lib/seed/pantry'
import { reveal, staggerContainer } from '@/lib/motion'
import { clamp, cn, daysBetween, keyOf, pluralize, toDateKey } from '@/lib/utils'
import type { PantryItem, PantryZone } from '@/lib/types'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/Field'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'

const zones: { id: PantryZone; label: string }[] = [
  { id: 'fridge', label: 'Fridge' },
  { id: 'freezer', label: 'Freezer' },
  { id: 'cupboard', label: 'Cupboard' },
  { id: 'counter', label: 'Counter' },
]

function freshness(item: PantryItem, today: string) {
  const age = Math.max(0, daysBetween(item.addedAt.slice(0, 10), today))
  return clamp(1 - age / item.softLifeDays, 0, 1)
}

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
  const [zone, setZone] = useState<PantryZone>('fridge')

  const soon = pantry.filter((p) => freshness(p, today) < 0.35).length

  const grouped = useMemo(
    () =>
      zones
        .map((z) => ({
          ...z,
          items: pantry
            .filter((p) => p.zone === z.id)
            .sort((a, b) => freshness(a, today) - freshness(b, today)),
        }))
        .filter((z) => z.items.length > 0),
    [pantry, today]
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
    const res = addPantryItem({ name: clean, zone: z })
    toast(
      res === 'added' ? `${clean} is in the pantry` : `${clean} was already there. Marked as fresh.`
    )
    setName('')
  }

  function pickSuggestion(o: { name: string; zone?: PantryZone }) {
    setName(o.name)
    if (o.zone) setZone(o.zone)
  }

  function onNameChange(v: string) {
    setName(v)
    const staple = staples.find((s) => s.key === keyOf(v))
    if (staple) setZone(staple.zone)
  }

  function addStarter() {
    let added = 0
    for (const n of quickPicks.slice(0, 12)) if (addPantryItem({ name: n }) === 'added') added++
    toast(added ? `${added} staples added` : 'You already have these staples')
  }

  return (
    <div className="pb-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
            Pantry
          </h1>
          <p className="mt-1 text-ink-2">
            {pluralize(pantry.length, 'thing')}, {soon} should be used soon
          </p>
        </div>
        <Button onClick={() => setCookOpen(true)} disabled={pantry.length === 0}>
          <ChefHat className="h-4 w-4" aria-hidden /> Cook from what I have
        </Button>
      </header>

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
            placeholder="Add something you have"
            aria-label="Add a pantry item"
            autoComplete="off"
          />
          {matches.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggestions">
              {matches.map((o) => (
                <li key={o.name}>
                  <button
                    type="button"
                    onClick={() => pickSuggestion(o)}
                    className="h-8 rounded-pill border border-line bg-surface/70 px-3 text-[13px] text-ink-2 hover:text-ink"
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
          onChange={(e) => setZone(e.target.value as PantryZone)}
          aria-label="Where it lives"
          className="w-32 shrink-0"
        >
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.label}
            </option>
          ))}
        </Select>
        <Button type="submit" size="icon" aria-label="Add to pantry" disabled={!name.trim()}>
          <Plus className="h-5 w-5" />
        </Button>
      </form>

      {pantry.length === 0 ? (
        <EmptyState
          icon={Refrigerator}
          title="Your pantry is empty"
          body="Add a few staples and Plantry can tell you what you can make tonight."
          action={<Button onClick={addStarter}>Add 12 staples</Button>}
        />
      ) : (
        <div className="space-y-8">
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
                    <Tile
                      key={item.id}
                      item={item}
                      index={i}
                      today={today}
                      onOpen={() => setActive(item)}
                    />
                  ))}
                </AnimatePresence>
              </motion.ul>
            </section>
          ))}
        </div>
      )}

      <ItemSheet item={active} onClose={() => setActive(null)} />

      <Sheet open={cookOpen} onClose={() => setCookOpen(false)} title="Cook from what I have" tall>
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

function Tile({
  item,
  index,
  today,
  onOpen,
}: {
  item: PantryItem
  index: number
  today: string
  onOpen: () => void
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
          withUndo(`${item.name} used up`, () => usedUp(item.id))
        } else if (info.offset.x > 120) {
          restock(item.id)
          toast(`${item.name} restocked`)
        }
      }}
      className="card touch-pan-y list-none"
    >
      <button
        type="button"
        onClick={() => !dragged.current && onOpen()}
        aria-label={`${item.name}, options`}
        className="flex min-h-[4.5rem] w-full items-center gap-3 rounded-card p-3.5 text-left"
      >
        <ProgressRing value={f} size={40} stroke={4} tone={tone}>
          <Sprout className="h-4 w-4 text-ink-2" aria-hidden />
        </ProgressRing>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-ink">{item.name}</span>
          {f < 0.35 && <Tag className={cn('mt-1', 'text-ink-2')}>Use soon</Tag>}
        </span>
      </button>
    </motion.li>
  )
}

function ItemSheet({ item, onClose }: { item: PantryItem | null; onClose: () => void }) {
  const restock = useStore((s) => s.restockPantryItem)
  const usedUp = useStore((s) => s.useUpPantryItem)
  const remove = useStore((s) => s.removePantryItem)
  // Keep the last item around so the sheet content does not vanish mid-exit.
  const last = useRef<PantryItem | null>(null)
  if (item) last.current = item
  const shown = item ?? last.current
  return (
    <Sheet open={!!item} onClose={onClose} title={shown?.name}>
      {shown && (
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              restock(shown.id)
              toast(`${shown.name} restocked`)
              onClose()
            }}
          >
            Restock (just bought more)
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              withUndo(`${shown.name} used up`, () => usedUp(shown.id))
              onClose()
            }}
          >
            Used it up
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              withUndo(`${shown.name} removed`, () => remove(shown.id))
              onClose()
            }}
          >
            Remove
          </Button>
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
  const results = useMemo(() => {
    if (!open) return []
    return suggest({ recipes, pantry, tastes, context: ctx, recent })
      .map((s) => ({ ...s, total: coverage(s.recipe, pantry).total }))
      .sort((a, b) => b.have / (b.total || 1) - a.have / (a.total || 1) || b.score - a.score)
      .slice(0, 6)
  }, [open, recipes, pantry, tastes, ctx, recent])

  if (results.length === 0)
    return <p className="text-ink-2">Nothing to cook from yet. Add a few things first.</p>
  return (
    <ul className="space-y-2">
      {results.map((s) => (
        <li key={s.recipe.id}>
          <Link
            href={`/recipes/${s.recipe.id}`}
            onClick={onPick}
            className="flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-surface-2"
          >
            <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
              {s.recipe.imageUrl && (
                <Image src={s.recipe.imageUrl} alt="" fill sizes="64px" className="object-cover" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-display text-lg font-semibold leading-tight">
                {s.recipe.title}
              </span>
              <span className="block text-sm text-ink-2">
                You have {s.have} of {s.total}
              </span>
              {s.missing.length > 0 && (
                <span className="block truncate text-xs text-ink-3">
                  Missing {s.missing.join(', ')}
                </span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
