'use client'

import { t } from '@/lib/i18n'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Sparkles,
  CalendarDays,
  BookOpen,
  Refrigerator,
  ShoppingBasket,
  Users,
  NotebookPen,
  Settings as SettingsIcon,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn, pluralize } from '@/lib/utils'
import { page, settle } from '@/lib/motion'
import { Logo } from '@/components/ui/Logo'
import { Skeleton } from '@/components/ui/Skeleton'
import { Toaster } from '@/components/ui/Toast'
import { useAppContext } from './Providers'
import { setWriteErrorListener, useStorageStatus } from '@/lib/storage'
import { toast } from '@/components/ui/Toast'

setWriteErrorListener((kind) =>
  toast(
    kind === 'full'
      ? t('Out of space: this change was not saved. Export your data in Settings.')
      : t('This browser is blocking storage, so changes are not saved.'),
    { tone: 'error', ms: 8000 }
  )
)

export const tabs = [
  { href: '/', label: t('Tonight'), icon: Sparkles },
  { href: '/week', label: t('Week'), icon: CalendarDays },
  { href: '/recipes', label: t('Recipes'), icon: BookOpen },
  { href: '/pantry', label: t('Pantry'), icon: Refrigerator },
  { href: '/shop', label: t('Shop'), icon: ShoppingBasket },
] as const

const secondary = [
  { href: '/household', label: t('Household'), icon: Users },
  { href: '/history', label: t('History'), icon: NotebookPen },
  { href: '/settings', label: t('Settings'), icon: SettingsIcon },
] as const

/** Routes that take the whole screen with no tab bar. */
const immersive = ['/onboarding', '/cook', '/join']

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const hydrated = useStore((s) => s.hydrated)
  const onboarded = useStore((s) => s.settings.onboarded)
  const ctx = useAppContext()

  // Tell people once if some saved data could not be read.
  useEffect(() => {
    if (!hydrated) return
    const { backupKey, droppedItems, memoryOnly } = useStorageStatus.getState()
    const err = { tone: 'error' as const, ms: 8000 }
    if (backupKey)
      toast(t('Some saved data could not be read. A backup copy was kept on this device.'), err)
    else if (droppedItems)
      toast(
        t('Skipped {v0} that could not be read.', {
          v0: pluralize(droppedItems, 'saved entry', 'saved entries'),
        }),
        err
      )
    if (memoryOnly)
      toast(t('This browser blocks storage, so nothing is kept after you close the tab.'), err)
  }, [hydrated])

  useEffect(() => {
    if (!hydrated) return
    if (!onboarded && pathname !== '/onboarding' && pathname !== '/join')
      router.replace('/onboarding')
    if (onboarded && pathname === '/onboarding') router.replace('/')
  }, [hydrated, onboarded, pathname, router])

  const isImmersive = immersive.some((p) => pathname.startsWith(p))

  // After moving to another screen, put focus on its heading so keyboard and screen
  // reader users start at the top of the new page instead of the old button.
  const firstPath = useRef(true)
  useEffect(() => {
    if (!hydrated) return
    if (firstPath.current) {
      firstPath.current = false
      return
    }
    const tItem = setTimeout(() => {
      const h = document.querySelector<HTMLElement>('#main h1')
      if (!h) return
      h.setAttribute('tabindex', '-1')
      h.focus({ preventScroll: true })
    }, 80)
    return () => clearTimeout(tItem)
  }, [pathname, hydrated])

  if (!hydrated) return <LoadingShell />

  const extras = (
    <>
      <Toaster />
      <p id="announcer" className="sr-only" aria-live="polite" />
    </>
  )

  if (isImmersive) {
    return (
      <>
        {extras}
        <motion.div
          id="main"
          key={pathname}
          variants={page}
          initial="hidden"
          animate="show"
          className="min-h-dvh"
        >
          {children}
        </motion.div>
      </>
    )
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-7xl md:gap-6 md:px-6 lg:gap-10">
      <a
        href="#main"
        className="sr-only z-[90] rounded-pill bg-accent px-4 py-2 font-semibold text-accent-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {t('Skip to content')}
      </a>
      {extras}
      <Sidebar pathname={pathname} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-5 pb-1 pt-5 md:hidden">
          <Link href="/" className="text-ink" aria-label={t('Plantry home')}>
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
        {/* The day's context line belongs to Tonight only. */}
        {pathname === '/' && (
          <p className="px-5 font-display text-sm italic text-ink-3 md:px-0 md:pt-6">
            {ctx.reason}
          </p>
        )}
        {/* Enter-only page fade. An exit animation with mode="wait" never finishes under the
            App Router and leaves the new page invisible, so pages only animate in. */}
        <motion.main
          id="main"
          key={pathname}
          variants={page}
          initial="hidden"
          animate="show"
          className={cn('flex-1 px-5 pb-28 pt-3 md:px-0 md:pb-12', pathname !== '/' && 'md:pt-8')}
        >
          {children}
        </motion.main>
        {/* The recipe page has its own action bar; one floating bar at a time. */}
        {!/^\/recipes\/(?!new$)[^/]+$/.test(pathname) && <TabBar pathname={pathname} />}
      </div>
    </div>
  )
}

function TabBar({ pathname }: { pathname: string }) {
  const active = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href))
  return (
    <nav
      aria-label={t('Primary')}
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-3 md:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="glass flex w-full max-w-md items-center justify-between rounded-pill p-1.5">
        {tabs.map((tItem) => {
          const on = active(tItem.href)
          return (
            <Link
              key={tItem.href}
              href={tItem.href}
              aria-current={on ? 'page' : undefined}
              className={cn(
                'relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-pill text-[0.6875rem] font-medium transition-colors',
                on ? 'text-accent-ink' : 'text-ink-2'
              )}
            >
              {on && (
                <motion.span
                  layoutId="tab-pill"
                  transition={settle}
                  className="absolute inset-0 rounded-pill bg-accent shadow-card"
                />
              )}
              <tItem.icon className="relative h-5 w-5" strokeWidth={on ? 2.4 : 2} />
              <span className="relative">{tItem.label}</span>
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
    // A slim icon rail on tablets, the full list with labels on wide screens.
    <aside className="sticky top-0 hidden h-dvh w-16 shrink-0 flex-col py-8 md:flex lg:w-56">
      <Link href="/" className="mb-8 px-3 text-ink" aria-label={t('Plantry home')}>
        <Logo withWord={false} className="lg:hidden" />
        <Logo className="hidden lg:flex" />
      </Link>
      <nav className="flex flex-col gap-1" aria-label={t('Primary')}>
        {[...tabs, ...secondary].map((tItem, i) => {
          const on = active(tItem.href)
          return (
            <Link
              key={tItem.href}
              href={tItem.href}
              aria-current={on ? 'page' : undefined}
              title={tItem.label}
              className={cn(
                'relative flex h-11 items-center gap-3 rounded-pill px-3 text-[0.9375rem] font-medium transition-colors max-lg:justify-center',
                on ? 'text-accent-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
                i === tabs.length && 'mt-4'
              )}
            >
              {on && (
                <motion.span
                  layoutId="side-pill"
                  transition={settle}
                  className="absolute inset-0 rounded-pill bg-accent shadow-card"
                />
              )}
              <tItem.icon className="relative h-5 w-5 shrink-0" />
              <span className="relative max-lg:sr-only">{tItem.label}</span>
            </Link>
          )
        })}
      </nav>
      <p className="mt-auto hidden px-3 font-display text-sm italic text-ink-3 lg:block">
        {t('Dinner, decided.')}
      </p>
    </aside>
  )
}

/** Shown for the moment before saved data is read: the page's shape, not a blank screen. */
function LoadingShell() {
  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-7xl md:gap-6 md:px-6 lg:gap-10"
      aria-busy="true"
      aria-label={t('Loading')}
    >
      <div className="hidden w-16 shrink-0 py-8 md:block lg:w-56">
        <div className="px-3 text-accent">
          <Logo withWord={false} />
        </div>
      </div>
      <div className="flex-1 space-y-4 px-5 pt-16 md:px-0">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-10 w-2/3 max-w-sm" />
        <Skeleton className="aspect-[16/9] max-h-[32vh] w-full max-w-3xl" />
        <Skeleton className="h-6 w-1/2 max-w-xs" />
        <Skeleton className="h-12 w-full max-w-md" />
      </div>
    </div>
  )
}
