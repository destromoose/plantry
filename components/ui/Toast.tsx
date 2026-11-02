'use client'

import { create } from 'zustand'
import { AnimatePresence, motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { settle } from '@/lib/motion'

interface ToastState {
  toasts: { id: number; text: string }[]
  show: (text: string) => void
}

let n = 0
export const useToast = create<ToastState>((set) => ({
  toasts: [],
  show: (text) => {
    const id = ++n
    set((s) => ({ toasts: [...s.toasts, { id, text }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 2400)
  },
}))

export const toast = (text: string) => useToast.getState().show(text)

export function Toaster() {
  const toasts = useToast((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[80] flex flex-col items-center gap-2 px-4 lg:bottom-8">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.14 } }}
            transition={settle}
            role="status"
            className="glass flex items-center gap-2 rounded-pill px-4 py-2.5 text-sm font-medium"
          >
            <Check className="h-4 w-4 text-secondary" />
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
