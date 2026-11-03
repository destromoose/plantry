'use client'

import { locale, t } from '@/lib/i18n'

import { ratingsOf } from '@/lib/history'
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react'
import { presenceLine } from '@/lib/together'
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
  pluralize,
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
import { MealSheet, slotName } from './MealSheet'
import { entryFor as mealEntry, mealLabel, smallMeals } from '@/lib/meals'
import type { MealSlot } from '@/lib/types'
import { WeekBudget } from '@/components/features/budget/WeekBudget'
import { recipeCost } from '@/lib/cost'

export function Week() {
  const ctx = useAppContext()
  const router = useRouter()
  const recipes = useStore((s) => s.recipes)
  const plan = useStore((s) => s.plan)
  const members = useStore((s) => s.members)
  const markCooked = useStore((s) => s.markCooked)
  const generateShop = useStore((s) => s.generateShop)
  const presence = useStore((s) => s.presence)
  const weekly = useStore((s) => s.presenceWeekly)
  const notes = useStore((s) => s.notes)
  const meId = members.find((m) => m.isMe)?.id

  const today = toDateKey(new Date(ctx.now))
  const [offset, setOffset] = useState(0)
  const [active, setActive] = useState<{ date: string; kind: SheetKind } | null>(null)
  const [meal, setMeal] = useState<{ date: string; slot: MealSlot } | null>(null)
  const small = smallMeals(useStore((s) => s.settings.meals))
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
    announce(t('Showing {range}', { range }))
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
  const range = `${start.toLocaleDateString(locale(), { month: 'short', day: 'numeric' })} to ${end.toLocaleDateString(locale(), { month: 'short', day: 'numeric' })}`

  function cookDay(date: string) {
    const e = entryFor(date)
    const r = recipes.find((x) => x.id === (e?.recipeId ?? e?.leftoversOf))
    markCooked(date, { leftovers: r?.leftovers && !!e?.recipeId })
    toast(t('Cooked. Nicely done.'))
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
        ...(s.settings.weeklyBudget > 0
          ? {
              costOf: (r) => recipeCost(r, r.servings, s.settings).perServing,
              budgetPerServing: s.settings.weeklyBudget / (7 * Math.max(1, s.settings.cookingFor)),
            }
          : {}),
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
      toast(t('Nothing left to fill this week'))
      return
    }
    toast(
      t('Filled {v0}. Planned nights stayed as they were.', { v0: pluralize(filled, 'night') }),
      {
        action: { label: t('Undo'), onClick: () => useStore.setState({ plan: before }) },
      }
    )
  }

  const activeEntry = active ? entryFor(active.date) : undefined

  return (
    <div className="pb-10 pt-4">
      <header className="mb-5">
        <Eyebrow>{range}</Eyebrow>
        <h1 className="mt-1 font-display text-fluid-2xl font-semibold leading-none tracking-tight">
          {t('Your week')}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('Previous week')}
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('Next week')}
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
          {offset !== 0 && (
            <Button variant="outline" size="sm" onClick={() => setOffset(0)}>
              {t('This week')}
            </Button>
          )}
          <div className="flex-1" />
          <Button
            onClick={fillWeek}
            variant={weekDates.some((d) => d >= today && !isDecided(d)) ? 'primary' : 'secondary'}
          >
            <Sparkles className="h-4 w-4" aria-hidden /> {t('Fill my week')}
          </Button>
        </div>
        <WeekBudget dates={weekDates} className="mt-4" />
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
          const homeLine = presenceLine(members, presence, weekly, date, 'dinner', meId, t)
          const noteCount = notes.filter((n) => n.on === 'day' && n.date === date).length

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
                  {t('{v0} hands-on', { v0: formatMinutes(recipe.activeMinutes) })}
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
                  {t('Leftovers: {title}', { title: lo.title })}
                </span>
                <span className="block text-sm text-ink-3">{t('Easy night')}</span>
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
                'card p-3 pr-2',
                isToday && 'ring-2 ring-accent',
                (past || done) && 'opacity-90'
              )}
            >
              <div className={cn('flex items-center gap-3', (past || done) && 'opacity-80')}>
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
                        aria-label={t('Pick something for {v0}', { v0: dayLabel(date, today) })}
                        className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-xl border border-dashed border-ink-3/60 text-sm font-medium text-ink-2 hover:bg-surface-2"
                      >
                        <Plus className="h-4 w-4" aria-hidden /> {t('Pick something')}
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
                    aria-label={t('Cooked')}
                  >
                    <Check className="h-5 w-5" />
                  </motion.span>
                )}
                {cook && <Avatar member={cook} size="sm" />}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('Options for {v0} {v1}', {
                    v0: shortDay(date),
                    v1: fromDateKey(date).getDate(),
                  })}
                  onClick={() => setActive({ date, kind: 'menu' })}
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </div>
              {small.length > 0 && (
                <ul className="mt-1.5 flex flex-wrap gap-x-1 border-t border-line pt-1.5">
                  {small.map((slot) => {
                    const e = mealEntry(plan, date, slot)
                    const label = mealLabel(e, recipes)
                    const lo = !!e?.leftoversOf
                    const what = label && (lo ? t('Leftovers: {title}', { title: label }) : label)
                    return (
                      <li key={slot} className={cn('min-w-0', what ? 'basis-full' : 'basis-auto')}>
                        <button
                          type="button"
                          onClick={() => setMeal({ date, slot })}
                          aria-label={
                            what
                              ? t('{meal} on {day}: {what}. Change it', {
                                  meal: slotName(slot),
                                  day: dayLabel(date, today),
                                  what,
                                })
                              : t('Add {meal} for {day}', {
                                  meal: slotName(slot).toLowerCase(),
                                  day: dayLabel(date, today),
                                })
                          }
                          className="flex min-h-[40px] w-full items-center gap-2 rounded-lg px-2 text-left text-[0.9375rem] hover:bg-surface-2"
                        >
                          {what ? (
                            <>
                              <span className="w-[4.75rem] shrink-0 text-[0.6875rem] font-semibold uppercase tracking-wider text-ink-3">
                                {slotName(slot)}
                              </span>
                              <span className="min-w-0 flex-1 truncate font-medium text-ink">
                                {what}
                              </span>
                            </>
                          ) : (
                            <span className="flex items-center gap-1 text-sm text-ink-3">
                              <Plus className="h-3.5 w-3.5" aria-hidden /> {slotName(slot)}
                            </span>
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
              {(homeLine || noteCount > 0) && (
                <div className="mt-1 flex flex-wrap gap-x-1 border-t border-line pt-1">
                  {homeLine && (
                    <button
                      type="button"
                      onClick={() => setActive({ date, kind: 'home' })}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm text-ink-2 hover:bg-surface-2"
                    >
                      <Users className="h-4 w-4 text-ink-3" aria-hidden />
                      {homeLine}
                    </button>
                  )}
                  {noteCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActive({ date, kind: 'notes' })}
                      className="flex min-h-[40px] items-center gap-1.5 rounded-lg px-2 text-sm text-ink-2 hover:bg-surface-2"
                    >
                      <MessageSquare className="h-4 w-4 text-ink-3" aria-hidden />
                      {noteCount === 1 ? t('1 note') : t('{n} notes', { n: noteCount })}
                    </button>
                  )}
                </div>
              )}
            </motion.li>
          )
        })}
      </motion.ul>

      <section
        className="card mt-6 flex flex-col gap-4 p-5 sm:flex-row sm:items-center"
        aria-label={t('Week summary')}
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
          <p className="font-display text-lg font-semibold">
            {t('{decided} of 7 decided', { decided })}
          </p>
          <p className="text-sm text-ink-2">
            {decided === 7
              ? t('Every night is handled.')
              : t('Undecided nights stay quiet until you want them.')}
          </p>
        </div>
        <Button
          variant={decided === 0 ? 'secondary' : 'primary'}
          disabled={decided === 0}
          onClick={() => {
            const res = generateShop(weekDates)
            if (res.kept) toast(t('Nothing left to buy for, so your list stayed as it is.'))
            router.push('/shop')
          }}
        >
          {t('Make the shopping list')}
        </Button>
      </section>

      <MealSheet
        date={meal?.date ?? null}
        slot={meal?.slot ?? 'lunch'}
        today={today}
        onClose={() => setMeal(null)}
      />

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
