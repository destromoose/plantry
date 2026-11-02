'use client'

import { t } from '@/lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BookmarkPlus, Check, ChevronDown, Copy } from 'lucide-react'
import { bookmarkletCode } from '@/lib/pageCapture'
import { settle } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'

/**
 * The "Save to Plantry" bookmark: one tap on any recipe page brings it in, even from
 * sites that turn apps away, because it reads the page in the cook's own browser.
 */
export function SaveButtonHelp({ open: forceOpen = false }: { open?: boolean }) {
  const [open, setOpen] = useState(forceOpen)
  const [copied, setCopied] = useState(false)
  const [code, setCode] = useState('')
  const link = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (forceOpen) setOpen(true)
  }, [forceOpen])

  useEffect(() => {
    const c = bookmarkletCode(location.origin)
    setCode(c)
    // Set outside React, which warns about javascript: links.
    link.current?.setAttribute('href', c)
  }, [open])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast(t('Couldn’t copy. Press and hold the button instead.'))
    }
  }

  return (
    <div className="rounded-3xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-3xl p-4 text-left"
      >
        <BookmarkPlus className="h-5 w-5 shrink-0 text-accent" aria-hidden />
        <span className="flex-1">
          <span className="block font-medium">{t('Save from any site with one tap')}</span>
          <span className="block text-sm text-ink-2">
            {t('Add a Save to Plantry button to your browser.')}
          </span>
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={settle}>
          <ChevronDown className="h-5 w-5 text-ink-3" aria-hidden />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={settle}
            className="space-y-4 px-4 pb-4"
          >
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('On a computer')}</p>
              <p className="text-sm text-ink-2">
                {t(
                  'Drag this button to your bookmarks bar. On any recipe page, click it and the recipe opens here.'
                )}
              </p>
              <a
                ref={link}
                onClick={(e) => {
                  e.preventDefault()
                  toast(t('Drag it to your bookmarks bar, then use it on a recipe page.'))
                }}
                draggable
                className="inline-flex h-11 cursor-grab items-center gap-2 rounded-pill bg-accent px-5 text-[0.9375rem] font-medium text-accent-ink shadow-card active:cursor-grabbing"
              >
                <BookmarkPlus className="h-4 w-4" aria-hidden />
                {t('Save to Plantry')}
              </a>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('On a phone')}</p>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-2">
                <li>{t('Copy the button’s code.')}</li>
                <li>{t('Bookmark this page, then edit the bookmark.')}</li>
                <li>{t('Name it Save to Plantry and paste the code in as its address.')}</li>
                <li>{t('On a recipe page, open your bookmarks and tap it.')}</li>
              </ol>
              <Button variant="secondary" size="sm" onClick={() => void copy()}>
                {copied ? (
                  <Check className="h-4 w-4" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copied ? t('Copied') : t('Copy the code')}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
