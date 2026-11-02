'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, CalendarDays, BookOpen, Refrigerator, ShoppingBasket, Users, Settings as SettingsIcon } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { page, settle } from '@/lib/motion'
import { Logo } from '@/components/ui/Logo'
import { Toaster } from '@/components/ui/Toast'
import { useAppContext } from './Providers'

export const tabs = [
  { href: '/', label: 'Tonight', icon: Sparkles },
  { href: '/week', label: 'Week', icon: CalendarDays },
  { href: '/recipes', label: 'Recipes', icon: BookOpen },
  { href: '/pantry', label: 'Pantry', icon: Refrigerator },
  { href: '/shop', label: 'Shop', icon: ShoppingBasket },
] as const

const secondary = [
  { href: '/household', label: 'Household', icon: Users },
  { href: '/settings', label: 'Settings', icon: SettingsIcon },
] as const

/** Routes that take the whole screen with no tab bar. */
const immersive = ['/onboarding', '/cook']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const hydrated = useStore((s) => s.hydrated)
  const onboarded = useStore((s) => s.settings.onboarded)
  const ctx = useAppContext()

  useEffect(() => {
    if (!hydrated) return
    if (!onboarded && pathname !== '/onboarding') router.replace('/onboarding')
    if (onboarded && pathname === '/onboarding') router.replace('/')
  }, [hydrated, onboarded, pathname, router])

  const isImmersive = immersive.some((p) => pathname.startsWith(p))

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={settle} className="text-accent">
          <Logo withWord={false} className="[&>svg]:h-10 [&>svg]:w-10" />
        </motion.div>
      </div>
    )
  }

  if (isImmersive) {
    return (
      <>
        <Toaster />
        <AnimatePresence mode="wait">
          <motion.main key={pathname} variants={page} initial="hidden" animate="show" exit="exit" className="min-h-dvh">
            {children}
          </motion.main>
        </AnimatePresence>
      </>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl lg:gap-8 lg:px-6">
      <Toaster />
      <Sidebar pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-5 pb-1 pt-5 lg:hidden">
          <Link href="/" className="text-ink" aria-label="Plantry home">
            <Logo />
          </Link>
          <div className="flex items-center gap-1">
            {secondary.map((s) => (
              <Link
                key={s.href}
                href={s.href}
                aria-label={s.label}
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2',
                  pathname.startsWith(s.href) && 'bg-surface-2 text-ink'
                )}
              >
                <s.icon className="h-5 w-5" />
              </Link>
            ))}
          </div>
        </header>
        <p className="px-5 font-display text-sm italic text-ink-3 lg:px-0 lg:pt-6" aria-live="polite">
          {ctx.reason}
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.main
            key={pathname}
            variants={page}
            initial="hidden"
            animate="show"
            exit="exit"
            className="flex-1 px-5 pb-28 pt-3 lg:px-0 lg:pb-12"
          >
            {children}
          </motion.main>
        </AnimatePresence>
        <TabBar pathname={pathname} />
      </div>
    </div>
  )
}

function TabBar({ pathname }: { pathname: string }) {
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  return (
    <nav
      aria-label="Primary"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-3 lg:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="glass flex w-full max-w-md items-center justify-between rounded-pill p-1.5">
        {tabs.map((t) => {
          const on = active(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-pill text-[11px] font-medium transition-colors',
                on ? 'text-accent-ink' : 'text-ink-2'
              )}
            >
              {on && (
                <motion.span layoutId="tab-pill" transition={settle} className="absolute inset-0 rounded-pill bg-accent shadow-card" />
              )}
              <t.icon className="relative h-5 w-5" strokeWidth={on ? 2.4 : 2} />
              <span className="relative">{t.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

function Sidebar({ pathname }: { pathname: string }) {
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  return (
    <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col py-8 lg:flex">
      <Link href="/" className="mb-8 px-3 text-ink" aria-label="Plantry home">
        <Logo />
      </Link>
      <nav className="flex flex-col gap-1" aria-label="Primary">
        {[...tabs, ...secondary].map((t, i) => {
          const on = active(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'relative flex h-11 items-center gap-3 rounded-pill px-3 text-[15px] font-medium transition-colors',
                on ? 'text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                i === tabs.length && 'mt-4'
              )}
            >
              {on && <motion.span layoutId="side-pill" transition={settle} className="absolute inset-0 rounded-pill bg-accent shadow-card" />}
              <t.icon className="relative h-5 w-5" />
              <span className="relative">{t.label}</span>
            </Link>
          )
        })}
      </nav>
      <p className="mt-auto px-3 font-display text-sm italic text-ink-3">Dinner, decided.</p>
    </aside>
  )
}
