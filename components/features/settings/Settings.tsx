'use client'

import { langSetting, switchLang, t, type LangSetting } from '@/lib/i18n'

import { PageHeader } from '@/components/ui/PageHeader'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Download, Upload } from 'lucide-react'
import { useStore } from '@/lib/store'
import { checkImport } from '@/lib/schema'
import { useStorageStatus } from '@/lib/storage'
import { withUndo } from '@/lib/undo'
import { useAppContext } from '@/components/shell/Providers'
import { tasteOptions } from '@/components/features/onboarding/Onboarding'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Sheet } from '@/components/ui/Sheet'
import { AvoidPicker } from '@/components/features/household/AvoidPicker'
import { Stepper } from '@/components/ui/Stepper'
import { Toggle } from '@/components/features/cook/Toggle'
import { toast } from '@/components/ui/Toast'
import { settle } from '@/lib/motion'
import { cn, pluralize, toDateKey } from '@/lib/utils'
import type { Settings as SettingsT } from '@/lib/types'
import { currencies, formatMoney } from '@/lib/cost'
import { Input } from '@/components/ui/Field'
import { SyncCard } from '@/components/features/sync/SyncCard'

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
  const [pendingImport, setPendingImport] = useState<{
    text: string
    name: string
    counts: string
    dropped: number
  } | null>(null)
  const storage = useStorageStatus()
  const [lang, setLang] = useState<LangSetting>(() => langSetting())

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
    toast(t('Exported'))
  }

  // Read and check the file first, then ask before replacing anything.
  async function doImport(file?: File) {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    let text: string
    let raw: unknown
    try {
      text = await file.text()
      raw = JSON.parse(text)
    } catch {
      toast(t('Could not read that file.'), { tone: 'error' })
      return
    }
    const res = checkImport(raw)
    if (!res.ok) {
      toast(res.error, { tone: 'error' })
      return
    }
    const d = res.data
    const counts = [
      `${d.recipes.length} recipes`,
      t('{length} pantry items', { length: d.pantry.length }),
      t('{length} planned meals', { length: d.plan.length }),
      t('{length} list items', { length: d.shop.length }),
      `${d.members.length} people`,
    ].join(', ')
    setPendingImport({ text, name: file.name, counts, dropped: res.dropped })
  }

  function confirmImport() {
    if (!pendingImport) return
    const { text } = pendingImport
    setPendingImport(null)
    let failed: string | undefined
    withUndo(t('Imported. Your old data is one tap away.'), () => {
      const res = importData(text)
      if (!res.ok) failed = res.error
    })
    if (failed) toast(failed, { tone: 'error' })
  }

  const toggleTaste = (tItem: SettingsT['tastes'][number]) =>
    update({
      tastes: settings.tastes.includes(tItem)
        ? settings.tastes.filter((x) => x !== tItem)
        : [...settings.tastes, tItem],
    })

  return (
    <div className="space-y-5 pb-8">
      <PageHeader className="mb-2" title={t('Settings')} subtitle={t('Make it yours.')} />

      <Card>
        <SectionTitle>{t('Mood')}</SectionTitle>
        <Choice
          label={t('Mood')}
          value={settings.mood}
          onChange={(v) => update({ mood: v })}
          options={[
            { id: 'auto', label: t('Follow the day') },
            { id: 'system', label: t('Match my device') },
            { id: 'dawn', label: t('Dawn') },
            { id: 'day', label: t('Day') },
            { id: 'dusk', label: t('Dusk') },
            { id: 'night', label: t('Night') },
          ]}
        />
        <p className="mt-4 text-sm text-ink-3">{t('Colours right now ({mood}):', { mood })}</p>
        <div
          className="mt-1.5 flex gap-1.5"
          aria-label={t('Colours of the {mood} mood', { mood })}
          role="img"
        >
          {['bg-canvas', 'bg-surface', 'bg-accent', 'bg-secondary'].map((c) => (
            <div key={c} className={cn('h-4 flex-1 rounded-full', c)} />
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('Language')}</SectionTitle>
        <Choice
          label={t('Language')}
          value={lang}
          onChange={(v) => {
            setLang(v)
            switchLang(v)
          }}
          options={[
            { id: 'auto', label: t('Match my device') },
            { id: 'en', label: 'English' },
            { id: 'es', label: 'Español' },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>{t('Reading')}</SectionTitle>
        <Choice
          label={t('Text size')}
          value={settings.textSize}
          onChange={(v) => update({ textSize: v })}
          options={[
            { id: 'normal', label: t('Normal') },
            { id: 'large', label: t('Large') },
            { id: 'larger', label: t('Larger') },
          ]}
        />
        <div className="mt-3">
          <Toggle
            checked={settings.highContrast}
            onChange={(v) => update({ highContrast: v })}
            label={t('High contrast')}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('Motion')}</SectionTitle>
        <Choice
          label={t('Motion')}
          value={settings.reducedMotion}
          onChange={(v) => update({ reducedMotion: v })}
          options={[
            { id: 'system', label: t('System') },
            { id: 'on', label: t('Reduced') },
            { id: 'off', label: t('Full') },
          ]}
        />
      </Card>

      <Card>
        <SectionTitle>{t('Weather')}</SectionTitle>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.9375rem] text-ink-2">
            {t('Let the weather nudge dinner toward cozy or light.')}
            <span className="mt-1 block text-sm text-ink-3">
              {t(
                'Sends your rough location (to about 10 km) to Open-Meteo, a free weather service, about once an hour. Nothing else leaves this device.'
              )}
            </span>
            {settings.weatherEnabled && weather && (
              <span className="mt-1 block text-ink">
                {t('Right now: {v0}°', { v0: Math.round(weather.tempC) })}
                {weather.precipitation ? t(', rain') : ''}
              </span>
            )}
          </p>
          <button
            type="button"
            role="switch"
            aria-checked={settings.weatherEnabled}
            aria-label={t('Use the weather')}
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
        <SectionTitle>{t('Tastes')}</SectionTitle>
        <div role="group" aria-label={t('Tastes')} className="flex flex-wrap gap-2">
          {tasteOptions.map((tItem) => (
            <Chip
              key={tItem.id}
              selected={settings.tastes.includes(tItem.id)}
              onClick={() => toggleTaste(tItem.id)}
            >
              {tItem.label}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('Cooking for')}</SectionTitle>
        <div className="flex items-center justify-between gap-4">
          <p className="text-[0.9375rem] text-ink-2">
            {t('How many people dinner is usually for. Recipes scale to this.')}
          </p>
          <Stepper
            value={settings.cookingFor}
            onChange={(v) => update({ cookingFor: v })}
            min={1}
            max={24}
            label={t('Cooking for')}
          />
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <Toggle
            checked={settings.cookingWithKids}
            onChange={(v) => update({ cookingWithKids: v })}
            label={t('Kids cook too: add ask-a-grown-up notes on hot and sharp steps')}
          />
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('Keep off the table')}</SectionTitle>
        <p className="mb-4 text-[0.9375rem] text-ink-2">
          {t('Plantry never suggests a dinner with these. Set them for one person in {v0}.', {
            v0: t(settings.householdWord.charAt(0).toUpperCase() + settings.householdWord.slice(1)),
          })}
        </p>
        <AvoidPicker value={settings.avoid} onChange={(v) => update({ avoid: v })} />
        <p className="mt-4 text-sm text-ink-3">
          {t('Plantry checks ingredient names. Always check packaging for allergens.')}
        </p>
      </Card>

      <Card>
        <SectionTitle>{t('Units')}</SectionTitle>
        <Choice
          label={t('Units')}
          value={settings.units}
          onChange={(v) => update({ units: v })}
          options={[
            { id: 'metric', label: t('Grams and millilitres') },
            { id: 'imperial', label: t('Cups, ounces and °F') },
          ]}
        />
        <p className="mt-3 text-sm text-ink-3">
          {t(
            'Recipes, the list and oven temperatures switch over. Spoons and counted things stay as they are.'
          )}
        </p>
      </Card>

      <Card id="budget" className="scroll-mt-24">
        <SectionTitle>{t('Budget')}</SectionTitle>
        <p className="mb-3 text-[0.9375rem] text-ink-2">
          {t(
            'Recipes, Week and Shop show about what dinner costs. With a weekly budget, Fill my week leans toward cheaper dinners.'
          )}
        </p>
        <label className="mb-4 flex items-center justify-between gap-4">
          <span className="text-[0.9375rem] text-ink">{t('Dinners each week, at most')}</span>
          <BudgetInput
            value={settings.weeklyBudget}
            currency={settings.currency}
            onChange={(v) => update({ weeklyBudget: v })}
          />
        </label>
        <Choice
          label={t('Currency')}
          value={settings.currency}
          onChange={(v) => update({ currency: v })}
          options={currencies.map((c) => ({ id: c, label: c }))}
        />
        <p className="mb-2 mt-4 text-sm font-medium text-ink-2">{t('Shops near you are')}</p>
        <Choice
          label={t('Shop prices near you')}
          value={settings.priceLevel}
          onChange={(v) => update({ priceLevel: v })}
          options={[
            { id: 'low', label: t('Cheaper than most') },
            { id: 'average', label: t('About average') },
            { id: 'high', label: t('Pricey') },
          ]}
        />
        <p className="mt-3 text-sm text-ink-3">
          {t(
            'Costs are rough, from typical supermarket prices. Good for comparing dinners, not for the till.'
          )}
        </p>
      </Card>

      <Card>
        <SectionTitle>{t('Nutrition')}</SectionTitle>
        <Toggle
          checked={settings.showNutrition}
          onChange={(v) => update({ showNutrition: v })}
          label={t('Show rough calories, protein, carbs, fat and fibre on recipes')}
        />
      </Card>

      <Card>
        <SectionTitle>{t('Words')}</SectionTitle>
        <p className="mb-3 text-[0.9375rem] text-ink-2">
          {t('What do you call the people you cook for?')}
        </p>
        <Choice
          label={t('Household word')}
          value={settings.householdWord}
          onChange={(v) => update({ householdWord: v })}
          options={[
            { id: 'household', label: t('Household') },
            { id: 'family', label: t('Family') },
            { id: 'home', label: t('Home') },
          ]}
        />
      </Card>

      <SyncCard />

      <Card>
        <SectionTitle>{t('Your data')}</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={doExport}>
            <Download className="h-4 w-4" aria-hidden /> {t('Export')}
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" aria-hidden /> {t('Import')}
          </Button>
          <Button variant="danger" onClick={() => setConfirm(true)}>
            {t('Start over')}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-label={t('Import a Plantry export')}
          onChange={(e) => doImport(e.target.files?.[0])}
        />
        {storage.writeError && (
          <p role="alert" className="mt-3 text-sm font-medium text-danger">
            {storage.writeError === 'full'
              ? t(
                  'Storage is full, so recent changes are not being saved. Export now, then remove old recipes or photos.'
                )
              : t('This browser is blocking storage, so changes are not being saved.')}
          </p>
        )}
        {storage.bytes > 0 && (
          <p className="mt-3 text-sm text-ink-3">
            {t("Using about {v0} KB of this browser's storage.", {
              v0: Math.max(1, Math.round(storage.bytes / 1024)),
            })}
          </p>
        )}
      </Card>

      <p className="px-1 text-center text-sm text-ink-3">
        {t(
          'Plantry keeps everything on this device, in this browser, unless you share it with your household above. Export and Import move it by hand.'
        )}
      </p>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t('Start over?')}>
        <p className="mb-5 text-ink-2">
          {t(
            'This clears your pantry, plan, list, household and the recipes you added from this device. Export first if you want a copy.'
          )}
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
            {t('Yes, clear everything')}
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            {t('Keep it')}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={!!pendingImport}
        onClose={() => setPendingImport(null)}
        title={t('Replace everything with this file?')}
      >
        <p className="mb-2 text-ink-2">
          {t('{name} has {counts}.', { name: pendingImport?.name, counts: pendingImport?.counts })}
        </p>
        <p className="mb-5 text-ink-2">
          {t('It replaces what is on this device now. You can undo right after.')}
          {pendingImport?.dropped
            ? t(' {v0} that cannot be read will be skipped.', {
                v0: pluralize(pendingImport.dropped, 'entry', 'entries'),
              })
            : ''}
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={confirmImport}>{t('Replace with this file')}</Button>
          <Button variant="ghost" onClick={() => setPendingImport(null)}>
            {t('Keep what I have')}
          </Button>
        </div>
      </Sheet>
    </div>
  )
}

/** A whole-number budget. Empty or 0 means no budget. Saves when you leave the box. */
function BudgetInput({
  value,
  currency,
  onChange,
}: {
  value: number
  currency: SettingsT['currency']
  onChange: (v: number) => void
}) {
  const [text, setText] = useState(value ? String(value) : '')
  const commit = () => {
    const n = Math.round(Number(text.replace(/[^\d.]/g, '')))
    const v = Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 0
    setText(v ? String(v) : '')
    if (v !== value) {
      onChange(v)
      toast(v ? t('Budget set to {v0} a week', { v0: formatMoney(v, currency) }) : t('No budget'))
    }
  }
  return (
    <Input
      inputMode="numeric"
      aria-label={t('Weekly dinner budget in {currency}', { currency })}
      placeholder={t('No budget')}
      className="w-32 text-right"
      value={text}
      maxLength={7}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  )
}
