'use client'

import { andList, getLang, t } from '@/lib/i18n'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Mic, Plus, Square } from 'lucide-react'
import { useStore } from '@/lib/store'
import { parseCapture } from '@/lib/capture'
import { usuals } from '@/lib/usuals'
import { withUndo } from '@/lib/undo'
import { announce } from '@/lib/announce'
import { cn, keyOf, toDateKey } from '@/lib/utils'
import { reveal } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'

/** Add one thing or many: "milk, two onions and some rice", typed or said. */
export function captureText(text: string) {
  const items = parseCapture(text)
  if (!items.length) return
  const { shop, pantry, addCaptured } = useStore.getState()
  const onList = new Set(shop.map((i) => i.key))
  const fresh = items.filter((i) => !onList.has(keyOf(i.name)))
  const gone = items.filter((i) => i.outOf && pantry.some((p) => p.key === keyOf(i.name)))
  if (!fresh.length && !gone.length) {
    toast(
      items.length === 1
        ? t('{v0} is already on your list', { v0: items[0].name })
        : t('All of that is already on your list')
    )
    return
  }
  const names = andList(fresh.map((i) => i.name.toLowerCase()))
  let message = fresh.length ? t('Added {names}', { names }) : ''
  if (gone.length) {
    const goneNames = andList(gone.map((i) => i.name.toLowerCase()))
    message = message
      ? t('{added}, and took {gone} out of the pantry', { added: message, gone: goneNames })
      : t('Took {gone} out of the pantry', { gone: goneNames })
  }
  withUndo(message, () => addCaptured(items))
  announce(message)
}

type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

function speechCtor(): (new () => Recognition) | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition) as (new () => Recognition) | undefined
}

/** The add box: type a few things, or tap the mic and say them. */
export function CaptureForm() {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)
  const rec = useRef<Recognition | null>(null)
  const heard = useRef('')

  // Only offer the mic where the browser can listen. Checked after mount so the
  // server and first client render agree.
  useEffect(() => setCanSpeak(!!speechCtor()), [])
  useEffect(() => () => rec.current?.abort(), [])

  function submit() {
    if (!text.trim()) return
    captureText(text)
    setText('')
  }

  function listen() {
    if (listening) {
      rec.current?.stop()
      return
    }
    const Ctor = speechCtor()
    if (!Ctor) return
    const r = new Ctor()
    const device = typeof navigator !== 'undefined' ? navigator.language : ''
    r.lang = getLang() === 'es' ? (/^es/i.test(device) ? device : 'es-ES') : device || 'en-US'
    r.interimResults = true
    r.continuous = true
    heard.current = ''
    r.onresult = (e) => {
      let said = ''
      for (let i = 0; i < e.results.length; i++) said += e.results[i][0].transcript + ' '
      heard.current = said.trim()
      setText(heard.current)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed')
        toast(t('Plantry needs the microphone for this. You can still type.'))
      else if (e.error !== 'aborted' && e.error !== 'no-speech')
        toast(t("Couldn't hear that. Try again, or type it."))
    }
    r.onend = () => {
      setListening(false)
      rec.current = null
      // Saying it is the whole job: add what was heard without another tap.
      if (heard.current) {
        captureText(heard.current)
        setText('')
        heard.current = ''
      }
    }
    try {
      r.start()
      rec.current = r
      setListening(true)
      announce(t('Listening. Say what you need, then tap stop.'))
    } catch {
      toast(t("Couldn't hear that. Try again, or type it."))
    }
  }

  return (
    <form
      className="mb-6"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={listening ? t('Listening…') : t('Milk, 2 onions, rice…')}
          aria-label={t('Add to your list. Separate things with commas.')}
          autoComplete="off"
          maxLength={500}
          readOnly={listening}
        />
        {canSpeak && (
          <Button
            type="button"
            size="icon"
            variant={listening ? 'primary' : 'secondary'}
            aria-label={listening ? t('Stop listening') : t('Say what you need')}
            aria-pressed={listening}
            onClick={listen}
            className={cn('relative shrink-0', listening && 'animate-pulse')}
          >
            {listening ? <Square className="h-4 w-4" /> : <Mic className="h-5 w-5" />}
          </Button>
        )}
        <Button
          type="submit"
          size="icon"
          variant={text.trim() && !listening ? 'primary' : 'secondary'}
          aria-label={t('Add to list')}
          aria-disabled={!text.trim() || listening}
          className="shrink-0"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
      <p className="mt-2 text-sm text-ink-3">
        {listening
          ? t('Try "milk, two onions, and we\'re out of eggs".')
          : canSpeak
            ? t('Add a few at once, or tap the mic and say them.')
            : t('Add a few at once, with commas.')}
      </p>
    </form>
  )
}

/** The things this kitchen buys every trip, one tap each. Hidden until Plantry has learnt some. */
export function Usuals() {
  const bought = useStore((s) => s.bought)
  const shop = useStore((s) => s.shop)
  const addShopItem = useStore((s) => s.addShopItem)
  const list = useMemo(
    () => usuals(bought, new Set(shop.map((i) => i.key)), toDateKey(new Date())),
    [bought, shop]
  )
  if (!list.length) return null

  function addAll() {
    const names = andList(list.map((u) => u.name.toLowerCase()))
    withUndo(t('Added {names}', { names }), () => {
      for (const u of list) addShopItem(u.name, u.aisle)
    })
  }

  return (
    <motion.section
      variants={reveal}
      initial="hidden"
      animate="show"
      aria-labelledby="usuals-title"
      className="mb-8"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="usuals-title" className="font-display text-xl font-semibold tracking-tight">
          {t('Your usuals')}
        </h2>
        {list.length > 1 && (
          <Button variant="ghost" size="sm" onClick={addAll}>
            {t('Add all')}
          </Button>
        )}
      </div>
      <ul className="flex flex-wrap gap-2">
        {list.map((u) => (
          <li key={u.key}>
            <Chip
              onClick={() => {
                addShopItem(u.name, u.aisle)
                toast(t('Added {names}', { names: u.name.toLowerCase() }))
              }}
              aria-label={t('Add {v0}', { v0: u.name })}
            >
              <Plus className="h-4 w-4" aria-hidden /> {u.name}
            </Chip>
          </li>
        ))}
      </ul>
    </motion.section>
  )
}
