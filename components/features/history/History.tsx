'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { NotebookPen } from 'lucide-react'
import { useStore } from '@/lib/store'
import { agoLabel, byMonth, monthLabel, mostCooked, ratingLabels } from '@/lib/history'
import type { Rating } from '@/lib/types'
import { cn, fromDateKey, pluralize, toDateKey } from '@/lib/utils'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Chip, Tag } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Thumb } from '@/components/features/week/Thumb'
import { toast } from '@/components/ui/Toast'
import { RatingPicker } from './RatingPicker'

type Filter = 'all' | Rating

/** Everything you've cooked: when, who cooked, how it went, and notes for next time. */
export function History() {
  const cooked = useStore((s) => s.cooked)
  const recipes = useStore((s) => s.recipes)
  const members = useStore((s) => s.members)
  const rateCooked = useStore((s) => s.rateCooked)
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<{ date: string; recipeId: string } | null>(null)

  const today = toDateKey(new Date())
  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const shown = useMemo(
    () => (filter === 'all' ? cooked : cooked.filter((c) => c.rating === filter)),
    [cooked, filter]
  )
  const months = useMemo(() => byMonth(shown), [shown])
  const top = useMemo(() => mostCooked(cooked, 3), [cooked])
  const thisMonth = cooked.filter((c) => c.date.slice(0, 7) === today.slice(0, 7)).length

  // Loved dinners nobody has cooked for a month: worth bringing back.
  const comeback = useMemo(() => {
    const last = new Map<string, string>()
    const loved = new Set<string>()
    for (const c of cooked) {
      if (!last.has(c.recipeId) || c.date > last.get(c.recipeId)!) last.set(c.recipeId, c.date)
      if (c.rating === 'loved') loved.add(c.recipeId)
    }
    return [...loved]
      .filter((id) => byId.has(id) && last.get(id)! < fromKeyMinus(today, 30))
      .slice(0, 3)
  }, [cooked, byId, today])

  const editEntry = editing
    ? cooked.find((c) => c.date === editing.date && c.recipeId === editing.recipeId)
    : undefined

  if (cooked.length === 0) {
    return (
      <div className="space-y-5">
        <PageHeader title="History" subtitle="Every dinner you cook, kept." />
        <EmptyState
          icon={NotebookPen}
          title="Nothing cooked yet"
          body="Finish a dinner in cook mode, or mark a night cooked on Week, and it shows up here with room for a note."
          action={
            <Link
              href="/"
              className="inline-flex h-11 items-center rounded-pill bg-surface-2 px-5 text-[0.9375rem] font-medium hover:bg-line/60"
            >
              See tonight
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        className="mb-2"
        title="History"
        subtitle={`You decided dinner ${pluralize(cooked.length, 'time')}.`}
      />

      <Card>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="This month" value={thisMonth} />
          <Stat label="Loved" value={cooked.filter((c) => c.rating === 'loved').length} />
          <Stat label="Different dinners" value={new Set(cooked.map((c) => c.recipeId)).size} />
        </dl>
        {top.length > 0 && (
          <p className="mt-4 border-t border-line pt-3 text-[0.9375rem] text-ink-2">
            Most cooked:{' '}
            {top
              .filter((t) => byId.has(t.recipeId))
              .map((t) => `${byId.get(t.recipeId)!.title} (${t.times})`)
              .join(', ')}
            .
          </p>
        )}
      </Card>

      {comeback.length > 0 && (
        <Card>
          <SectionTitle>Worth bringing back</SectionTitle>
          <ul className="space-y-2">
            {comeback.map((id) => (
              <li key={id}>
                <Link
                  href={`/recipes/${id}`}
                  className="flex items-center gap-3 rounded-2xl p-1 hover:bg-surface-2"
                >
                  <Thumb src={byId.get(id)?.imageUrl} className="h-12 w-12 rounded-xl" />
                  <span className="min-w-0 flex-1 truncate font-medium">{byId.get(id)?.title}</span>
                  <Tag>Loved it</Tag>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div role="group" aria-label="Show" className="flex flex-wrap gap-2">
        {(['all', 'loved', 'fine', 'not-again'] as Filter[]).map((f) => (
          <Chip key={f} size="sm" selected={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : ratingLabels[f]}
          </Chip>
        ))}
      </div>

      {months.length === 0 && (
        <p className="px-1 text-[0.9375rem] text-ink-2">No dinners with that rating yet.</p>
      )}

      {months.map((m) => (
        <section key={m.key} aria-labelledby={`h-${m.key}`}>
          <h2 id={`h-${m.key}`} className="mb-2 px-1 font-display text-xl font-semibold">
            {monthLabel(m.key)}
            <span className="ml-2 font-sans text-sm font-normal text-ink-3">
              {pluralize(m.entries.length, 'dinner')}
            </span>
          </h2>
          <ul className="card divide-y divide-line overflow-hidden p-0">
            {m.entries.map((c) => {
              const r = byId.get(c.recipeId)
              const who = members.find((x) => x.id === c.cookId)
              return (
                <li key={`${c.date}-${c.recipeId}-${c.index}`}>
                  <button
                    type="button"
                    onClick={() => setEditing({ date: c.date, recipeId: c.recipeId })}
                    className="flex w-full items-center gap-3 p-3.5 text-left hover:bg-surface-2"
                    aria-label={`${r?.title ?? 'A removed recipe'}, ${agoLabel(c.date, today)}. Rate or add a note`}
                  >
                    <Thumb src={r?.imageUrl} className="h-12 w-12 rounded-xl" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-ink">
                        {r?.title ?? 'A removed recipe'}
                      </span>
                      <span className="block text-sm text-ink-3">
                        {fromDateKey(c.date).toLocaleDateString(undefined, {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                        {who ? ` · ${who.name} cooked` : ''}
                      </span>
                      {c.note && (
                        <span className="mt-0.5 block truncate text-sm italic text-ink-2">
                          “{c.note}”
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'shrink-0 text-sm',
                        c.rating === 'loved' ? 'font-medium text-ink' : 'text-ink-3'
                      )}
                    >
                      {c.rating ? ratingLabels[c.rating] : 'Rate'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ))}

      <EditSheet
        key={editing ? `${editing.date}-${editing.recipeId}` : 'none'}
        open={!!editEntry}
        title={editEntry ? (byId.get(editEntry.recipeId)?.title ?? 'This dinner') : ''}
        rating={editEntry?.rating}
        note={editEntry?.note ?? ''}
        recipeId={editEntry?.recipeId}
        onClose={() => setEditing(null)}
        onSave={(rating, note) => {
          if (!editing) return
          rateCooked(editing.date, editing.recipeId, { rating, note })
          setEditing(null)
          toast('Saved')
        }}
      />
    </div>
  )
}

function fromKeyMinus(key: string, days: number) {
  const d = fromDateKey(key)
  d.setDate(d.getDate() - days)
  return toDateKey(d)
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="font-display text-3xl font-semibold tabular-nums">{value}</dd>
      <dt className="text-sm text-ink-3">{label}</dt>
    </div>
  )
}

function EditSheet({
  open,
  title,
  rating: initialRating,
  note: initialNote,
  recipeId,
  onClose,
  onSave,
}: {
  open: boolean
  title: string
  rating?: Rating
  note: string
  recipeId?: string
  onClose: () => void
  onSave: (rating: Rating | undefined, note: string) => void
}) {
  const [rating, setRating] = useState(initialRating)
  const [note, setNote] = useState(initialNote)
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <RatingPicker value={rating} onChange={setRating} />
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">Note for next time</span>
          <Input
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Less chili, double the sauce…"
          />
        </label>
        <div className="flex flex-col gap-2">
          <Button onClick={() => onSave(rating, note)}>Save</Button>
          {recipeId && (
            <Link
              href={`/recipes/${recipeId}`}
              className="inline-flex h-11 items-center justify-center rounded-pill px-5 text-[0.9375rem] font-medium text-ink-2 hover:bg-surface-2"
            >
              Open the recipe
            </Link>
          )}
        </div>
      </div>
    </Sheet>
  )
}
