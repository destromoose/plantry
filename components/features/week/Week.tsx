'use client'

import { ratingsOf } from '@/lib/history'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Sparkles } from 'lucide-react'
import { useStore } from '@/lib/store'
import { announce } from '@/lib/announce'
import { householdAvoid } from '@/lib/diet'
import { useAppContext } from '@/components/shell/Providers'
import { pickNext, suggest } from '@/lib/suggest'
import {
  addDays,
  cn,
  dayLabel,
  formatMinutes,
  fromDateKey,
  shortDay,
  toDateKey,
  weekOf,
} from '@/lib/utils'
import { reveal, staggerContainer, checkPop } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { Eyebrow } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { toast } from '@/components/ui/Toast'
import { Thumb } from './Thumb'
import { DaySheets, type SheetKind } from './DaySheets'

export function Week() {
  const ctx = useAppContext()
  const router = useRouter()
  const recipes = useStore((s) => s.recipes)
  const plan = useStore((s) => s.plan)
  const members = useStore((s) => s.members)
  const markCooked = useStore((s) => s.markCooked)
  const generateShop = useStore((s) => s.generateShop)

  const today = toDateKey(new Date(ctx.now))
  const [offset, setOffset] = useState(0)
  const [active, setActive] = useState<{ date: string; kind: SheetKind } | null>(null)
  // The same week everywhere: the one that holds the dinner Tonight is about.
  const weekDates = useMemo(
    () => weekOf(addDays(ctx.targetDate, offset * 7)),
    [ctx.targetDate, offset]
  )
  const firstWeek = useRef(true)
  useEffect(() => {
    if (firstWeek.current) {
      firstWeek.current = false
      return
    }
    announce(`Showing ${range}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offset])

  const entryFor = (d: string) => plan.find((p) => p.date === d && p.slot === 'dinner')
  const isDecided = (d: string) => {
    const e = entryFor(d)
    return !!e && !!(e.recipeId || e.leftoversOf || e.note)
  }
  const decided = weekDates.filter(isDecided).length
  const start = fromDateKey(weekDates[0])
  const end = fromDateKey(weekDates[6])
  const range = `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} to ${end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

  function cookDay(date: string) {
    const e = entryFor(date)
    const r = recipes.find((x) => x.id === (e?.recipeId ?? e?.leftoversOf))
    markCooked(date, { leftovers: r?.leftovers && !!e?.recipeId })
    toast('Cooked. Nicely done.')
  }

  function fillWeek() {
    const before = useStore.getState().plan
    const s = useStore.getState()
    const avoid = householdAvoid(s.settings, s.members)
    // Skip what's already this week and what was on last week, so next week isn't a copy.
    const lastWeek = weekDates.map((d) => addDays(d, -7))
    const used = new Set<string>(
      s.plan
        .filter(
          (p) =>
            (weekDates.includes(p.date) || lastWeek.includes(p.date)) &&
            p.slot === 'dinner' &&
            p.recipeId
        )
        .map((p) => p.recipeId as string)
    )
    let filled = 0
    for (const date of weekDates) {
      if (date < today) continue
      const current = useStore.getState().plan.find((p) => p.date === date && p.slot === 'dinner')
      if (current && (current.recipeId || current.leftoversOf || current.note)) continue

      const prevEntry = useStore
        .getState()
        .plan.find((p) => p.date === addDays(date, -1) && p.slot === 'dinner')
      const prevRecipe = prevEntry?.recipeId
        ? s.recipes.find((r) => r.id === prevEntry.recipeId)
        : undefined
      if (prevRecipe?.leftovers && date > today) {
        s.setPlanEntry({
          date,
          slot: 'dinner',
          leftoversOf: prevRecipe.id,
          cookId: current?.cookId,
        })
        filled++
        continue
      }
      const dow = fromDateKey(date).getDay()
      const ranked = suggest({
        recipes: s.recipes,
        pantry: s.pantry,
        tastes: s.settings.tastes,
        context: { ...ctx, isWeekend: dow === 0 || dow === 6 },
        recent: s.cooked.map((c) => c.recipeId),
      ratings: ratingsOf(s.cooked),
        exclude: [...used],
        avoid,
      })
      // A weighted pick from the top few, so filling twice doesn't give the same week.
      const pick =
        pickNext(ranked, []) ??
        suggest({
          recipes: s.recipes,
          pantry: s.pantry,
          tastes: s.settings.tastes,
          context: ctx,
          avoid,
        })[0]
      if (!pick) continue
      used.add(pick.recipe.id)
      s.setPlanEntry({ date, slot: 'dinner', recipeId: pick.recipe.id, cookId: current?.cookId })
      filled++
    }
    if (!filled) {
      toast('Nothing left to fill this week')
      return
    }
    toast(
      `Filled ${filled} ${filled === 1 ? 'night' : 'nights'}. Planned nights stayed as they were.`,
      {
        action: { label: 'Undo', onClick: () => useStore.setState({ plan: before }) },
      }
    )
  }

  const activeEntry = active ? entryFor(active.date) : undefined

  return (
    <div className="pb-10 pt-4">
      <header className="mb-5">
        <Eyebrow>{range}</Eyebrow>
        <h1 className="mt-1 font-display text-fluid-2xl font-semibold leading-none tracking-tight">
          Your week
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous week"
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next week"
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          {offset !== 0 && (
            <Button variant="outline" size="sm" onClick={() => setOffset(0)}>
              This week
            </Button>
          )}
          <div className="flex-1" />
          <Button
            onClick={fillWeek}
            variant={weekDates.some((d) => d >= today && !isDecided(d)) ? 'primary' : 'secondary'}
          >
            <Sparkles className="h-4 w-4" aria-hidden /> Fill my week
          </Button>
        </div>
      </header>

      <motion.ul
        key={weekDates[0]}
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-3 lg:grid-cols-2"
      >
        {weekDates.map((date, i) => {
          const entry = entryFor(date)
          const recipe = recipes.find((r) => r.id === entry?.recipeId)
          const lo = recipes.find((r) => r.id === entry?.leftoversOf)
          const cook = members.find((m) => m.id === entry?.cookId)
          const isToday = date === today
          const past = date < today
          const decidedRow = isDecided(date)
          const done = !!entry?.done

          const body = recipe ? (
            <>
              <Thumb
                src={recipe.imageUrl}
                className="h-14 w-14 rounded-xl max-[400px]:hidden"
                sizes="56px"
              />
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'line-clamp-2 font-display text-lg font-semibold leading-tight',
                    done && 'text-ink-3'
                  )}
                >
                  {recipe.title}
                </span>
                <span className="block text-sm text-ink-3">
                  {formatMinutes(recipe.activeMinutes)} hands-on
                </span>
              </span>
            </>
          ) : lo ? (
            <>
              <Thumb
                src={lo.imageUrl}
                className="h-14 w-14 rounded-xl opacity-80 max-[400px]:hidden"
                sizes="56px"
              />
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 font-display text-lg font-semibold leading-tight">
                  Leftovers: {lo.title}
                </span>
                <span className="block text-sm text-ink-3">Easy night</span>
              </span>
            </>
          ) : entry?.note ? (
            <span className="min-w-0 flex-1 font-display text-lg font-semibold">{entry.note}</span>
          ) : null

          return (
            <motion.li
              key={date}
              variants={reveal}
              custom={i}
              className={cn(
                'card flex items-center gap-3 p-3 pr-2',
                isToday && 'ring-2 ring-accent',
                (past || done) && 'opacity-70'
              )}
            >
              <div
                className={cn(
                  'flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl',
                  isToday ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink'
                )}
              >
                <span className="text-[0.6875rem] font-semibold uppercase tracking-wider">
                  {shortDay(date)}
                </span>
                <span className="font-display text-xl font-semibold leading-none">
                  {fromDateKey(date).getDate()}
                </span>
              </div>

              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={entry ? `${entry.id}` : `empty-${date}`}
                  variants={reveal}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="flex min-w-0 flex-1"
                >
                  {decidedRow && body ? (
                    recipe ? (
                      <Link
                        href={`/recipes/${recipe.id}`}
                        className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3 rounded-xl"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex min-h-[56px] min-w-0 flex-1 items-center gap-3">
                        {body}
                      </div>
                    )
                  ) : (
                    <button
                      type="button"
                      onClick={() => setActive({ date, kind: 'pick' })}
                      aria-label={`Pick something for ${dayLabel(date, today)}`}
                      className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-ink-3/60 text-sm font-medium text-ink-2 hover:bg-surface-2"
                    >
                      <Plus className="h-4 w-4" aria-hidden /> Pick something
                    </button>
                  )}
                </motion.div>
              </AnimatePresence>

              {done && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={checkPop}
                  className="text-secondary"
                  role="img"
                  aria-label="Cooked"
                >
                  <Check className="h-5 w-5" />
                </motion.span>
              )}
              {cook && <Avatar member={cook} size="sm" />}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Options for ${shortDay(date)} ${fromDateKey(date).getDate()}`}
                onClick={() => setActive({ date, kind: 'menu' })}
              >
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </motion.li>
          )
        })}
      </motion.ul>

      <section
        className="card mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
        aria-label="Week summary"
      >
        <ProgressRing
          value={decided / 7}
          size={56}
          stroke={6}
          tone={decided === 7 ? 'secondary' : 'accent'}
        >
          <span className="font-display text-base font-semibold">{decided}</span>
        </ProgressRing>
        <div className="flex-1">
          <p className="font-display text-lg font-semibold">{decided} of 7 decided</p>
          <p className="text-sm text-ink-2">
            {decided === 7
              ? 'Every night is handled.'
              : 'Undecided nights stay quiet until you want them.'}
          </p>
        </div>
        <Button
          variant={decided === 0 ? 'secondary' : 'primary'}
          disabled={decided === 0}
          onClick={() => {
            const res = generateShop(weekDates)
            if (res.kept) toast('Nothing left to buy for, so your list stayed as it is.')
            router.push('/shop')
          }}
        >
          Make the shopping list
        </Button>
      </section>

      <DaySheets
        date={active?.date ?? null}
        kind={active?.kind ?? 'menu'}
        setKind={(kind) => setActive((a) => (a ? { ...a, kind } : a))}
        onClose={() => setActive(null)}
        today={today}
        ctx={ctx}
        entry={activeEntry}
        weekDates={weekDates}
        onCooked={cookDay}
      />
    </div>
  )
}
