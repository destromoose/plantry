'use client'

import { locale, t } from '@/lib/i18n'

import { useState } from 'react'
import Link from 'next/link'
import type { Recipe } from '@/lib/types'
import { useStore } from '@/lib/store'
import { addDays, dayLabel, fromDateKey } from '@/lib/utils'
import { Sheet } from '@/components/ui/Sheet'
import { buttonVariants } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Field'
import { Avatar } from '@/components/ui/Avatar'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/utils'

/** Lists the next seven days after the target date; picking one plans the recipe there. */
export function SaveSheet({
  open,
  onClose,
  recipe,
  targetDate,
  today,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  recipe: Recipe
  targetDate: string
  today: string
  onSaved: () => void
}) {
  const plan = useStore((s) => s.plan)
  const recipes = useStore((s) => s.recipes)
  const setPlanEntry = useStore((s) => s.setPlanEntry)
  const days = Array.from({ length: 7 }, (_, i) => addDays(targetDate, i + 1))

  return (
    <Sheet open={open} onClose={onClose} title={t('Save for another night')}>
      <p className="mb-4 text-[0.9375rem] text-ink-2">
        {t('{title} will be waiting. Which night?', { title: recipe.title })}
      </p>
      <ul className="space-y-2">
        {days.map((d) => {
          const entry = plan.find((p) => p.date === d && p.slot === 'dinner')
          const taken = entry?.recipeId
            ? recipes.find((r) => r.id === entry.recipeId)?.title
            : (entry?.note ?? (entry?.leftoversOf ? t('Leftovers') : undefined))
          return (
            <li key={d}>
              <button
                type="button"
                onClick={() => {
                  setPlanEntry({
                    date: d,
                    slot: 'dinner',
                    recipeId: recipe.id,
                    cookId: entry?.cookId,
                  })
                  toast(t('Saved for {v0}', { v0: dayLabel(d, today) }))
                  onSaved()
                  onClose()
                }}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 text-left hover:border-ink-3"
              >
                <span>
                  <span className="block font-medium">{dayLabel(d, today)}</span>
                  <span className="block text-sm text-ink-3">
                    {fromDateKey(d).toLocaleDateString(locale(), {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </span>
                <span className="max-w-[55%] truncate text-sm text-ink-2">
                  {taken ? t('Replaces {taken}', { taken }) : t('Free')}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </Sheet>
  )
}

export function HandoffSheet({
  open,
  onClose,
  recipe,
  date,
  planned,
  when = 'tonight',
}: {
  open: boolean
  onClose: () => void
  recipe?: Recipe
  date: string
  /** Only a planned dinner is passed on. Otherwise the night is, and they choose. */
  planned?: boolean
  /** "tonight", "tomorrow" or a weekday. */
  when?: string
}) {
  const members = useStore((s) => s.members)
  const createHandoff = useStore((s) => s.createHandoff)
  const [message, setMessage] = useState('')
  const me = members.find((m) => m.isMe) ?? members[0]
  const others = members.filter((m) => m.id !== me?.id && m.cooks !== false)

  return (
    <Sheet open={open} onClose={onClose} title={t('Ask someone else to cook')}>
      {others.length === 0 || !me ? (
        <div>
          <p className="text-[0.9375rem] text-ink-2">
            {t('Add someone who cooks to your household first. Then you can pass the apron.')}
          </p>
          <Link
            href="/household"
            onClick={onClose}
            className={cn(buttonVariants({ variant: 'primary' }), 'mt-5')}
          >
            {t('Go to household')}
          </Link>
        </div>
      ) : (
        <div>
          <p className="mb-4 text-[0.9375rem] text-ink-2">
            {planned && recipe
              ? t("Who's cooking {title} {when}?", { title: recipe.title, when })
              : t("Who's cooking {when}? They pick what to make.", { when })}
          </p>
          <Label htmlFor="handoff-msg">{t('Add a note (optional)')}</Label>
          <Input
            id="handoff-msg"
            value={message}
            maxLength={120}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('Rice is already washed')}
            className="mb-4"
          />
          <ul className="space-y-2">
            {others.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    createHandoff({
                      date,
                      fromId: me.id,
                      toId: m.id,
                      recipeId: planned ? recipe?.id : undefined,
                      message: message.trim() || undefined,
                    })
                    toast(t('{name} is cooking {when}', { name: m.name, when }))
                    setMessage('')
                    onClose()
                  }}
                  className="flex min-h-[56px] w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-2.5 text-left hover:border-ink-3"
                >
                  <Avatar member={m} />
                  <span className="font-medium">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-ink-3">
            {t(
              'Nothing is sent to them. Plantry only lives on this device, so tell them or show them this screen.'
            )}
          </p>
        </div>
      )}
    </Sheet>
  )
}
