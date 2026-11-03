'use client'

import { t } from '@/lib/i18n'

import { useMemo, useState } from 'react'
import { Utensils } from 'lucide-react'
import { useStore } from '@/lib/store'
import { entryFor, lunchFromLastNight, mealUsuals } from '@/lib/meals'
import type { MealSlot } from '@/lib/types'
import { dayLabel } from '@/lib/utils'
import { Sheet } from '@/components/ui/Sheet'
import { Chip } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Eyebrow } from '@/components/ui/Card'
import { toast } from '@/components/ui/Toast'

export function slotName(slot: MealSlot): string {
  return slot === 'breakfast' ? t('Breakfast') : slot === 'lunch' ? t('Lunch') : t('Dinner')
}

/** Pick breakfast or lunch for a day: a usual, last night's leftovers, a recipe or a note. */
export function MealSheet({
  date,
  slot,
  today,
  onClose,
}: {
  date: string | null
  slot: MealSlot
  today: string
  onClose: () => void
}) {
  const open = date !== null
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={
        date
          ? t('{meal} on {day}', { meal: slotName(slot), day: dayLabel(date, today) })
          : undefined
      }
    >
      {date && (
        <MealBody key={`${date}-${slot}`} date={date} slot={slot} today={today} onClose={onClose} />
      )}
    </Sheet>
  )
}

function MealBody({
  date,
  slot,
  today,
  onClose,
}: {
  date: string
  slot: MealSlot
  today: string
  onClose: () => void
}) {
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const clearPlanEntry = useStore((s) => s.clearPlanEntry)
  const entry = entryFor(plan, date, slot)
  const [note, setNote] = useState(entry?.note ?? '')
  const [q, setQ] = useState('')

  const usuals = useMemo(() => mealUsuals(plan, recipes, slot, today), [plan, recipes, slot, today])
  const lastNight = slot === 'lunch' ? lunchFromLastNight(plan, recipes, date) : undefined

  const needle = q.trim().toLowerCase()
  const found = needle
    ? recipes.filter((r) => r.title.toLowerCase().includes(needle)).slice(0, 8)
    : []

  function place(patch: { recipeId?: string; leftoversOf?: string; note?: string }) {
    setPlanEntry({ date, slot, cookId: entry?.cookId, servings: entry?.servings, ...patch })
    onClose()
  }

  return (
    <div className="space-y-5">
      {lastNight && (
        <div>
          <Eyebrow>{t('From last night')}</Eyebrow>
          <div className="mt-2">
            <Chip
              selected={entry?.leftoversOf === lastNight.id}
              onClick={() => place({ leftoversOf: lastNight.id })}
            >
              <Utensils className="h-4 w-4" aria-hidden />
              {t('Leftovers: {title}', { title: lastNight.title })}
            </Chip>
          </div>
        </div>
      )}

      {usuals.length > 0 && (
        <div>
          <Eyebrow>{t('Your usuals')}</Eyebrow>
          <div className="mt-2 flex flex-wrap gap-2">
            {usuals.map((u) => (
              <Chip
                key={u.recipeId ?? u.label}
                selected={
                  u.recipeId
                    ? entry?.recipeId === u.recipeId
                    : !!entry?.note && entry.note === u.note
                }
                onClick={() => place(u.recipeId ? { recipeId: u.recipeId } : { note: u.note })}
              >
                {u.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          const v = note.trim()
          if (!v) return
          place({ note: v.slice(0, 80) })
        }}
        className="flex gap-2"
      >
        <Input
          aria-label={t('Write what it is')}
          placeholder={slot === 'breakfast' ? t('Oats, toast, eggs…') : t('Sandwiches, soup, out…')}
          value={note}
          maxLength={80}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button type="submit" disabled={!note.trim()}>
          {t('Save')}
        </Button>
      </form>

      <div>
        <Input
          type="search"
          aria-label={t('Search recipes')}
          placeholder={t('Or pick one of your recipes')}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {found.length > 0 && (
          <ul className="mt-2 divide-y divide-line">
            {found.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => place({ recipeId: r.id })}
                  className="flex min-h-[48px] w-full items-center text-left text-[0.9375rem] font-medium hover:text-accent"
                >
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        {needle && found.length === 0 && (
          <p className="mt-2 text-sm text-ink-3">
            {t('No recipe by that name. Save it as a note instead.')}
          </p>
        )}
      </div>

      {entry && (
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => {
            clearPlanEntry(date, slot)
            toast(t('{meal} cleared', { meal: slotName(slot) }))
            onClose()
          }}
        >
          {t('Clear {meal}', { meal: slotName(slot).toLowerCase() })}
        </Button>
      )}
    </div>
  )
}
