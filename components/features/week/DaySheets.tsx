'use client'

import { locale, t } from '@/lib/i18n'

import { ratingsOf } from '@/lib/history'
import { useMemo, useState } from 'react'
import {
  Check,
  CalendarDays,
  MessageSquare,
  Moon,
  Pencil,
  Repeat,
  Shuffle,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import { WhoHomeBody } from '@/components/features/together/WhoHome'
import { NotesThread } from '@/components/features/together/Notes'
import { plannedMeals } from '@/lib/meals'
import { useStore } from '@/lib/store'
import { Stepper } from '@/components/ui/Stepper'
import { useAvoid } from '@/lib/useAvoid'
import { withUndo } from '@/lib/undo'
import { coverage, pickNext, suggest } from '@/lib/suggest'
import { useAppContext } from '@/components/shell/Providers'
import type { Context, PlanEntry, Taste } from '@/lib/types'
import {
  addDays,
  cn,
  daysBetween,
  formatMinutes,
  fromDateKey,
  dayLabel,
  shortDay,
  weekOf,
} from '@/lib/utils'
import { Sheet } from '@/components/ui/Sheet'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { toast } from '@/components/ui/Toast'
import { Thumb } from './Thumb'

const tasteLabels: [Taste, string][] = [
  ['cozy', t('Cozy')],
  ['fresh', t('Fresh')],
  ['fast', t('Fast')],
  ['one-pan', t('One pan')],
  ['veg-forward', t('Veg-forward')],
  ['spicy', t('Spicy')],
  ['big-batch', t('Big batch')],
  ['kid-friendly', t('Kid-friendly')],
]

export type SheetKind = 'pick' | 'menu' | 'claim' | 'move' | 'home' | 'notes'

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
        ? t('Dinner for {v0}', { v0: dayLabel(date, today) })
        : kind === 'claim'
          ? t('Who is cooking?')
          : kind === 'move'
            ? t('Move or swap with which night?')
            : kind === 'home'
              ? t("Who's home on {day}", {
                  day: fromDateKey(date).toLocaleDateString(locale(), { weekday: 'long' }),
                })
              : kind === 'notes'
                ? t('Notes for {day}', {
                    day: fromDateKey(date).toLocaleDateString(locale(), { weekday: 'long' }),
                  })
                : `${dayLabel(date, today)}, ${fromDateKey(date).toLocaleDateString(locale(), { month: 'short', day: 'numeric' })}`

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
      {date !== null && kind === 'home' && <HomeBody date={date} />}
      {date !== null && kind === 'notes' && (
        <NotesThread
          where={{ on: 'day', date }}
          placeholder={t('Defrost the chicken, back at 8…')}
        />
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

  const avoid = useAvoid()
  const dow = fromDateKey(date).getDay()
  const ranked = useMemo(
    () =>
      suggest({
        recipes,
        pantry,
        tastes,
        context: { ...ctx, isWeekend: dow === 0 || dow === 6 },
        recent: cooked.map((c) => c.recipeId),
        ratings: ratingsOf(cooked),
        avoid,
      }),
    [recipes, pantry, tastes, ctx, dow, cooked, avoid]
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
        aria-label={t('Search recipes')}
        placeholder={t('Search recipes or ingredients')}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div
        className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1"
        role="group"
        aria-label={t('Filter by taste')}
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
            {t('Leftovers of...')}
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
          {t('Suggestions')}
        </h3>
        {list.length === 0 ? (
          <p className="py-4 text-[0.9375rem] text-ink-2">
            {t('Nothing matches. Try fewer filters.')}
          </p>
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
                        {t('{v0} · {have} of {total}', {
                          v0: formatMinutes(recipe.activeMinutes),
                          have: cov.have,
                          total: cov.total,
                        })}
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
          {t('Something else')}
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
            aria-label={t('Free-text dinner')}
            placeholder={t("Takeout, Out, Dinner at Sam's")}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" variant="secondary" size="lg" disabled={!note.trim()}>
            {t('Add')}
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
  const setServings = useStore((s) => s.setServings)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const cookingFor = useStore((s) => s.settings.cookingFor)
  const members = useStore((s) => s.members.length)
  const notes = useStore((s) => s.notes.filter((n) => n.on === 'day' && n.date === date).length)
  const avoid = useAvoid()
  const ctx = useAppContext()

  // Re-roll just this night, avoiding what else is planned this week.
  function somethingElse() {
    const s = useStore.getState()
    const week = new Set(weekOf(date))
    const taken = s.plan.filter((p) => week.has(p.date) && p.recipeId).map((p) => p.recipeId!)
    const ranked = suggest({
      recipes: s.recipes,
      pantry: s.pantry,
      tastes: s.settings.tastes,
      context: ctx,
      recent: s.cooked.map((c) => c.recipeId),
      ratings: ratingsOf(s.cooked),
      exclude: taken,
      avoid,
    })
    const pick = pickNext(ranked, [])
    if (!pick) {
      toast(t('No other dinners fit. Add a recipe or loosen a filter.'))
      return
    }
    setPlanEntry({
      date,
      slot: 'dinner',
      recipeId: pick.recipe.id,
      cookId: entry?.cookId,
      servings: entry?.servings,
    })
    toast(`${pick.recipe.title} instead`)
    onClose()
  }

  const hasMeal = !!entry && !!(entry.recipeId || entry.leftoversOf)
  const hasContent = !!entry && !!(entry.recipeId || entry.leftoversOf || entry.note)
  return (
    <ul className="-mx-3 space-y-1">
      {entry?.recipeId && (
        <li className="flex min-h-[3.5rem] items-center justify-between gap-3 px-3">
          <span className="font-medium">{t('Cooking for')}</span>
          <Stepper
            value={entry.servings ?? cookingFor}
            onChange={(v) => setServings(date, v)}
            min={1}
            max={24}
            label={t('Cooking for')}
          />
        </li>
      )}
      <Row
        icon={Pencil}
        label={hasContent ? t('Change') : t('Pick something')}
        onClick={() => setKind('pick')}
      />
      {hasMeal && !entry?.done && (
        <Row
          icon={Check}
          label={t('Mark cooked')}
          onClick={() => {
            onCooked(date)
            onClose()
          }}
        />
      )}
      <Row icon={UserRound} label={t('Choose who cooks')} onClick={() => setKind('claim')} />
      {members > 1 && <Row icon={Users} label={t("Who's home")} onClick={() => setKind('home')} />}
      <Row
        icon={MessageSquare}
        label={notes ? t('Notes ({n})', { n: notes }) : t('Leave a note')}
        onClick={() => setKind('notes')}
      />
      {entry?.recipeId && !entry.done && (
        <Row icon={Shuffle} label={t('Something else')} onClick={somethingElse} />
      )}
      {hasContent && (
        <Row icon={Repeat} label={t('Move or swap...')} onClick={() => setKind('move')} />
      )}
      {entry?.note !== t('Not cooking') && entry?.note !== 'Not cooking' && (
        <Row
          icon={Moon}
          label={t('Not cooking this night')}
          onClick={() => {
            withUndo(t('Marked as not cooking'), () =>
              setPlanEntry({ date, slot: 'dinner', note: t('Not cooking'), cookId: entry?.cookId })
            )
            onClose()
          }}
        />
      )}
      {entry && (
        <Row
          icon={Trash2}
          label={t('Remove')}
          danger
          onClick={() => {
            withUndo(t('Dinner removed'), () => clearPlanEntry(date, 'dinner'))
            onClose()
          }}
        />
      )}
    </ul>
  )
}

function HomeBody({ date }: { date: string }) {
  const meals = useStore((s) => s.settings.meals)
  return <WhoHomeBody date={date} slots={plannedMeals(meals)} />
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
    return (
      <p className="text-[0.9375rem] text-ink-2">{t('Add someone to your household first.')}</p>
    )
  return (
    <ul className="space-y-2">
      {members.map((m) => (
        <li key={m.id}>
          <button
            type="button"
            onClick={() => {
              claimNight(date, m.id)
              toast(t('{name} has the night', { name: m.name }))
              onClose()
            }}
            className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left hover:border-ink-3"
          >
            <Avatar member={m} />
            <span className="flex-1 font-medium">{m.name}</span>
            {entry?.cookId === m.id && (
              <Check className="h-5 w-5 text-secondary" aria-label={t('Current cook')} />
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
            {t('Unclaim')}
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
  const dinnerOn = (d: string) => plan.find((p) => p.date === d && p.slot === 'dinner')
  // Leftovers must come after the night they're cooked, in either direction of a swap.
  const cookDateOf = (e?: PlanEntry) =>
    e?.leftoversOf
      ? plan
          .filter((p) => p.recipeId === e.leftoversOf && p.date < e.date)
          .map((p) => p.date)
          .sort()
          .pop()
      : undefined
  const leftoversDateOf = (e?: PlanEntry) =>
    e?.recipeId
      ? plan.find((p) => p.leftoversOf === e.recipeId && p.date === addDays(e.date, 1))?.date
      : undefined
  function problem(d: string): string | undefined {
    const other = dinnerOn(d)
    const cook = cookDateOf(entry)
    if (cook && d <= cook) return t('Before it is cooked')
    const left = leftoversDateOf(entry)
    if (left && d >= left) return t('After its leftovers night')
    const otherCook = cookDateOf(other)
    if (otherCook && date <= otherCook) return t('Would put leftovers first')
    return undefined
  }
  return (
    <ul className="space-y-2">
      {days.map((d) => {
        const other = dinnerOn(d)
        const label = other?.recipeId
          ? recipes.find((r) => r.id === other.recipeId)?.title
          : other?.leftoversOf
            ? t('Leftovers')
            : other?.note
        const why = problem(d)
        return (
          <li key={d}>
            <button
              type="button"
              disabled={!!why}
              onClick={() => {
                movePlanEntry(entry.id, d)
                toast(
                  label
                    ? t('Swapped with {v0}', { v0: dayLabel(d, today) })
                    : t('Moved to {v0}', { v0: dayLabel(d, today) })
                )
                onClose()
              }}
              className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 text-left hover:border-ink-3 disabled:opacity-50"
            >
              <CalendarDays className="h-5 w-5 text-ink-3" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">
                  {shortDay(d)} {fromDateKey(d).getDate()}
                </span>
                {why ? (
                  <span className="block truncate text-sm text-ink-3">{why}</span>
                ) : label ? (
                  <span className="block truncate text-sm text-ink-2">
                    {t('Swaps with {label}', { label })}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
