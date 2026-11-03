'use client'

import { t } from '@/lib/i18n'

import { useRef, useState } from 'react'
import { Camera, Pin, PinOff, Trash2, X } from 'lucide-react'
import { useStore } from '@/lib/store'
import { notesFor, QUICK_REPLIES, repliesTo, shrinkPhoto } from '@/lib/together'
import type { HouseNote, Member } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'

export type NoteWhere = {
  on: HouseNote['on']
  date?: string
  slot?: HouseNote['slot']
  itemKey?: string
}

export function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  const hours = Math.round(mins / 60)
  if (hours < 24) return t('{n} h ago', { n: hours })
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** The notes in one place, with replies, and a box to leave a new one. */
export function NotesThread({
  where,
  placeholder,
  canPin,
  only,
}: {
  where: NoteWhere
  placeholder: string
  canPin?: boolean
  /** Just the box to leave a note, when the list is shown elsewhere. */
  only?: 'composer'
}) {
  const notes = useStore((s) => s.notes)
  const list = notesFor(notes, where)
  if (only === 'composer') return <Composer where={where} placeholder={placeholder} />
  return (
    <div className="space-y-4">
      {list.length === 0 && (
        <p className="text-sm text-ink-3">
          {t('No notes yet. Leave one and the others see it here.')}
        </p>
      )}
      <ul className="space-y-3">
        {list.map((n) => (
          <NoteCard key={n.id} note={n} canPin={canPin} />
        ))}
      </ul>
      <Composer where={where} placeholder={placeholder} />
    </div>
  )
}

function who(members: Member[], id: string | undefined) {
  return members.find((m) => m.id === id)
}

export function NoteCard({ note, canPin }: { note: HouseNote; canPin?: boolean }) {
  const members = useStore((s) => s.members)
  const replies = useStore((s) => s.replies)
  const addReply = useStore((s) => s.addReply)
  const removeNote = useStore((s) => s.removeNote)
  const togglePin = useStore((s) => s.togglePinNote)
  const claimNight = useStore((s) => s.claimNight)
  const [text, setText] = useState('')
  const [writing, setWriting] = useState(false)
  const author = who(members, note.by)
  const me = members.find((m) => m.isMe)
  const mine = !note.by || note.by === me?.id
  const thread = repliesTo(replies, note.id)

  function reply(v: string) {
    const s = v.trim()
    if (!s) return
    addReply(note.id, s)
    // "I'll cook" on a day's note claims that night.
    if (
      s === t("I'll cook") &&
      note.on === 'day' &&
      note.date &&
      me &&
      (!note.slot || note.slot === 'dinner')
    ) {
      claimNight(note.date, me.id)
      toast(t("You're cooking that night"))
    }
    setText('')
    setWriting(false)
  }

  return (
    <li className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-start gap-3">
        {author ? (
          <Avatar member={author} size="sm" className="mt-0.5" />
        ) : (
          <span className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-surface-2" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-3">
            {author?.name ?? t('Someone')} · {timeAgo(note.at)}
            {note.pinned && <span className="ml-1 text-accent">· {t('Pinned')}</span>}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[0.9375rem] text-ink">
            {note.text}
          </p>
          {note.photo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={note.photo}
              alt={t('Photo with the note')}
              className="mt-2 max-h-56 rounded-xl border border-line object-cover"
            />
          )}
        </div>
        <div className="-mr-1 -mt-1 flex shrink-0">
          {canPin && (
            <button
              type="button"
              onClick={() => togglePin(note.id)}
              aria-label={note.pinned ? t('Unpin') : t('Pin to the board')}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
            >
              {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          )}
          {mine && (
            <button
              type="button"
              onClick={() => removeNote(note.id)}
              aria-label={t('Delete note')}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-danger"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {thread.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-line pl-9 pt-3">
          {thread.map((r) => {
            const by = who(members, r.by)
            return (
              <li key={r.id} className="text-sm">
                <span className="font-semibold text-ink">{by?.name ?? t('Someone')}</span>{' '}
                <span className="text-ink-2">{r.text}</span>
                <span className="ml-1 text-xs text-ink-3">{timeAgo(r.at)}</span>
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap gap-1.5 pl-9">
        {QUICK_REPLIES[note.on].map((q) => (
          <Chip key={q} size="sm" onClick={() => reply(t(q))}>
            {t(q)}
          </Chip>
        ))}
        {!writing && (
          <Chip size="sm" onClick={() => setWriting(true)}>
            {t('Reply…')}
          </Chip>
        )}
      </div>
      {writing && (
        <form
          className="mt-2 flex gap-2 pl-9"
          onSubmit={(e) => {
            e.preventDefault()
            reply(text)
          }}
        >
          <Input
            className="h-10 text-sm"
            aria-label={t('Reply')}
            placeholder={t('Reply…')}
            autoFocus
            value={text}
            maxLength={200}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!text.trim()}>
            {t('Send')}
          </Button>
        </form>
      )}
    </li>
  )
}

function Composer({ where, placeholder }: { where: NoteWhere; placeholder: string }) {
  const addNote = useStore((s) => s.addNote)
  const [text, setText] = useState('')
  const [photo, setPhoto] = useState<string | undefined>()
  const file = useRef<HTMLInputElement>(null)

  async function pick(f: File | undefined) {
    if (!f) return
    try {
      const p = await shrinkPhoto(f)
      if (p.length > 400_000) {
        toast(t('That photo is too big to share. Try another.'))
        return
      }
      setPhoto(p)
    } catch {
      toast(t("Couldn't read that photo"))
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim() && !photo) return
        addNote({ ...where, text: text.trim() || t('Photo'), photo })
        setText('')
        setPhoto(undefined)
      }}
      className="space-y-2"
    >
      {photo && (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photo} alt="" className="h-20 rounded-xl border border-line object-cover" />
          <button
            type="button"
            onClick={() => setPhoto(undefined)}
            aria-label={t('Remove photo')}
            className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <Input
          aria-label={t('Leave a note')}
          placeholder={placeholder}
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          ref={file}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            void pick(e.target.files?.[0])
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="secondary"
          aria-label={t('Add a photo')}
          size="icon"
          className="shrink-0"
          onClick={() => file.current?.click()}
        >
          <Camera className="h-5 w-5" />
        </Button>
        <Button type="submit" className="shrink-0" disabled={!text.trim() && !photo}>
          {t('Leave it')}
        </Button>
      </div>
    </form>
  )
}

/** A sheet with the notes for one day or one list item. */
export function NotesSheet({
  where,
  title,
  placeholder,
  onClose,
}: {
  where: NoteWhere | null
  title: string
  placeholder: string
  onClose: () => void
}) {
  return (
    <Sheet open={where !== null} onClose={onClose} title={title}>
      {where && <NotesThread where={where} placeholder={placeholder} />}
    </Sheet>
  )
}
