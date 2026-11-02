'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Check, CloudSun, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useAvoid } from '@/lib/useAvoid'
import { useAppContext, useStayTonight } from '@/components/shell/Providers'
import { suggest } from '@/lib/suggest'
import { addDays, cn, formatMinutes, fromDateKey, shortDay, toDateKey } from '@/lib/utils'
import { reveal, staggerContainer } from '@/lib/motion'
import { Button, buttonVariants } from '@/components/ui/Button'
import { Eyebrow, SectionTitle } from '@/components/ui/Card'
import { Avatar } from '@/components/ui/Avatar'
import { EnergyPicker } from './EnergyPicker'
import { TonightHero } from './TonightHero'

const WEATHER_KEY = 'plantry-weather-dismissed'

export function Tonight() {
  const ctx = useAppContext()
  const recipes = useStore((s) => s.recipes)
  const pantry = useStore((s) => s.pantry)
  const plan = useStore((s) => s.plan)
  const members = useStore((s) => s.members)
  const settings = useStore((s) => s.settings)
  const cooked = useStore((s) => s.cooked)
  const energyByDate = useStore((s) => s.energyByDate)
  const setEnergy = useStore((s) => s.setEnergy)

  const target = ctx.targetDate
  const today = toDateKey(new Date(ctx.now))
  const energy = energyByDate[target]
  const entry = plan.find((p) => p.date === target && p.slot === 'dinner')
  const me = members.find((m) => m.isMe) ?? members[0]

  const avoid = useAvoid()
  const stayTonight = useStayTonight()
  const todayEntry = plan.find((p) => p.date === today && p.slot === 'dinner')
  const doneTonight =
    todayEntry?.done && target !== today
      ? (recipes.find((r) => r.id === (todayEntry.recipeId ?? todayEntry.leftoversOf))?.title ??
        'dinner')
      : undefined
  const ranked = useMemo(
    () =>
      suggest({
        recipes,
        pantry,
        tastes: settings.tastes,
        energy,
        context: ctx,
        recent: cooked.map((c) => c.recipeId),
        avoid,
      }),
    [recipes, pantry, settings.tastes, energy, ctx, cooked, avoid]
  )

  const greeting =
    ctx.mood === 'dawn'
      ? 'Morning'
      : ctx.mood === 'day'
        ? 'Afternoon'
        : ctx.mood === 'dusk'
          ? 'Evening'
          : 'Late one'
  const dateText = fromDateKey(target).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="space-y-7 pb-8 pt-4"
    >
      <motion.header variants={reveal}>
        <Eyebrow>{ctx.targetLabel}</Eyebrow>
        <h1 className="mt-1 font-display text-fluid-xl font-semibold leading-none tracking-tight">
          {dateText}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-ink-2">
          {me ? `${greeting}, ${me.name}.` : `${greeting}.`}
        </p>
        {doneTonight && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-pill bg-secondary/15 px-3 py-1 text-sm font-medium text-ink">
            <Check className="h-4 w-4 text-secondary" aria-hidden /> Tonight&apos;s {doneTonight} is
            done. Here&apos;s tomorrow.
          </p>
        )}
        {ctx.canStayTonight && (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 mt-1"
            onClick={() => stayTonight(true)}
          >
            Still eating tonight? Stay on today
          </Button>
        )}
      </motion.header>

      <motion.div variants={reveal}>
        <EnergyPicker energy={energy} label={ctx.targetLabel} onSet={(e) => setEnergy(target, e)} />
      </motion.div>

      <motion.div variants={reveal}>
        <TonightHero
          ranked={ranked}
          entry={entry}
          energy={energy}
          targetDate={target}
          today={today}
          reason={ctx.reason}
        />
      </motion.div>

      <motion.div variants={reveal}>
        <NudgeCard nudge={ctx.nudge} targetDate={target} today={today} now={ctx.now} />
      </motion.div>

      <motion.section variants={reveal} aria-label="Next three days">
        <SectionTitle>Next three days</SectionTitle>
        <NextDays target={target} />
      </motion.section>

      {ctx.isWeekend && ctx.hour < 13 && (
        <motion.section
          variants={reveal}
          className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <Eyebrow>Sunday ritual</Eyebrow>
            <p className="mt-1 font-display text-lg font-semibold">
              Ten minutes now saves five decisions later.
            </p>
          </div>
          <Link href="/week" className={cn(buttonVariants({ variant: 'secondary' }), 'self-start')}>
            Plan the week
          </Link>
        </motion.section>
      )}

      {!settings.weatherEnabled && (
        <motion.div variants={reveal}>
          <WeatherOptIn />
        </motion.div>
      )}
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */

function NudgeCard({
  nudge,
  targetDate,
  today,
  now,
}: {
  nudge: string
  targetDate: string
  today: string
  now: string
}) {
  const recipes = useStore((s) => s.recipes)
  const plan = useStore((s) => s.plan)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const [hidden, setHidden] = useState(false)

  if (nudge === 'none' || hidden) return null
  const entry = plan.find((p) => p.date === targetDate && p.slot === 'dinner')
  const recipe = entry?.recipeId ? recipes.find((r) => r.id === entry.recipeId) : undefined

  const shell = (title: string, body: string | undefined, action: React.ReactNode) => (
    <aside
      className="card flex flex-col gap-3 border-l-4 border-l-accent p-5 sm:flex-row sm:items-center sm:justify-between"
      aria-label="A nudge"
    >
      <div>
        <p className="font-display text-lg font-semibold leading-snug">{title}</p>
        {body && <p className="mt-0.5 text-sm text-ink-2">{body}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {action}
        <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setHidden(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  )

  if (nudge === 'plan-week')
    return shell(
      "It's a good morning to plan the week",
      'A few minutes now and the weekday scramble mostly goes away.',
      <Link href="/week" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
        Open the week
      </Link>
    )

  if (nudge === 'defrost' && recipe) {
    const ing = recipe.ingredients.find((i) => i.aisle === 'frozen' || i.aisle === 'meat-fish')
    if (!ing) return null
    return shell(
      `Take the ${ing.name.toLowerCase()} out of the freezer`,
      `For ${recipe.title}. It will thank you by dinner.`,
      null
    )
  }

  if (nudge === 'start-now' && recipe) {
    const eat = new Date(new Date(now).getTime() + recipe.totalMinutes * 60_000)
    const time = eat.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    return shell(
      `Start now and you'll eat by ${time}`,
      `${recipe.title} takes ${formatMinutes(recipe.totalMinutes)} start to finish.`,
      <Link
        href={`/cook/${recipe.id}?date=${targetDate}`}
        className={buttonVariants({ variant: 'primary', size: 'sm' })}
      >
        Cook
      </Link>
    )
  }

  if (nudge === 'leftovers') {
    const yesterday = addDays(today, -1)
    const y = plan.find((p) => p.date === yesterday && p.slot === 'dinner' && p.done)
    const r = y?.recipeId ? recipes.find((x) => x.id === y.recipeId && x.leftovers) : undefined
    if (!r) return null
    return shell(
      `There's ${r.title} in the fridge from yesterday`,
      'Already cooked. Tonight can be easy.',
      entry?.leftoversOf === r.id ? null : (
        <Button
          size="sm"
          onClick={() => setPlanEntry({ date: targetDate, slot: 'dinner', leftoversOf: r.id })}
        >
          Have it {targetDate === today ? 'tonight' : 'tomorrow'}
        </Button>
      )
    )
  }
  return null
}

/* ------------------------------------------------------------------ */

function NextDays({ target }: { target: string }) {
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const members = useStore((s) => s.members)
  const days = [1, 2, 3].map((n) => addDays(target, n))

  return (
    <ul className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 after:w-2 after:shrink-0 after:content-[''] sm:after:hidden md:mx-0 md:px-0">
      {days.map((d) => {
        const e = plan.find((p) => p.date === d && p.slot === 'dinner')
        const r = recipes.find((x) => x.id === (e?.recipeId ?? e?.leftoversOf))
        const title = e?.recipeId
          ? r?.title
          : e?.leftoversOf
            ? `Leftovers: ${r?.title ?? ''}`
            : e?.note
        const cook = members.find((m) => m.id === e?.cookId)
        return (
          <li key={d} className="w-[11rem] shrink-0 snap-start sm:w-auto sm:flex-1">
            <Link
              href="/week"
              className="card flex h-full min-h-[96px] flex-col justify-between gap-3 p-4 hover:border-ink-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-3">
                  {shortDay(d)}
                </span>
                {cook && <Avatar member={cook} size="sm" />}
              </div>
              <span
                className={cn(
                  'line-clamp-2 font-display text-base font-semibold leading-snug',
                  !title && 'font-normal text-ink-3'
                )}
              >
                {title || 'Nothing yet'}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/* ------------------------------------------------------------------ */

function WeatherOptIn() {
  const updateSettings = useStore((s) => s.updateSettings)
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(WEATHER_KEY) === '1')
    } catch {
      setDismissed(false)
    }
  }, [])

  if (dismissed) return null
  return (
    <div className="card flex items-center gap-3 p-4">
      <CloudSun className="h-5 w-5 shrink-0 text-ink-2" aria-hidden />
      <p className="flex-1 text-sm text-ink-2">
        Let Plantry check the weather? Rainy nights lean cozy. It sends your rough location to a
        weather service.
      </p>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => updateSettings({ weatherEnabled: true })}
      >
        Sure
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Dismiss"
        onClick={() => {
          setDismissed(true)
          try {
            localStorage.setItem(WEATHER_KEY, '1')
          } catch {}
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
