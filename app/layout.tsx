import type { Metadata, Viewport } from 'next'
import { Fraunces, Inter_Tight } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/shell/Providers'
import { AppShell } from '@/components/shell/AppShell'
import { ErrorBoundary } from '@/components/shell/ErrorBoundary'
import { ServiceWorker } from '@/components/shell/ServiceWorker'
import { SiteMove } from '@/components/shell/SiteMove'
import { SITE_ORIGIN } from '@/lib/site'

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
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: 'Plantry. Dinner, decided.', template: '%s · Plantry' },
  description:
    'The app that answers "what\'s for dinner?" before you ask. Built from your pantry, your energy, and the day outside.',
  applicationName: 'Plantry',
  appleWebApp: { capable: true, title: 'Plantry', statusBarStyle: 'default' },
  icons: {
    icon: [
      { url: '/icons/favicon-48.png', sizes: '48x48', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#FAF4EA',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

const prePaint = `try{var d=document.documentElement,m=localStorage.getItem('plantry-mood');if(m&&/^(dawn|day|dusk|night)$/.test(m))d.dataset.mood=m;var s=JSON.parse(localStorage.getItem('plantry-v1')||'{}').state;s=s&&s.settings;if(s){if(s.highContrast)d.dataset.contrast='more';if(s.textSize&&s.textSize!=='normal')d.dataset.text=s.textSize}}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-mood="day"
      className={`${display.variable} ${sans.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Paint in the last mood before the app loads, so night mode doesn't flash cream. */}
        <script dangerouslySetInnerHTML={{ __html: prePaint }} />
      </head>
      <body className="grain font-sans">
        <div className="ambient" aria-hidden>
          <i />
        </div>
        <ErrorBoundary>
          <Providers>
            <AppShell>{children}</AppShell>
          </Providers>
        </ErrorBoundary>
        <ServiceWorker />
        <SiteMove />
      </body>
    </html>
  )
}
