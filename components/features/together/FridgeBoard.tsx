'use client'

import { t } from '@/lib/i18n'

import { useStore } from '@/lib/store'
import { boardNotes } from '@/lib/together'
import { toDateKey } from '@/lib/utils'
import { SectionTitle } from '@/components/ui/Card'
import { NoteCard, NotesThread } from './Notes'

/** The fridge door: notes for everyone that aren't about one meal or item. */
export function FridgeBoard() {
  const notes = useStore((s) => s.notes)
  const today = toDateKey(new Date())
  const board = boardNotes(notes, today)
  const older = notes.filter((n) => n.on === 'board').length - board.length
  return (
    <section aria-labelledby="board-h">
      <SectionTitle>
        <span id="board-h">{t('Fridge board')}</span>
      </SectionTitle>
      <p className="-mt-2 mb-3 text-sm text-ink-3">
        {t('Notes for the whole house. They clear after a week unless you pin them.')}
      </p>
      <div className="card p-4">
        {board.length > 0 && (
          <ul className="mb-4 space-y-3">
            {board.map((n) => (
              <NoteCard key={n.id} note={n} canPin />
            ))}
          </ul>
        )}
        <NotesThread
          where={{ on: 'board' }}
          placeholder={t('Bins go out Thursday…')}
          canPin
          only="composer"
        />
        {older > 0 && (
          <p className="mt-3 text-xs text-ink-3">
            {t('{n} older notes are hidden.', { n: older })}
          </p>
        )}
      </div>
    </section>
  )
}
