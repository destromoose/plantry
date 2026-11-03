'use client'

import { locale, t } from '@/lib/i18n'
import { useState } from 'react'
import { CalendarPlus, Heart, Lightbulb, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { rankIdeas } from '@/lib/planTogether'
import type { MealIdea, Recipe } from '@/lib/types'
import { cn, dayLabel, fromDateKey } from '@/lib/utils'
import { Input } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { timeAgo } from '@/components/features/together/Notes'

export function ideaTitle(idea: MealIdea, recipes: Recipe[]): string {
  return idea.recipeId
    ? (recipes.find((r) => r.id === idea.recipeId)?.title ?? t('A recipe'))
    : (idea.text ?? '')
}

/** "Craving tacos": what anyone in the household fancies, waiting for a night. */
export function IdeasPool({ weekDates, today }: { weekDates: string[]; today: string }) {
  const ideas = useStore((s) => s.ideas)
  const recipes = useStore((s) => s.recipes)
  const members = useStore((s) => s.members)
  const addIdea = useStore((s) => s.addIdea)
  const removeIdea = useStore((s) => s.removeIdea)
  const toggleIdeaVote = useStore((s) => s.toggleIdeaVote)
  const [text, setText] = useState('')
  const [planning, setPlanning] = useState<MealIdea | null>(null)
  const meId = members.find((m) => m.isMe)?.id
  const together = members.length > 1
  const list = rankIdeas(ideas)

  function add() {
    const v = text.trim()
    if (!v) return
    // Typing a recipe's name links the idea to it, so planning it brings the recipe.
    const match = recipes.find((r) => r.title.toLowerCase() === v.toLowerCase())
    addIdea(match ? { recipeId: match.id } : { text: v })
    setText('')
    toast(together ? t('Added. The others can see it.') : t('Idea saved'))
  }

  return (
    <section className="card mt-6 p-5" aria-labelledby="ideas-title">
      <div className="mb-1 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-accent" aria-hidden />
        <h2 id="ideas-title" className="font-display text-lg font-semibold">
          {t('Ideas')}
        </h2>
      </div>
      <p className="mb-3 text-sm text-ink-2">
        {together
          ? t(
              'Fancy something? Add it here instead of texting. Tap Plan when there’s a night for it.'
            )
          : t('Save meals you fancy, and plan them when there’s a night for them.')}
      </p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <Input
          aria-label={t('Add an idea')}
          placeholder={t('Tacos, that curry from Sunday…')}
          value={text}
          list="idea-recipes"
          onChange={(e) => setText(e.target.value)}
        />
        <datalist id="idea-recipes">
          {recipes.slice(0, 200).map((r) => (
            <option key={r.id} value={r.title} />
          ))}
        </datalist>
        <Button type="submit" variant="secondary" size="lg" disabled={!text.trim()}>
          {t('Add')}
        </Button>
      </form>

      {list.length > 0 && (
        <ul className="mt-3 divide-y divide-line">
          {list.map((idea) => {
            const by = members.find((m) => m.id === idea.by)
            const votes = (idea.votes ?? [])
              .map((v) => members.find((m) => m.id === v))
              .filter((m): m is NonNullable<typeof m> => !!m)
            const mine = !!meId && !!idea.votes?.includes(meId)
            const title = ideaTitle(idea, recipes)
            return (
              <li key={idea.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{title}</p>
                  <p className="flex items-center gap-1 text-xs text-ink-3">
                    {together && by && (by.id === meId ? t('You') : by.name)}
                    {together && by && ' · '}
                    {timeAgo(idea.at)}
                    {votes.length > 0 && (
                      <span className="ml-1 flex -space-x-1">
                        {votes.map((m) => (
                          <Avatar
                            key={m.id}
                            member={m}
                            size="sm"
                            className="h-5 w-5 text-[0.6rem]"
                          />
                        ))}
                      </span>
                    )}
                  </p>
                </div>
                {together && idea.by !== meId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-pressed={mine}
                    aria-label={
                      mine
                        ? t('Take back me too on {title}', { title })
                        : t('Me too on {title}', { title })
                    }
                    onClick={() => toggleIdeaVote(idea.id)}
                    className={cn(mine && 'text-accent')}
                  >
                    <Heart className={cn('h-4 w-4', mine && 'fill-current')} aria-hidden />
                    {t('Me too')}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPlanning(idea)}
                  aria-label={t('Plan {title}', { title })}
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden />
                  {t('Plan')}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('Remove {title}', { title })}
                  onClick={() => {
                    const before = useStore.getState().ideas
                    removeIdea(idea.id)
                    toast(t('Idea removed'), {
                      action: {
                        label: t('Undo'),
                        onClick: () => useStore.setState({ ideas: before }),
                      },
                    })
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}

      <PlanIdeaSheet
        idea={planning}
        weekDates={weekDates}
        today={today}
        onClose={() => setPlanning(null)}
      />
    </section>
  )
}

/** Which night for an idea: this week's nights from today, the free ones first. */
export function PlanIdeaSheet({
  idea,
  weekDates,
  today,
  onClose,
}: {
  idea: MealIdea | null
  weekDates: string[]
  today: string
  onClose: () => void
}) {
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const planIdea = useStore((s) => s.planIdea)
  const nights = weekDates.filter((d) => d >= today)
  const what = (d: string) => {
    const e = plan.find((p) => p.date === d && p.slot === 'dinner')
    if (!e) return undefined
    const r = recipes.find((x) => x.id === (e.recipeId ?? e.leftoversOf))
    if (r && e.leftoversOf) return t('Leftovers: {title}', { title: r.title })
    return r?.title ?? e.note
  }
  const sorted = [...nights].sort(
    (a, b) => Number(!!what(a)) - Number(!!what(b)) || (a < b ? -1 : 1)
  )
  return (
    <Sheet
      open={!!idea}
      onClose={onClose}
      title={idea ? t('Which night for {title}?', { title: ideaTitle(idea, recipes) }) : ''}
    >
      {nights.length === 0 ? (
        <p className="text-ink-2">{t('No nights left this week. Move to next week to plan it.')}</p>
      ) : (
        <ul className="-mx-3 space-y-1">
          {sorted.map((d) => {
            const now = what(d)
            return (
              <li key={d}>
                <button
                  type="button"
                  onClick={() => {
                    if (!idea) return
                    const before = useStore.getState()
                    planIdea(idea.id, d)
                    toast(t('Planned for {day}', { day: dayLabel(d, today) }), {
                      action: {
                        label: t('Undo'),
                        onClick: () =>
                          useStore.setState({ plan: before.plan, ideas: before.ideas }),
                      },
                    })
                    onClose()
                  }}
                  className="flex min-h-[3.5rem] w-full flex-col justify-center rounded-xl px-3 py-1.5 text-left hover:bg-surface-2"
                >
                  <span className="font-medium">
                    {dayLabel(d, today)}
                    <span className="ml-2 text-sm font-normal text-ink-3">
                      {fromDateKey(d).toLocaleDateString(locale(), {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'block w-full truncate text-sm',
                      now ? 'text-ink-3' : 'font-medium text-secondary'
                    )}
                  >
                    {now ? t('Instead of {what}', { what: now }) : t('Free')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
