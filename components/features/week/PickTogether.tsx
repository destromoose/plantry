'use client'

import { t } from '@/lib/i18n'
import { useMemo, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { Heart, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { suggest } from '@/lib/suggest'
import { ratingsOf } from '@/lib/history'
import { useAvoid } from '@/lib/useAvoid'
import { useAppContext } from '@/components/shell/Providers'
import { formatMinutes } from '@/lib/utils'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { Thumb } from './Thumb'

/**
 * Pick together: each person goes through the same few dinners on their own phone, yes or
 * no. A yes is an idea; a yes on something the other already said yes to is a match.
 */
export function PickTogether({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ctx = useAppContext()
  const recipes = useStore((s) => s.recipes)
  const pantry = useStore((s) => s.pantry)
  const tastes = useStore((s) => s.settings.tastes)
  const cooked = useStore((s) => s.cooked)
  const members = useStore((s) => s.members)
  const ideas = useStore((s) => s.ideas)
  const addIdea = useStore((s) => s.addIdea)
  const toggleIdeaVote = useStore((s) => s.toggleIdeaVote)
  const avoid = useAvoid()
  const meId = members.find((m) => m.isMe)?.id
  const [seen, setSeen] = useState<string[]>([])

  // Ideas the others said yes to come first, so a match is quick to find.
  const deck = useMemo(() => {
    const ranked = suggest({
      recipes,
      pantry,
      tastes,
      context: ctx,
      recent: cooked.map((c) => c.recipeId),
      ratings: ratingsOf(cooked),
      avoid,
    }).map((s) => s.recipe)
    const answered = new Set(
      ideas
        .filter((i) => i.recipeId && (i.by === meId || i.votes?.includes(meId ?? '')))
        .map((i) => i.recipeId as string)
    )
    const theirs = ideas
      .filter((i) => i.recipeId && !answered.has(i.recipeId))
      .map((i) => recipes.find((r) => r.id === i.recipeId))
      .filter((r): r is NonNullable<typeof r> => !!r)
    const rest = ranked.filter((r) => !answered.has(r.id) && !theirs.some((x) => x.id === r.id))
    return [...theirs, ...rest].slice(0, 12)
    // The deck is set when the sheet opens; answers then shouldn't reshuffle it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const left = deck.filter((r) => !seen.includes(r.id))
  const card = left[0]

  function answer(yes: boolean) {
    if (!card) return
    setSeen((s) => [...s, card.id])
    if (!yes) return
    const theirs = useStore
      .getState()
      .ideas.find((i) => i.recipeId === card.id && i.by !== meId && !i.votes?.includes(meId ?? ''))
    if (theirs) {
      toggleIdeaVote(theirs.id)
      const who = members.find((m) => m.id === theirs.by)?.name ?? t('Someone')
      toast(t('It’s a match: {title}. {name} fancies it too.', { title: card.title, name: who }))
    } else addIdea({ recipeId: card.id })
  }

  function drag(_: unknown, info: PanInfo) {
    if (info.offset.x > 90) answer(true)
    else if (info.offset.x < -90) answer(false)
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        setSeen([])
        onClose()
      }}
      title={t('Pick together')}
    >
      <p className="mb-4 text-sm text-ink-2">
        {t(
          'Say yes or no to a few dinners. The others do the same on their phones, and what you both like is a match in Ideas.'
        )}
      </p>
      {card ? (
        <>
          <div className="relative h-[19rem]">
            <AnimatePresence initial={false}>
              <motion.div
                key={card.id}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.6}
                onDragEnd={drag}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: 0, transition: { duration: 0.15 } }}
                className="absolute inset-0 flex cursor-grab touch-pan-y flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm active:cursor-grabbing"
              >
                <Thumb src={card.imageUrl} className="h-48 w-full" sizes="400px" />
                <div className="p-4">
                  <p className="font-display text-xl font-semibold leading-tight">{card.title}</p>
                  <p className="mt-1 text-sm text-ink-3">
                    {t('{v0} hands-on', { v0: formatMinutes(card.activeMinutes) })}
                    {ideas.some((i) => i.recipeId === card.id && i.by !== meId) &&
                      ` · ${t('Someone said yes')}`}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button variant="outline" size="lg" onClick={() => answer(false)}>
              <X className="h-5 w-5" aria-hidden /> {t('Not this')}
            </Button>
            <Button size="lg" onClick={() => answer(true)}>
              <Heart className="h-5 w-5" aria-hidden /> {t('Yes please')}
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-ink-3">
            {t('{n} left. Swipe right for yes, left for no.', { n: left.length })}
          </p>
        </>
      ) : (
        <div className="py-6 text-center">
          <p className="font-display text-lg font-semibold">{t('That’s all for now')}</p>
          <p className="mt-1 text-sm text-ink-2">
            {t('Your yeses are in Ideas. Matches show at the top.')}
          </p>
          <Button className="mt-4" onClick={onClose}>
            {t('Done')}
          </Button>
        </div>
      )}
    </Sheet>
  )
}
