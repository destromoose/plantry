'use client'

import { useMemo, useState } from 'react'
import { Check, CalendarDays, Trash2, UserRound, Repeat, Pencil } from 'lucide-react'
import { useStore } from '@/lib/store'
import { withUndo } from '@/lib/undo'
import { coverage, suggest } from '@/lib/suggest'
import type { Context, PlanEntry, Taste } from '@/lib/types'
import { cn, daysBetween, formatMinutes, fromDateKey, dayLabel, shortDay } from '@/lib/utils'
import { Sheet } from '@/components/ui/Sheet'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { toast } from '@/components/ui/Toast'
import { Thumb } from './Thumb'

const tasteLabels: [Taste, string][] = [
  ['cozy', 'Cozy'],
  ['fresh', 'Fresh'],
  ['fast', 'Fast'],
  ['one-pan', 'One pan'],
  ['veg-forward', 'Veg-forward'],
  ['spicy', 'Spicy'],
  ['big-batch', 'Big batch'],
  ['kid-friendly', 'Kid-friendly'],
]

export type SheetKind = 'pick' | 'menu' | 'claim' | 'move'

interface Props {
  date: string | null
  kind: SheetKind
  setKind: (k: SheetKind) => void
  onClose: () => void
  today: string
  ctx: Context
  entry?: PlanEntry
  weekDates: string[]
  onCooked: (date: string) => void
}

/** All the per-day sheets: pick a dinner, row menu, claim a night, move to another day. */
export function DaySheets({
  date,
  kind,
  setKind,
  onClose,
  today,
  ctx,
  entry,
  weekDates,
  onCooked,
}: Props) {
  const open = date !== null
  const title =
    date === null
      ? ''
      : kind === 'pick'
        ? `Dinner for ${dayLabel(date, today)}`
        : kind === 'claim'
          ? 'Who is cooking?'
          : kind === 'move'
            ? 'Move to which night?'
            : `${dayLabel(date, today)}, ${fromDateKey(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  return (
    <Sheet open={open} onClose={onClose} title={title} tall={kind === 'pick'}>
      {date !== null && kind === 'pick' && (
        <PickBody date={date} today={today} ctx={ctx} entry={entry} onClose={onClose} />
      )}
      {date !== null && kind === 'menu' && (
        <MenuBody
          date={date}
          entry={entry}
          setKind={setKind}
          onClose={onClose}
          onCooked={onCooked}
        />
      )}
      {date !== null && kind === 'claim' && (
        <ClaimBody date={date} entry={entry} onClose={onClose} />
      )}
      {date !== null && kind === 'move' && entry && (
        <MoveBody date={date} entry={entry} weekDates={weekDates} today={today} onClose={onClose} />
      )}
    </Sheet>
  )
}

/* ------------------------------------------------------------------ */

function PickBody({
  date,
  today,
  ctx,
  entry,
  onClose,
}: {
  date: string
  today: string
  ctx: Context
  entry?: PlanEntry
  onClose: () => void
}) {
  const recipes = useStore((s) => s.recipes)
  const pantry = useStore((s) => s.pantry)
  const cooked = useStore((s) => s.cooked)
  const tastes = useStore((s) => s.settings.tastes)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState<Taste[]>([])
  const [note, setNote] = useState('')

  const dow = fromDateKey(date).getDay()
  const ranked = useMemo(
    () =>
      suggest({
        recipes,
        pantry,
        tastes,
        context: { ...ctx, isWeekend: dow === 0 || dow === 6 },
        recent: cooked.map((c) => c.recipeId),
      }),
    [recipes, pantry, tastes, ctx, dow, cooked]
  )

  const needle = q.trim().toLowerCase()
  const list = ranked.filter(({ recipe }) => {
    if (filters.length && !filters.every((f) => recipe.tastes.includes(f))) return false
    if (!needle) return true
    return (
      recipe.title.toLowerCase().includes(needle) ||
      recipe.ingredients.some((i) => i.name.toLowerCase().includes(needle))
    )
  })

  const leftovers = useMemo(() => {
    const seen = new Set<string>()
    return cooked
      .filter((c) => daysBetween(c.date, today) >= 0 && daysBetween(c.date, today) <= 3)
      .map((c) => recipes.find((r) => r.id === c.recipeId))
      .filter(
        (r): r is NonNullable<typeof r> =>
          !!r && !!r.leftovers && !seen.has(r.id) && !!seen.add(r.id)
      )
  }, [cooked, recipes, today])

  function place(patch: Partial<PlanEntry>) {
    setPlanEntry({ date, slot: 'dinner', cookId: entry?.cookId, ...patch })
    onClose()
  }

  return (
    <div className="space-y-5">
      <Input
        type="search"
        aria-label="Search recipes"
        placeholder="Search recipes or ingredients"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div
        className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1"
        role="group"
        aria-label="Filter by taste"
      >
        {tasteLabels.map(([id, label]) => (
          <Chip
            key={id}
            size="sm"
            selected={filters.includes(id)}
            onClick={() =>
              setFilters((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id]))
            }
            className="shrink-0"
          >
            {label}
          </Chip>
        ))}
      </div>

      {leftovers.length > 0 && !needle && (
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-ink-3">
            Leftovers of...
          </h3>
          <ul className="space-y-2">
            {leftovers.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => place({ leftoversOf: r.id, recipeId: undefined, note: undefined })}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 p-2.5 text-left hover:border-ink-3"
                >
                  <Thumb src={r.imageUrl} className="h-11 w-11 rounded-xl" sizes="44px" />
                  <span className="font-medium">{r.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-ink-3">
          Suggestions
        </h3>
        {list.length === 0 ? (
          <p className="py-4 text-[15px] text-ink-2">Nothing matches. Try fewer filters.</p>
        ) : (
          <ul className="space-y-2">
            {list.map(({ recipe }) => {
              const cov = coverage(recipe, pantry)
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() =>
                      place({ recipeId: recipe.id, leftoversOf: undefined, note: undefined })
                    }
                    className="flex min-h-[64px] w-full items-center gap-3 rounded-2xl border border-line bg-surface p-2.5 text-left hover:border-ink-3"
                  >
                    <Thumb src={recipe.imageUrl} className="h-12 w-12 rounded-xl" sizes="48px" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{recipe.title}</span>
                      <span className="block text-sm text-ink-2">
                        {formatMinutes(recipe.activeMinutes)} · {cov.have} of {cov.total}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-ink-3">
          Something else
        </h3>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (note.trim())
              place({ note: note.trim(), recipeId: undefined, leftoversOf: undefined })
          }}
        >
          <Input
            aria-label="Free-text dinner"
            placeholder="Takeout, Out, Dinner at Sam's"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="lg" disabled={!note.trim()}>
            Add
          </Button>
        </form>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------------ */

function Row({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Check
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex min-h-[52px] w-full items-center gap-3 rounded-2xl px-3 text-left font-medium hover:bg-surface-2',
          danger ? 'text-danger' : 'text-ink'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden /> {label}
      </button>
    </li>
  )
}

function MenuBody({
  date,
  entry,
  setKind,
  onClose,
  onCooked,
}: {
  date: string
  entry?: PlanEntry
  setKind: (k: SheetKind) => void
  onClose: () => void
  onCooked: (date: string) => void
}) {
  const clearPlanEntry = useStore((s) => s.clearPlanEntry)
  const hasMeal = !!entry && !!(entry.recipeId || entry.leftoversOf)
  const hasContent = !!entry && !!(entry.recipeId || entry.leftoversOf || entry.note)
  return (
    <ul className="-mx-3 space-y-1">
      <Row
        icon={Pencil}
        label={hasContent ? 'Change' : 'Pick something'}
        onClick={() => setKind('pick')}
      />
      {hasMeal && !entry?.done && (
        <Row
          icon={Check}
          label="Mark cooked"
          onClick={() => {
            onCooked(date)
            onClose()
          }}
        />
      )}
      <Row icon={UserRound} label="Claim night" onClick={() => setKind('claim')} />
      {hasContent && <Row icon={Repeat} label="Move to..." onClick={() => setKind('move')} />}
      {entry && (
        <Row
          icon={Trash2}
          label="Remove"
          danger
          onClick={() => {
            withUndo('Dinner removed', () => clearPlanEntry(date, 'dinner'))
            onClose()
          }}
        />
      )}
    </ul>
  )
}

function ClaimBody({
  date,
  entry,
  onClose,
}: {
  date: string
  entry?: PlanEntry
  onClose: () => void
}) {
  const members = useStore((s) => s.members)
  const claimNight = useStore((s) => s.claimNight)
  if (members.length === 0)
    return <p className="text-[15px] text-ink-2">Add someone to your household first.</p>
  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => {
              claimNight(date, m.id)
              toast(`${m.name} has the night`)
              onClose()
            }}
            className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left hover:border-ink-3"
          >
            <Avatar member={m} />
            <span className="flex-1 font-medium">{m.name}</span>
            {entry?.cookId === m.id && (
              <Check className="h-5 w-5 text-secondary" aria-label="Current cook" />
            )}
          </button>
        </li>
      ))}
      {entry?.cookId && (
        <li>
          <Button
            variant="ghost"
            onClick={() => {
              claimNight(date, undefined)
              onClose()
            }}
          >
            Unclaim
          </Button>
        </li>
      )}
    </ul>
  )
}

function MoveBody({
  date,
  entry,
  weekDates,
  today,
  onClose,
}: {
  date: string
  entry: PlanEntry
  weekDates: string[]
  today: string
  onClose: () => void
}) {
  const movePlanEntry = useStore((s) => s.movePlanEntry)
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const days = weekDates.filter((d) => d !== date)
  return (
    <ul className="space-y-2">
      {days.map((d) => {
        const other = plan.find((p) => p.date === d && p.slot === 'dinner')
        const label = other?.recipeId
          ? recipes.find((r) => r.id === other.recipeId)?.title
          : other?.note
        return (
          <li key={d}>
            <button
              type="button"
              onClick={() => {
                movePlanEntry(entry.id, d)
                toast(
                  label ? `Swapped with ${dayLabel(d, today)}` : `Moved to ${dayLabel(d, today)}`
                )
                onClose()
              }}
              className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left hover:border-ink-3"
            >
              <CalendarDays className="h-5 w-5 text-ink-3" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">
                  {shortDay(d)} {fromDateKey(d).getDate()}
                </span>
                {label && (
                  <span className="block truncate text-sm text-ink-2">Swaps with {label}</span>
                )}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
