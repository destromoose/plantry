'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Plus, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { MAX_PEOPLE } from '@/components/features/onboarding/Onboarding'
import { withUndo } from '@/lib/undo'
import { avoidLabel } from '@/lib/diet'
import { AvoidPicker } from './AvoidPicker'
import { useAppContext } from '@/components/shell/Providers'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Tag } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { reveal, staggerContainer } from '@/lib/motion'
import { fromDateKey, pluralize, shortDay, weekOf } from '@/lib/utils'

export function Household() {
  const settings = useStore((s) => s.settings)
  const members = useStore((s) => s.members)
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
  const avoidMember = members.find((m) => m.id === avoidFor)

  const word = settings.householdWord.charAt(0).toUpperCase() + settings.householdWord.slice(1)
  const week = weekOf(today)
  const member = (id?: string) => members.find((m) => m.id === id)
  const recipeTitle = (id?: string) => recipes.find((r) => r.id === id)?.title
  const dinner = (date: string) => plan.find((p) => p.date === date && p.slot === 'dinner')

  function describeDinner(date: string) {
    const e = dinner(date)
    if (!e) return 'Open'
    if (e.recipeId) return recipeTitle(e.recipeId) ?? 'Dinner'
    if (e.leftoversOf) return `Leftovers: ${recipeTitle(e.leftoversOf) ?? 'last night'}`
    return e.note ?? 'Open'
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
      <header>
        <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
          {word}
        </h1>
        <p className="mt-1 text-ink-2">The dinner load, shared.</p>
      </header>

      <section aria-labelledby="members-h">
        <SectionTitle>
          <span id="members-h">Who&apos;s cooking</span>
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
                    aria-label={`Rename ${m.name}`}
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
                    aria-label={`Rename ${m.name}`}
                  >
                    <span className="truncate">{m.name}</span>
                    {m.isMe && <span className="ml-2 text-sm font-normal text-ink-3">you</span>}
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-ink-2"
                  aria-label={`What ${m.name} avoids`}
                  onClick={() => setAvoidFor(m.id)}
                >
                  {m.avoid?.length
                    ? `Avoids ${m.avoid.length === 1 ? avoidLabel(m.avoid[0]).toLowerCase() : m.avoid.length}`
                    : 'Avoids'}
                </Button>
                {!m.isMe && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${m.name}`}
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
                toast(`Up to ${MAX_PEOPLE} people for now.`)
                return
              }
              addMember(newName)
              toast(`${newName.trim()} is in`)
              setNewName('')
            }}
          >
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add someone"
              aria-label="Add someone"
              maxLength={40}
            />
            <Button
              type="submit"
              variant="secondary"
              disabled={!newName.trim()}
              className="shrink-0"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add
            </Button>
          </form>
        </Card>
      </section>

      <section aria-labelledby="week-h">
        <SectionTitle>
          <span id="week-h">This week</span>
        </SectionTitle>
        <motion.ul
          variants={staggerContainer}
          initial="hidden"
          animate="show"
          className="card divide-y divide-line overflow-hidden p-0"
        >
          {week.map((date, i) => {
            const cook = member(dinner(date)?.cookId)
            const isToday = date === today
            return (
              <motion.li key={date} variants={reveal} custom={i}>
                <button
                  type="button"
                  onClick={() => setClaimDate(date)}
                  aria-label={`${shortDay(date)}: ${describeDinner(date)}. ${cook ? `Cooking: ${cook.name}` : 'Nobody yet'}. Change who cooks.`}
                  className="flex min-h-[3.5rem] w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <span
                    className={`w-10 shrink-0 text-sm font-semibold ${isToday ? 'text-accent' : 'text-ink-3'}`}
                  >
                    {shortDay(date)}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate ${describeDinner(date) === 'Open' ? 'text-ink-3' : 'font-display text-lg'}`}
                  >
                    {describeDinner(date)}
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
          <span id="handoffs-h">Hand-offs</span>
        </SectionTitle>
        {handoffs.length === 0 ? (
          <p className="card p-5 text-ink-2">
            No hand-offs yet. On the Tonight screen, tap Hand off to pass a night to someone.
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
                        {member(h.fromId)?.name ?? 'Someone'} handed{' '}
                        {member(h.toId)?.name ?? 'someone'}{' '}
                        {fromDateKey(h.date).toLocaleDateString(undefined, { weekday: 'long' })}
                        &apos;s dinner
                      </p>
                      {title && <p className="font-display text-lg">{title}</p>}
                      {h.message && (
                        <p className="text-sm italic text-ink-2">&ldquo;{h.message}&rdquo;</p>
                      )}
                    </div>
                    {h.accepted ? (
                      <Tag>
                        <Check className="mr-1 h-3 w-3" aria-hidden /> Accepted
                      </Tag>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => {
                          acceptHandoff(h.id)
                          toast('Handed over. Done.')
                        }}
                      >
                        Accept
                      </Button>
                    )}
                  </li>
                )
              })}
          </ul>
        )}
      </section>

      <section aria-labelledby="recap-h">
        <Card>
          <SectionTitle>
            <span id="recap-h">This week</span>
          </SectionTitle>
          <ul className="space-y-1.5 text-[0.9375rem] text-ink-2">
            <li>You decided dinner {pluralize(decided, 'time')} so far.</li>
            {members.map((m) => (
              <li key={m.id}>
                {m.name} cooked {cookedThisWeek.filter((c) => c.cookId === m.id).length}.
              </li>
            ))}
            <li>
              {open === 0
                ? 'Every night is spoken for.'
                : `${pluralize(open, 'night')} still open.`}
            </li>
          </ul>
        </Card>
      </section>

      <Sheet
        open={!!claimDate}
        onClose={() => setClaimDate(null)}
        title={claimDate ? `Who's cooking ${shortDay(claimDate)}?` : undefined}
      >
        <ul className="space-y-1">
          {members.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => {
                  if (claimDate) claimNight(claimDate, m.id)
                  toast(`${m.name} has it`)
                  setClaimDate(null)
                }}
                className="flex min-h-[3.5rem] w-full items-center gap-3 rounded-2xl px-2 text-left hover:bg-surface-2"
              >
                <Avatar member={m} />
                <span className="font-medium">{m.name}</span>
                {claimDate && dinner(claimDate)?.cookId === m.id && (
                  <Check className="ml-auto h-4 w-4 text-secondary" aria-label="Current cook" />
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
              Nobody yet
            </button>
          </li>
        </ul>
      </Sheet>

      <Sheet
        open={!!avoidMember}
        onClose={() => setAvoidFor(null)}
        title={avoidMember ? `What does ${avoidMember.name} avoid?` : undefined}
      >
        {avoidMember && (
          <>
            <p className="mb-4 text-ink-2">
              Dinners with these are never suggested for anyone in your {settings.householdWord}.
            </p>
            <AvoidPicker
              value={avoidMember.avoid ?? []}
              onChange={(v) => setMemberAvoid(avoidMember.id, v)}
            />
            <Button className="mt-6 w-full" onClick={() => setAvoidFor(null)}>
              Done
            </Button>
          </>
        )}
      </Sheet>

      <Sheet
        open={!!removing}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? ''}?`}
      >
        <p className="mb-5 text-ink-2">
          Their claimed nights go back to open. Dinners stay planned.
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
            Remove {removing?.name}
          </Button>
          <Button variant="ghost" onClick={() => setRemoving(null)}>
            Keep
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
