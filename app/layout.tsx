import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter_Tight } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/shell/Providers'
import { AppShell } from '@/components/shell/AppShell'

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  axes: ['opsz', 'SOFT'],
  display: 'swap',
})

const sans = Inter_Tight({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Plantry. Dinner, decided.',
  description:
    'The app that answers "what\'s for dinner?" before you ask. Built from your pantry, your energy, and the day outside.',
  applicationName: 'Plantry',
  appleWebApp: { capable: true, title: 'Plantry', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: '#FAF4EA',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-mood="day" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <body className="grain font-sans">
        <div className="ambient" aria-hidden>
          <i />
        </div>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
