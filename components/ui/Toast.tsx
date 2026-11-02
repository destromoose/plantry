'use client'

import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check } from 'lucide-react'
import { settle } from '@/lib/motion'

export interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastOptions {
  tone?: 'ok' | 'error'
  action?: ToastAction
  ms?: number
}

interface ToastItem {
  id: number
  text: string
  tone: 'ok' | 'error'
  action?: ToastAction
}

interface ToastState {
  toasts: ToastItem[]
  show: (text: string, opts?: ToastOptions) => void
  dismiss: (id: number) => void
}

let n = 0
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show: (text, opts = {}) => {
    const id = ++n
    const item: ToastItem = { id, text, tone: opts.tone ?? 'ok', action: opts.action }
    // Keep at most three on screen, and never stack the same message twice.
    set((s) => ({ toasts: [...s.toasts.filter((t) => t.text !== text).slice(-2), item] }))
    const ms = opts.ms ?? (opts.action ? 6000 : opts.tone === 'error' ? 5000 : 2400)
    setTimeout(() => get().dismiss(id), ms)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (text: string, opts?: ToastOptions) => useToast.getState().show(text, opts)

export function Toaster() {
  const toasts = useToast((s) => s.toasts)
  const dismiss = useToast((s) => s.dismiss)
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-28 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-8"
    >
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={settle}
            className="glass pointer-events-auto flex max-w-[min(32rem,100%)] items-center gap-2 rounded-pill py-2 pl-4 pr-2 text-sm font-medium"
          >
            {t.tone === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-danger" aria-hidden />
            ) : (
              <Check className="h-4 w-4 shrink-0 text-secondary" aria-hidden />
            )}
            <span className="line-clamp-2 min-w-0 pr-2">{t.text}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action!.onClick()
                  dismiss(t.id)
                }}
                className="min-h-[44px] shrink-0 rounded-pill px-3 font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
