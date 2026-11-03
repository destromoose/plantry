'use client'

import { locale, t } from '@/lib/i18n'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Plus, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { washerFor } from '@/lib/chores'
import { useSync } from '@/lib/sync'
import { SyncCard } from '@/components/features/sync/SyncCard'
import { CalendarCard } from '@/components/features/sync/CalendarCard'
import { MAX_PEOPLE } from '@/components/features/onboarding/Onboarding'
import { withUndo } from '@/lib/undo'
import { avoidLabel } from '@/lib/diet'
import { AvoidPicker } from './AvoidPicker'
import { useAppContext } from '@/components/shell/Providers'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Chip, Tag } from '@/components/ui/Chip'
import { slotName } from '@/components/features/week/MealSheet'
import { plannedMeals } from '@/lib/meals'
import { Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { toast } from '@/components/ui/Toast'
import { reveal, staggerContainer } from '@/lib/motion'
import { fromDateKey, pluralize, shortDay, weekOf } from '@/lib/utils'

export function Household() {
  const settings = useStore((s) => s.settings)
  const members = useStore((s) => s.members)
  const syncCode = useSync((s) => s.code)
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const handoffs = useStore((s) => s.handoffs)
  const cooked = useStore((s) => s.cooked)
  const addMember = useStore((s) => s.addMember)
  const removeMember = useStore((s) => s.removeMember)
  const renameMember = useStore((s) => s.renameMember)
  const claimNight = useStore((s) => s.claimNight)
  const acceptHandoff = useStore((s) => s.acceptHandoff)
  const { targetDate } = useAppContext()
  const today = targetDate

  const [newName, setNewName] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [claimDate, setClaimDate] = useState<string | null>(null)
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null)
  const [avoidFor, setAvoidFor] = useState<string | null>(null)
  const setMemberAvoid = useStore((s) => s.setMemberAvoid)
  const setMemberCooks = useStore((s) => s.setMemberCooks)
  const updateSettings = useStore((s) => s.updateSettings)
  const meals = plannedMeals(settings.meals)
  const cooks = members.filter((m) => m.cooks !== false)
  const avoidMember = members.find((m) => m.id === avoidFor)

  const word = t(settings.householdWord.charAt(0).toUpperCase() + settings.householdWord.slice(1))
  const week = weekOf(today)
  const member = (id?: string) => members.find((m) => m.id === id)
  const recipeTitle = (id?: string) => recipes.find((r) => r.id === id)?.title
  const dinner = (date: string) => plan.find((p) => p.date === date && p.slot === 'dinner')

  function describeDinner(date: string) {
    const e = dinner(date)
    if (!e) return t('Open')
    if (e.recipeId) return recipeTitle(e.recipeId) ?? t('Dinner')
    if (e.leftoversOf)
      return t('Leftovers: {v0}', { v0: recipeTitle(e.leftoversOf) ?? t('last night') })
    return e.note ?? t('Open')
  }

  // Recap
  const weekSet = new Set(week)
  const decided = plan.filter(
    (p) => p.slot === 'dinner' && weekSet.has(p.date) && p.date <= today && (p.recipeId || p.note)
  ).length
  const cookedThisWeek = cooked.filter((c) => weekSet.has(c.date))
  const open = week.filter(
    (d) => d >= today && !(dinner(d)?.recipeId || dinner(d)?.note || dinner(d)?.leftoversOf)
  ).length

  return (
    <div className="space-y-10 pb-8">
      <PageHeader
        className="mb-0"
        title={word}
        subtitle={
          members.length > 1
            ? t('Who cooks which night, and what everyone avoids.')
            : t('Add the people you cook for, and what they avoid.')
        }
      />

      <section aria-labelledby="members-h">
        <SectionTitle>
          <span id="members-h">{t("Who's at the table")}</span>
        </SectionTitle>
        <Card className="p-2">
          <ul>
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 rounded-2xl p-2">
                <Avatar member={m} size="lg" />
                {editing === m.id ? (
                  <Input
                    autoFocus
                    defaultValue={m.name}
                    aria-label={t('Rename {name}', { name: m.name })}
                    className="h-11"
                    onBlur={(e) => {
                      if (e.target.value.trim()) renameMember(m.id, e.target.value.trim())
                      setEditing(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur()
                      if (e.key === 'Escape') setEditing(null)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(m.id)}
                    className="flex h-11 min-w-0 flex-1 items-center text-left font-medium"
                    aria-label={t('Rename {name}', { name: m.name })}
                  >
                    <span className="truncate">{m.name}</span>
                    {m.isMe && (
                      <span className="ml-2 text-sm font-normal text-ink-3">{t('you')}</span>
                    )}
                    {m.cooks === false && (
                      <span className="ml-2 text-sm font-normal text-ink-3">{t('eats only')}</span>
                    )}
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-ink-2"
                  aria-label={`${m.name}: cooking and foods to avoid`}
                  onClick={() => setAvoidFor(m.id)}
                >
                  {m.avoid?.length
                    ? t('Avoids {v0}', {
                        v0:
                          m.avoid.length === 1
                            ? avoidLabel(m.avoid[0]).toLowerCase()
                            : m.avoid.length,
                      })
                    : t('Details')}
                </Button>
                {!m.isMe && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('Remove {name}', { name: m.name })}
                    onClick={() => setRemoving({ id: m.id, name: m.name })}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="flex gap-2 p-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!newName.trim()) return
              if (members.length >= MAX_PEOPLE) {
                toast(t('Up to {MAX_PEOPLE} people for now.', { MAX_PEOPLE }))
                return
              }
              addMember(newName)
              toast(t('{v0} is in', { v0: newName.trim() }))
              setNewName('')
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={t('Add someone')}
              aria-label={t('Add someone')}
              maxLength={40}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!newName.trim()}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden /> {t('Add')}
            </Button>
          </form>
        </Card>
      </section>

      <section aria-labelledby="week-h">
        <SectionTitle>
          <span id="week-h">{t('This week')}</span>
        </SectionTitle>
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="card divide-y divide-line overflow-hidden p-0"
        >
          {week.map((date, i) => {
            const cook = member(dinner(date)?.cookId)
            const washer = washerFor(date, cook?.id, members)
            const isToday = date === today
            return (
              <motion.li key={date} variants={reveal} custom={i}>
                <button
                  type="button"
                  onClick={() => setClaimDate(date)}
                  aria-label={t('{v0}: {v1}. {v2}. Change who cooks.', {
                    v0: shortDay(date),
                    v1: describeDinner(date),
                    v2: cook
                      ? washer
                        ? t('Cooking: {name}. Washing up: {washer}', {
                            name: cook.name,
                            washer: washer.name,
                          })
                        : t('Cooking: {name}', { name: cook.name })
                      : t('Nobody yet'),
                  })}
                  className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className={`w-10 shrink-0 text-sm font-semibold ${isToday ? 'text-accent' : 'text-ink-3'}`}
                  >
                    {shortDay(date)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block truncate ${describeDinner(date) === t('Open') ? 'text-ink-3' : 'font-display text-lg'}`}
                    >
                      {describeDinner(date)}
                    </span>
                    {washer && (
                      <span className="block truncate text-xs text-ink-3" aria-hidden>
                        {t('{washer} washes up', { washer: washer.name })}
                      </span>
                    )}
                  </span>
                  {cook ? (
                    <Avatar member={cook} />
                  ) : (
                    <span
                      className="h-8 w-8 rounded-full border border-dashed border-line"
                      aria-hidden
                    />
                  )}
                </button>
              </motion.li>
            )
          })}
        </motion.ul>
      </section>

      <section aria-labelledby="handoffs-h">
        <SectionTitle>
          <span id="handoffs-h">{t('Hand-offs')}</span>
        </SectionTitle>
        <p className="-mt-2 mb-3 text-sm text-ink-3">
          {syncCode
            ? t('Hand-offs are shared with everyone in your household.')
            : t('Hand-offs show up on other phones once your household shares.')}{' '}
          {!syncCode && (
            <a href="#sharing" className="font-medium text-ink underline underline-offset-4">
              {t('Set up sharing')}
            </a>
          )}
        </p>
        {handoffs.length === 0 ? (
          <p className="card p-5 text-ink-2">
            {t('No hand-offs yet. On Tonight, open More and pick Ask someone else to cook.')}
          </p>
        ) : (
          <ul className="space-y-3">
            {[...handoffs]
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((h) => {
                const title = recipeTitle(h.recipeId)
                return (
                  <li key={h.id} className="card flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {t("{v0} handed {v1} {v2} 's dinner", {
                          v0: member(h.fromId)?.name ?? t('Someone'),
                          v1: member(h.toId)?.name ?? t('Someone').toLowerCase(),
                          v2: fromDateKey(h.date).toLocaleDateString(locale(), {
                            weekday: 'long',
                          }),
                        })}
                      </p>
                      {title && <p className="font-display text-lg">{title}</p>}
                      {h.message && (
                        <p className="text-sm italic text-ink-2">&ldquo;{h.message}&rdquo;</p>
                      )}
                    </div>
                    {h.accepted ? (
                      <Tag>
                        <Check className="mr-1 h-3 w-3" aria-hidden /> {t('Accepted')}
                      </Tag>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          acceptHandoff(h.id)
                          toast(t('Handed over. Done.'))
                        }}
                      >
                        {t('Accept')}
                      </Button>
                    )}
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      <section aria-labelledby="meals-h">
        <Card>
          <SectionTitle>
            <span id="meals-h">{t('Meals we plan')}</span>
          </SectionTitle>
          <p className="mb-3 text-[0.9375rem] text-ink-2">
            {t(
              'Dinner is always on. Breakfast and lunch show as small rows on each day of the week.'
            )}
          </p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('Meals we plan')}>
            {(['breakfast', 'lunch'] as const).map((m) => {
              const on = meals.includes(m)
              return (
                <Chip
                  key={m}
                  selected={on}
                  onClick={() =>
                    updateSettings({
                      meals: plannedMeals(on ? meals.filter((x) => x !== m) : [...meals, m]),
                    })
                  }
                >
                  {on && <Check className="h-4 w-4" aria-hidden />}
                  {slotName(m)}
                </Chip>
              )
            })}
            <Chip selected disabled aria-disabled>
              <Check className="h-4 w-4" aria-hidden />
              {slotName('dinner')}
            </Chip>
          </div>
        </Card>
      </section>

      <section aria-labelledby="recap-h">
        <Card>
          <SectionTitle>
            <span id="recap-h">{t('This week')}</span>
          </SectionTitle>
          <ul className="space-y-1.5 text-[0.9375rem] text-ink-2">
            <li>{t('You decided dinner {v0} so far.', { v0: pluralize(decided, 'time') })}</li>
            {cooks.map((m) => (
              <li key={m.id}>
                {t('{name} cooked', { name: m.name })}{' '}
                {cookedThisWeek.filter((c) => c.cookId === m.id).length}.
              </li>
            ))}
            <li>
              {open === 0
                ? t('Every night is spoken for.')
                : t('{v0} still open.', { v0: pluralize(open, 'night') })}
            </li>
          </ul>
        </Card>
      </section>

      <section id="sharing" aria-label={t('Share with your household')} className="scroll-mt-24">
        <SyncCard />
        <div className="mt-5">
          <CalendarCard />
        </div>
      </section>

      <Sheet
        open={!!claimDate}
        onClose={() => setClaimDate(null)}
        title={claimDate ? t("Who's cooking {v0}?", { v0: shortDay(claimDate) }) : undefined}
      >
        <ul className="space-y-1">
          {cooks.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  if (claimDate) claimNight(claimDate, m.id)
                  toast(t('{name} has it', { name: m.name }))
                  setClaimDate(null)
                }}
                className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl px-2 text-left hover:bg-surface-2"
              >
                <Avatar member={m} />
                <span className="font-medium">{m.name}</span>
                {claimDate && dinner(claimDate)?.cookId === m.id && (
                  <Check
                    className="ml-auto h-4 w-4 text-secondary"
                    aria-label={t('Current cook')}
                  />
                )}
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                if (claimDate) claimNight(claimDate, undefined)
                setClaimDate(null)
              }}
              className="flex min-h-[3.5rem] w-full items-center rounded-2xl px-2 text-left text-ink-2 hover:bg-surface-2"
            >
              {t('Nobody yet')}
            </button>
          </li>
        </ul>
      </Sheet>

      <Sheet open={!!avoidMember} onClose={() => setAvoidFor(null)} title={avoidMember?.name}>
        {avoidMember && (
          <>
            <button
              type="button"
              role="switch"
              aria-checked={avoidMember.cooks !== false}
              onClick={() => setMemberCooks(avoidMember.id, avoidMember.cooks === false)}
              className="mb-6 flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2 text-left"
            >
              <span>
                <span className="block font-medium">{t('Helps cook')}</span>
                <span className="block text-sm text-ink-2">
                  {t("Off for someone who eats but doesn't cook, like a small child.")}
                </span>
              </span>
              <span
                className={`relative h-6 w-10 shrink-0 rounded-pill transition-colors ${avoidMember.cooks !== false ? 'bg-accent' : 'bg-line-strong'}`}
                aria-hidden
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-card transition-all ${avoidMember.cooks !== false ? 'right-0.5' : 'left-0.5'}`}
                />
              </span>
            </button>
            <h3 className="mb-1 font-semibold">{t('Foods to avoid')}</h3>
            <p className="mb-4 text-ink-2">
              {t('Dinners with these are never suggested for anyone in your {householdWord}.', {
                householdWord: t(
                  settings.householdWord.charAt(0).toUpperCase() + settings.householdWord.slice(1)
                ).toLowerCase(),
              })}
            </p>
            <AvoidPicker
              value={avoidMember.avoid ?? []}
              onChange={(v) => setMemberAvoid(avoidMember.id, v)}
            />
            <Button className="mt-6 w-full" onClick={() => setAvoidFor(null)}>
              {t('Done')}
            </Button>
          </>
        )}
      </Sheet>

      <Sheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={t('Remove {v0}?', { v0: removing?.name ?? '' })}
      >
        <p className="mb-5 text-ink-2">
          {t('Their claimed nights go back to open. Dinners stay planned.')}
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            onClick={() => {
              if (removing) {
                const { id, name } = removing
                withUndo(`${name} removed`, () => removeMember(id))
              }
              setRemoving(null)
            }}
          >
            {t('Remove {name}', { name: removing?.name })}
          </Button>
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            {t('Keep')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
