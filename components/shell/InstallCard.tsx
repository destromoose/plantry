'use client'

import { useEffect, useState } from 'react'
import { Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import {
  clearInstallPrompt,
  getInstallPrompt,
  onInstallPrompt,
} from '@/components/shell/ServiceWorker'

/** Shows how to put Plantry on the home screen. Hidden once it is already installed. */
export function InstallCard() {
  const [installed, setInstalled] = useState(true)
  const [ios, setIos] = useState(false)
  const [prompt, setPrompt] = useState<ReturnType<typeof getInstallPrompt>>(null)

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)
    const ua = navigator.userAgent
    setIos(
      /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
    )
    setPrompt(getInstallPrompt())
    const off = onInstallPrompt((e) => {
      setPrompt(e)
      if (!e && window.matchMedia?.('(display-mode: standalone)').matches) setInstalled(true)
    })
    const onInstalled = () => setInstalled(true)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      off()
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  return (
    <Card>
      <SectionTitle>Put Plantry on your home screen</SectionTitle>
      {prompt ? (
        <>
          <p className="text-ink-2">It opens full screen like an app and works without signal.</p>
          <Button
            className="mt-3"
            onClick={async () => {
              await prompt.prompt()
              clearInstallPrompt()
            }}
          >
            Install Plantry
          </Button>
        </>
      ) : ios ? (
        <ol className="list-decimal space-y-2 pl-5 text-ink-2">
          <li>Open this page in Safari.</li>
          <li>
            Tap Share{' '}
            <Share className="inline h-4 w-4 align-[-2px]" aria-label="the Share button" /> at the
            bottom of the screen (on iPad, top right).
          </li>
          <li>
            Scroll down and tap Add to Home Screen{' '}
            <SquarePlus className="inline h-4 w-4 align-[-2px]" aria-hidden />, then Add.
          </li>
          <li>Open Plantry from its new icon. It works full screen and offline.</li>
        </ol>
      ) : (
        <p className="text-ink-2">
          In your browser menu, choose Install app or Add to Home screen. Plantry then opens full
          screen and works offline.
        </p>
      )}
    </Card>
  )
}
