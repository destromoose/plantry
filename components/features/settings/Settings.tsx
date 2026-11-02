'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Download, Upload } from 'lucide-react'
import { useStore } from '@/lib/store'
import { useAppContext } from '@/components/shell/Providers'
import { tasteOptions } from '@/components/features/onboarding/Onboarding'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/components/ui/Toast'
import { settle } from '@/lib/motion'
import { cn, toDateKey } from '@/lib/utils'
import type { Settings as SettingsT } from '@/lib/types'

function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o.id} selected={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </Chip>
      ))}
    </div>
  )
}

export function Settings() {
  const router = useRouter()
  const settings = useStore((s) => s.settings)
  const weather = useStore((s) => s.weather)
  const update = useStore((s) => s.updateSettings)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)
  const resetAll = useStore((s) => s.resetAll)
  const { mood } = useAppContext()
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState(false)

  function doExport() {
    const blob = new Blob([exportData()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `plantry-export-${toDateKey(new Date())}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    toast('Exported')
  }

  async function doImport(file?: File) {
    if (!file) return
    try {
      const res = importData(await file.text())
      toast(res.ok ? 'Imported' : (res.error ?? 'Could not import that'))
    } catch {
      toast('Could not read that file')
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  const toggleTaste = (t: SettingsT['tastes'][number]) =>
    update({
      tastes: settings.tastes.includes(t)
        ? settings.tastes.filter((x) => x !== t)
        : [...settings.tastes, t],
    })

  return (
    <div className="space-y-5 pb-8">
      <header className="mb-2">
        <h1 className="font-display text-fluid-2xl font-semibold leading-[1.05] tracking-tight">
          Settings
        </h1>
        <p className="mt-1 text-ink-2">Make it yours.</p>
      </header>

      <Card>
        <SectionTitle>Mood</SectionTitle>
        <Choice
          label="Mood"
          value={settings.mood}
          onChange={(v) => update({ mood: v })}
          options={[
            { id: 'auto', label: 'Follow the day' },
            { id: 'dawn', label: 'Dawn' },
            { id: 'day', label: 'Day' },
            { id: 'dusk', label: 'Dusk' },
            { id: 'night', label: 'Night' },
          ]}
        />
        <div className="mt-4 flex gap-2" aria-label={`Preview of the ${mood} mood`} role="img">
          {['bg-canvas', 'bg-surface', 'bg-accent', 'bg-secondary'].map((c) => (
            <div key={c} className={cn('h-10 flex-1 rounded-2xl border border-line', c)} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Motion</SectionTitle>
        <Choice
          label="Motion"
          value={settings.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
          options={[
            { id: 'system', label: 'System' },
            { id: 'on', label: 'Reduced' },
            { id: 'off', label: 'Full' },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Weather</SectionTitle>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[15px] text-ink-2">
            Let the weather nudge dinner toward cozy or light.
            {settings.weatherEnabled && weather && (
              <span className="mt-1 block text-ink">
                Right now: {Math.round(weather.tempC)}°{weather.precipitation ? ', rain' : ''}
              </span>
            )}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={settings.weatherEnabled}
            aria-label="Use the weather"
            onClick={() => update({ weatherEnabled: !settings.weatherEnabled })}
            className={cn(
              'flex h-8 w-14 shrink-0 items-center rounded-pill p-1 transition-colors',
              settings.weatherEnabled ? 'justify-end bg-accent' : 'justify-start bg-line'
            )}
          >
            <motion.span
              layout
              transition={settle}
              className="h-6 w-6 rounded-full bg-surface shadow-card"
            />
          </button>
        </div>
      </Card>

      <Card>
        <SectionTitle>Tastes</SectionTitle>
        <div role="group" aria-label="Tastes" className="flex flex-wrap gap-2">
          {tasteOptions.map((t) => (
            <Chip
              key={t.id}
              selected={settings.tastes.includes(t.id)}
              onClick={() => toggleTaste(t.id)}
            >
              {t.label}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Units</SectionTitle>
        <Choice
          label="Units"
          value={settings.units}
          onChange={(v) => update({ units: v })}
          options={[
            { id: 'metric', label: 'Metric' },
            { id: 'imperial', label: 'Imperial' },
          ]}
        />
        <p className="mt-3 text-sm text-ink-3">Saved for later. Conversion is not built yet.</p>
      </Card>

      <Card>
        <SectionTitle>Words</SectionTitle>
        <p className="mb-3 text-[15px] text-ink-2">What do you call the people you cook for?</p>
        <Choice
          label="Household word"
          value={settings.householdWord}
          onChange={(v) => update({ householdWord: v })}
          options={[
            { id: 'household', label: 'Household' },
            { id: 'family', label: 'Family' },
            { id: 'home', label: 'Home' },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>Your data</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={doExport}>
            <Download className="h-4 w-4" aria-hidden /> Export
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden /> Import
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            Start over
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label="Import a Plantry export"
          onChange={(e) => doImport(e.target.files?.[0])}
        />
      </Card>

      <p className="px-1 text-center text-sm text-ink-3">
        Plantry keeps everything on this device. No account, no tracking.
      </p>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Start over?">
        <p className="mb-5 text-ink-2">
          This clears your pantry, plan, list and household from this device. Export first if you
          want a copy.
        </p>
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            onClick={() => {
              resetAll()
              setConfirm(false)
              router.replace('/onboarding')
            }}
          >
            Yes, clear everything
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            Keep it
          </Button>
        </div>
      </Sheet>
    </div>
  )
}
