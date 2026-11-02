'use client'

import { t } from '@/lib/i18n'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  Plus,
  Timer,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Aisle, Recipe, Taste } from '@/lib/types'
import { keyOf, uid } from '@/lib/utils'
import { detectTimer, parseRecipe, type ParsedRecipe } from '@/lib/parseRecipe'
import { findUrl, hostOf, type ImportedRecipe } from '@/lib/importRecipe'
import { CAPTURE_KEY, readCapture } from '@/lib/pageCapture'
import { SaveButtonHelp } from './SaveButtonHelp'
import { settle } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { Chip, Tag } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Label, Select, Textarea } from '@/components/ui/Field'
import { Stepper } from '@/components/ui/Stepper'
import { SectionTitle } from '@/components/ui/Card'
import { toast } from '@/components/ui/Toast'
import { RecipeImage, isImageUrl } from './RecipeImage'
import { parseAmount } from '@/lib/quantity'
import { guessAisle } from '@/lib/pantryGuess'
import { copyOfRecipe } from '@/lib/recipeCopy'
import { announce } from '@/lib/announce'
import { allTastes, tasteLabels } from './tastes'

const aisles: { id: Aisle; label: string }[] = [
  { id: 'produce', label: t('Produce') },
  { id: 'dairy', label: t('Dairy') },
  { id: 'meat-fish', label: t('Meat and fish') },
  { id: 'bakery', label: t('Bakery') },
  { id: 'pantry', label: t('Pantry') },
  { id: 'frozen', label: t('Frozen') },
  { id: 'spices', label: t('Spices') },
  { id: 'drinks', label: t('Drinks') },
  { id: 'other', label: t('Other') },
]

interface IngRow {
  id: string
  name: string
  quantity: string
  unit: string
  aisle: Aisle
  /** True once someone picks the aisle, so the guess stops changing it. */
  aislePicked?: boolean
  optional?: boolean
}
interface StepRow {
  id: string
  text: string
}

const blankIng = (): IngRow => ({ id: uid('i'), name: '', quantity: '', unit: '', aisle: 'other' })
const blankStep = (): StepRow => ({ id: uid('s'), text: '' })

/** Blank means "some". Anything else must be an amount we can read. */
const qtyOk = (s: string) => !s.trim() || (parseAmount(s) ?? 0) > 0
const qtyOf = (s: string) => parseAmount(s) ?? 0

type Tab = 'link' | 'paste' | 'type'

const importErrors: Record<string, string> = {
  'bad-url': t('That doesn’t look like a web link. It should start with https://'),
  private: t('That doesn’t look like a web link. It should start with https://'),
  'not-found': t('That page couldn’t be found. Check the link and try again.'),
  'no-recipe': t(
    'That page doesn’t share its recipe in a way Plantry can read. Copy the text and use Paste instead.'
  ),
  'too-large': t('That page is too big to read. Copy the text and use Paste instead.'),
  'not-a-page': t('That link isn’t a web page. Copy the text and use Paste instead.'),
  blocked: t('That site doesn’t let apps read its pages. Here are two ways to bring it in anyway.'),
}

export function RecipeEditor({
  editId,
  initialTab = 'type',
  sharedUrl,
  sharedText,
}: {
  editId?: string
  initialTab?: Tab
  sharedUrl?: string
  sharedText?: string
}) {
  const router = useRouter()
  const existing = useStore((s) => (editId ? s.recipes.find((r) => r.id === editId) : undefined))
  const addRecipe = useStore((s) => s.addRecipe)
  const updateRecipe = useStore((s) => s.updateRecipe)

  const shared = findUrl(sharedUrl) ?? findUrl(sharedText)
  const [tab, setTab] = useState<Tab>(
    existing ? 'type' : shared ? 'link' : sharedText ? 'paste' : initialTab
  )
  const [pasteText, setPasteText] = useState(shared ? '' : (sharedText ?? ''))
  const [linkUrl, setLinkUrl] = useState(shared ?? '')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkNote, setLinkNote] = useState<string | null>(null)
  /** The page Plantry couldn't read, so the cook can copy it or use the bookmark. */
  const [stuckUrl, setStuckUrl] = useState<string | null>(null)
  const [source, setSource] = useState<{ source?: string; sourceUrl?: string }>({
    source: existing?.source,
    sourceUrl: existing?.sourceUrl,
  })
  const [pasteNote, setPasteNote] = useState<string | null>(null)
  /** Where the form was just filled from, so the tab row can say so instead. */
  const [filledFrom, setFilledFrom] = useState<{ tab: Tab; label: string } | null>(null)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [imageUrl, setImageUrl] = useState(existing?.imageUrl ?? '')
  const [active, setActive] = useState(String(existing?.activeMinutes ?? 20))
  const [total, setTotal] = useState(String(existing?.totalMinutes ?? 30))
  const [servings, setServings] = useState(existing?.servings ?? 4)
  const [tastes, setTastes] = useState<Taste[]>(existing?.tastes ?? [])
  const [weather, setWeather] = useState<'any' | 'warm' | 'light'>(existing?.weather ?? 'any')
  const [leftovers, setLeftovers] = useState(existing?.leftovers ?? false)
  const [ings, setIngs] = useState<IngRow[]>(
    existing
      ? existing.ingredients.map((i) => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity ? String(i.quantity) : '',
          unit: i.unit,
          aisle: i.aisle,
          aislePicked: true,
          optional: i.optional,
        }))
      : [blankIng()]
  )
  const [steps, setSteps] = useState<StepRow[]>(
    existing ? existing.steps.map((s) => ({ id: s.id, text: s.text })) : [blankStep()]
  )
  const [tried, setTried] = useState(false)

  const saving = useRef(false)

  // A link shared into Plantry from another app starts importing straight away.
  const autoStarted = useRef(false)
  useEffect(() => {
    if (autoStarted.current || existing) return
    // The Save to Plantry bookmark hands over the page in the #hash.
    if (location.hash.startsWith(`#${CAPTURE_KEY}=`)) {
      autoStarted.current = true
      const got = readCapture(location.hash)
      history.replaceState(null, '', location.pathname + location.search)
      if (got) {
        applyParsed(got)
        toast(t('Saved from {v0}. Check the details.', { v0: got.source ?? '' }))
      } else {
        setTab('paste')
        setPasteNote(t('Couldn’t find a recipe on that page. Copy the text and paste it here.'))
      }
      return
    }
    if (shared && !autoStarted.current) {
      autoStarted.current = true
      void importLink(shared)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (editId && existing && !existing.custom) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title={t('This one came with Plantry')}
        body={t('Make your own copy to change it. The original stays as it is.')}
        action={
          <Button
            onClick={() => {
              const r = addRecipe(copyOfRecipe(existing))
              toast(t('Copy made. Change what you like.'))
              router.replace(`/recipes/new?id=${r.id}`)
            }}
          >
            {t('Make a copy')}
          </Button>
        }
      />
    )
  }
  if (editId && !existing) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title={t("That recipe isn't here")}
        body={t('It may have been deleted.')}
        action={
          <Link
            href="/recipes"
            className="inline-flex h-11 items-center rounded-pill bg-surface-2 px-5 text-[0.9375rem] font-medium hover:bg-line/60"
          >
            {t('Back to recipes')}
          </Link>
        }
      />
    )
  }

  const badQty = ings.filter((i) => i.name.trim() && !qtyOk(i.quantity))
  const errors = {
    title: !title.trim() ? t('Give it a name.') : '',
    ingredients: !ings.some((i) => i.name.trim())
      ? 'Add at least one ingredient.'
      : badQty.length
        ? "Some amounts can't be read. Try 2, 1.5, 1 1/2 or ½, or leave it blank."
        : '',
    steps: !steps.some((s) => s.text.trim()) ? 'Add at least one step.' : '',
  }
  const hasErrors = !!(errors.title || errors.ingredients || errors.steps)

  /** Move to the first thing that needs fixing and say what it is. */
  function focusFirstError() {
    const id = errors.title
      ? 'title'
      : errors.ingredients
        ? badQty[0]
          ? `ing-qty-${badQty[0].id}`
          : `ing-name-${ings[0]?.id}`
        : `step-${steps[0]?.id}`
    requestAnimationFrame(() => {
      const el = document.getElementById(id)
      el?.focus()
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
    announce(errors.title || errors.ingredients || errors.steps)
  }

  /** Fills the form from a parsed recipe and switches to it for a check. */
  function applyParsed(parsed: ParsedRecipe & Partial<ImportedRecipe>) {
    if (parsed.title) setTitle(parsed.title)
    if (parsed.description) setDescription(parsed.description)
    if (parsed.imageUrl) setImageUrl(parsed.imageUrl)
    if (parsed.ingredients.length)
      setIngs(
        parsed.ingredients.map((i) => ({
          id: uid('i'),
          name: i.name,
          quantity: i.quantity ? String(i.quantity) : '',
          unit: i.unit,
          aisle: guessAisle(i.name),
        }))
      )
    if (parsed.servings) setServings(parsed.servings)
    if (parsed.activeMinutes) setActive(String(parsed.activeMinutes))
    if (parsed.totalMinutes) setTotal(String(parsed.totalMinutes))
    if (parsed.steps.length) setSteps(parsed.steps.map((s) => ({ id: uid('s'), text: s.text })))
    // A new fill replaces where the recipe came from, so a paste never inherits an older link.
    setSource(parsed.sourceUrl ? { source: parsed.source, sourceUrl: parsed.sourceUrl } : {})
    setFilledFrom({
      tab: tab === 'type' ? 'link' : tab,
      label: parsed.source
        ? t('Filled in from {v0}. Check it over, then save.', { v0: parsed.source })
        : t('Filled in from your text. Check it over, then save.'),
    })
    setTab('type')
  }

  async function importLink(raw?: string) {
    const url = findUrl(raw ?? linkUrl) ?? (raw ?? linkUrl).trim()
    if (!url) {
      setLinkNote(t('Paste a link first.'))
      return
    }
    if (!/^https?:\/\//i.test(url)) {
      setLinkNote(importErrors['bad-url'])
      return
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLinkNote(t('You’re offline. Reading a link needs the internet.'))
      return
    }
    setLinkBusy(true)
    setLinkNote(null)
    setStuckUrl(null)
    try {
      const res = await fetch(`/api/import?url=${encodeURIComponent(url)}`)
      const body = (await res.json().catch(() => ({}))) as {
        recipe?: ImportedRecipe
        error?: string
      }
      if (!res.ok || !body.recipe) {
        if (body.error !== 'bad-url' && body.error !== 'private') setStuckUrl(url)
        setLinkNote(
          importErrors[body.error ?? ''] ??
            t('Couldn’t reach {v0}. Try again, or copy the text and use Paste.', {
              v0: hostOf(url),
            })
        )
        return
      }
      applyParsed(body.recipe)
      toast(t('Saved from {v0}. Check the details.', { v0: body.recipe.source }))
    } catch {
      setStuckUrl(url)
      setLinkNote(
        t('Couldn’t reach {v0}. Try again, or copy the text and use Paste.', { v0: hostOf(url) })
      )
    } finally {
      setLinkBusy(false)
    }
  }

  /** Brings in what the cook copied from a page Plantry couldn't read. */
  async function pasteCopied() {
    let text = ''
    try {
      text = (await navigator.clipboard?.readText?.()) ?? ''
    } catch {
      /* not allowed; fall through to the paste box */
    }
    setTab('paste')
    if (text.trim() && !/^https?:\/\/\S+$/i.test(text.trim())) {
      setPasteText(text)
      sortOut(text)
    } else {
      setPasteNote(
        t('Open the recipe, select all of it, copy, then paste it here and tap Sort it out.')
      )
    }
  }

  function sortOut(raw = pasteText) {
    const text = raw.trim()
    if (!text) {
      setPasteNote(t('Paste something first.'))
      return
    }
    if (/^https?:\/\/\S+$/i.test(text)) {
      setLinkUrl(text)
      setTab('link')
      void importLink(text)
      return
    }
    const parsed = parseRecipe(text)
    if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
      setPasteNote(
        t(
          'Couldn\'t find ingredients or steps in that. Try adding "Ingredients" and "Method" headings.'
        )
      )
      return
    }
    applyParsed(stuckUrl ? { ...parsed, source: hostOf(stuckUrl), sourceUrl: stuckUrl } : parsed)
    setPasteNote(null)
    toast(t('Sorted. Check the details.'))
  }

  function save() {
    setTried(true)
    if (hasErrors) {
      focusFirstError()
      return
    }
    if (saving.current) return
    saving.current = true
    const data: Omit<Recipe, 'id' | 'createdAt' | 'isFavorite' | 'custom'> = {
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim() || undefined,
      ...(source.sourceUrl ? { source: source.source, sourceUrl: source.sourceUrl } : {}),
      activeMinutes: Math.max(0, Math.round(Number(active) || 0)),
      totalMinutes: Math.max(0, Math.round(Number(total) || 0)),
      servings,
      tastes,
      weather,
      leftovers,
      ingredients: ings
        .filter((i) => i.name.trim())
        .map((i) => ({
          id: i.id,
          name: i.name.trim(),
          key: keyOf(i.name),
          quantity: qtyOf(i.quantity),
          unit: i.unit.trim(),
          aisle: i.aisle,
          ...(i.optional ? { optional: true } : {}),
        })),
      steps: steps
        .filter((s) => s.text.trim())
        .map((s) => {
          const tItem = detectTimer(s.text)
          return { id: s.id, text: s.text.trim(), ...(tItem ? { timerMinutes: tItem } : {}) }
        }),
    }
    if (data.totalMinutes < data.activeMinutes) data.totalMinutes = data.activeMinutes
    if (existing) {
      updateRecipe(existing.id, data)
      toast(t('Recipe saved'))
      router.replace(`/recipes/${existing.id}`)
    } else {
      const r = addRecipe(data)
      toast(t('Recipe added'))
      router.replace(`/recipes/${r.id}`)
    }
  }

  const patchIng = (id: string, patch: Partial<IngRow>) =>
    setIngs((cur) =>
      cur.map((r) => {
        if (r.id !== id) return r
        const next = { ...r, ...patch }
        // Guess the aisle from the name until someone picks one.
        if (patch.name !== undefined && !r.aislePicked) next.aisle = guessAisle(patch.name)
        return next
      })
    )

  /** Enter in an ingredient row moves on to the next row, adding one at the end. */
  const onIngEnter = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    const nextRow = ings[idx + 1]
    if (nextRow) {
      document.getElementById(`ing-name-${nextRow.id}`)?.focus()
      return
    }
    const row = blankIng()
    setIngs((c) => [...c, row])
    requestAnimationFrame(() => document.getElementById(`ing-name-${row.id}`)?.focus())
  }
  const patchStep = (id: string, text: string) =>
    setSteps((cur) => cur.map((r) => (r.id === id ? { ...r, text } : r)))

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon" aria-label={t('Back')} onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Button>
        <h1 className="font-display text-fluid-xl font-semibold leading-tight tracking-tight">
          {existing ? t('Edit recipe') : t('New recipe')}
        </h1>
      </header>

      {!existing && filledFrom && tab === 'type' ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={settle}
          className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1"
        >
          <p className="flex items-start gap-2 text-[0.9375rem] text-ink-2">
            <Check className="mt-1 h-4 w-4 shrink-0 text-accent" aria-hidden />
            {filledFrom.label}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setTab(filledFrom.tab)}>
            {filledFrom.tab === 'link' ? t('Try another link') : t('Back to the text')}
          </Button>
        </motion.div>
      ) : (
        !existing && (
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t('How to add')}>
            <Chip selected={tab === 'link'} onClick={() => setTab('link')}>
              {t('From a link')}
            </Chip>
            <Chip selected={tab === 'paste'} onClick={() => setTab('paste')}>
              {t('Paste recipe text')}
            </Chip>
            <Chip selected={tab === 'type'} onClick={() => setTab('type')}>
              {t('Type it')}
            </Chip>
          </div>
        )
      )}

      {tab === 'link' ? (
        <motion.section
          key="link"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={settle}
          className="mt-5 space-y-3"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void importLink()
            }}
            className="space-y-3"
          >
            <Label htmlFor="link">{t('Recipe link')}</Label>
            <p className="-mt-1 text-sm text-ink-3">
              {t(
                'Paste a link from almost any recipe site. Plantry keeps the ingredients and steps, and leaves the life story behind.'
              )}
            </p>
            <div className="relative">
              <Link2
                className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-3"
                aria-hidden
              />
              <Input
                id="link"
                type="url"
                inputMode="url"
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder="https://"
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value)
                  setLinkNote(null)
                }}
                className="pl-11"
                aria-describedby={linkNote ? 'link-note' : undefined}
              />
            </div>
            {linkNote && (
              <p
                id="link-note"
                role="status"
                className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2"
              >
                {linkNote}
              </p>
            )}
            <Button type="submit" disabled={linkBusy} aria-busy={linkBusy}>
              {linkBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Globe className="h-4 w-4" aria-hidden />
              )}{' '}
              {linkBusy ? t('Reading the page…') : t('Get the recipe')}
            </Button>
          </form>
          {stuckUrl && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={settle}
              className="space-y-3 rounded-3xl border border-line bg-surface p-4"
            >
              <p className="font-medium">{t('Copy and paste')}</p>
              <p className="-mt-2 text-sm text-ink-2">
                {t(
                  'Open the recipe, select it all and copy. Plantry sorts out the rest and keeps the link.'
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={stuckUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 items-center gap-2 rounded-pill bg-surface-2 px-5 text-[0.9375rem] font-medium hover:bg-line/60"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden />
                  {t('Open the recipe')}
                </a>
                <Button variant="secondary" onClick={() => void pasteCopied()}>
                  <ClipboardPaste className="h-4 w-4" aria-hidden />
                  {t('Paste what I copied')}
                </Button>
              </div>
            </motion.div>
          )}
          <SaveButtonHelp open={!!stuckUrl} />
          <p className="pt-2 text-sm text-ink-3">
            {t(
              'On a phone, you can also share a recipe page to Plantry from your browser once Plantry is on your home screen.'
            )}
          </p>
        </motion.section>
      ) : tab === 'paste' ? (
        <motion.section
          key="paste"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={settle}
          className="mt-5 space-y-3"
        >
          <Label htmlFor="paste">{t('Recipe text')}</Label>
          <p className="-mt-1 text-sm text-ink-3">
            {t('Copy the recipe from a website or a note and paste it here.')}
          </p>
          <Textarea
            id="paste"
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value)
              setPasteNote(null)
            }}
            rows={12}
            placeholder={t(
              'Lemon pasta  Ingredients 200 g spaghetti 2 cloves garlic  Method 1. Boil the pasta for 10 minutes.'
            )}
          />
          {pasteNote && (
            <p role="status" className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
              {pasteNote}
            </p>
          )}
          <Button onClick={() => sortOut()}>{t('Sort it out')}</Button>
        </motion.section>
      ) : (
        <motion.form
          key="type"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={settle}
          className="mt-5 space-y-6"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          noValidate
        >
          <div>
            <Label htmlFor="title">{t('Title')}</Label>
            <Input
              id="title"
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-invalid={tried && !!errors.title}
              aria-describedby={tried && errors.title ? 'title-err' : undefined}
            />
            {tried && errors.title && (
              <p id="title-err" className="mt-1.5 text-sm text-danger">
                {errors.title}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="desc">{t('Description')}</Label>
            <Textarea
              id="desc"
              rows={2}
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="img">{t('Image URL (optional)')}</Label>
            <Input
              id="img"
              inputMode="url"
              maxLength={500}
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
            <div className="relative mt-2 aspect-[16/9] max-w-xs overflow-hidden rounded-card">
              <RecipeImage url={imageUrl} seed={title || 'new'} sizes="320px" />
            </div>
            {imageUrl.trim() && !isImageUrl(imageUrl) && (
              <p className="mt-1.5 text-sm text-ink-3">
                {t('Use a link that starts with https:// to show a picture.')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="active">{t('Active min')}</Label>
              <Input
                id="active"
                type="number"
                inputMode="numeric"
                min={0}
                max={1440}
                value={active}
                onChange={(e) => setActive(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="total">{t('Total min')}</Label>
              <Input
                id="total"
                type="number"
                inputMode="numeric"
                min={0}
                max={2880}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label>{t('Servings')}</Label>
              <Stepper value={servings} onChange={setServings} max={24} label={t('Servings')} />
            </div>
          </div>

          <div>
            <Label>{t('Tastes')}</Label>
            <div className="flex flex-wrap gap-2">
              {allTastes.map((tItem) => (
                <Chip
                  key={tItem}
                  size="sm"
                  selected={tastes.includes(tItem)}
                  onClick={() =>
                    setTastes((c) =>
                      c.includes(tItem) ? c.filter((x) => x !== tItem) : [...c, tItem]
                    )
                  }
                >
                  {tasteLabels[tItem]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid items-end gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="weather">{t('Weather lean')}</Label>
              <Select
                id="weather"
                value={weather}
                onChange={(e) => setWeather(e.target.value as 'any' | 'warm' | 'light')}
              >
                <option value="any">{t('Any weather')}</option>
                <option value="warm">{t('Warm, for cold days')}</option>
                <option value="light">{t('Light, for hot days')}</option>
              </Select>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={leftovers}
              onClick={() => setLeftovers((v) => !v)}
              className="flex h-12 items-center justify-between rounded-2xl border border-line bg-surface px-4 text-[0.9375rem]"
            >
              {t('Makes leftovers')}
              <span
                className={`relative h-6 w-10 rounded-pill transition-colors ${leftovers ? 'bg-accent' : 'bg-line'}`}
                aria-hidden
              >
                <motion.span
                  layout
                  transition={settle}
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow-card ${leftovers ? 'right-0.5' : 'left-0.5'}`}
                />
              </span>
            </button>
          </div>

          <section aria-labelledby="ing-h">
            <SectionTitle>
              <span id="ing-h">{t('Ingredients')}</span>
            </SectionTitle>
            <ul className="space-y-3">
              {ings.map((row, idx) => (
                <li key={row.id} className="card space-y-2 p-3">
                  <div className="flex gap-2">
                    <Input
                      id={`ing-name-${row.id}`}
                      aria-label={t('Ingredient {v0} name', { v0: idx + 1 })}
                      placeholder={t('Name')}
                      maxLength={60}
                      enterKeyHint="next"
                      value={row.name}
                      onChange={(e) => patchIng(row.id, { name: e.target.value })}
                      onKeyDown={(e) => onIngEnter(e, idx)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('Remove ingredient {v0}', { v0: idx + 1 })}
                      onClick={() =>
                        setIngs((c) =>
                          c.length > 1 ? c.filter((r) => r.id !== row.id) : [blankIng()]
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] gap-2">
                    <Input
                      id={`ing-qty-${row.id}`}
                      aria-label={t('Ingredient {v0} amount', { v0: idx + 1 })}
                      aria-invalid={tried && !!row.name.trim() && !qtyOk(row.quantity)}
                      placeholder={t('Amount')}
                      maxLength={12}
                      enterKeyHint="next"
                      value={row.quantity}
                      onChange={(e) => patchIng(row.id, { quantity: e.target.value })}
                      onKeyDown={(e) => onIngEnter(e, idx)}
                    />
                    <Input
                      aria-label={t('Ingredient {v0} unit', { v0: idx + 1 })}
                      placeholder={t('Unit')}
                      maxLength={20}
                      enterKeyHint="next"
                      value={row.unit}
                      onChange={(e) => patchIng(row.id, { unit: e.target.value })}
                      onKeyDown={(e) => onIngEnter(e, idx)}
                    />
                    <Select
                      aria-label={t('Ingredient {v0} aisle', { v0: idx + 1 })}
                      value={row.aisle}
                      onChange={(e) =>
                        patchIng(row.id, { aisle: e.target.value as Aisle, aislePicked: true })
                      }
                    >
                      {aisles.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
            {tried && errors.ingredients && (
              <p className="mt-2 text-sm text-danger" role="alert">
                {errors.ingredients}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setIngs((c) => [...c, blankIng()])}
            >
              <Plus className="h-4 w-4" aria-hidden /> {t('Add ingredient')}
            </Button>
          </section>

          <section aria-labelledby="step-h">
            <SectionTitle>
              <span id="step-h">{t('Steps')}</span>
            </SectionTitle>
            <ol className="space-y-3">
              {steps.map((row, idx) => {
                const tItem = detectTimer(row.text)
                return (
                  <li key={row.id} className="flex gap-3">
                    <span
                      className="w-6 shrink-0 pt-3 font-display text-xl font-semibold text-accent"
                      aria-hidden
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Textarea
                        id={`step-${row.id}`}
                        aria-label={t('Step {v0}', { v0: idx + 1 })}
                        maxLength={600}
                        rows={2}
                        value={row.text}
                        onChange={(e) => patchStep(row.id, e.target.value)}
                      />
                      {tItem && (
                        <Tag className="gap-1">
                          <Timer className="h-3 w-3" aria-hidden />{' '}
                          {t('timer {tItem} min', { tItem })}
                        </Tag>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('Remove step {v0}', { v0: idx + 1 })}
                      onClick={() =>
                        setSteps((c) =>
                          c.length > 1 ? c.filter((r) => r.id !== row.id) : [blankStep()]
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </li>
                )
              })}
            </ol>
            {tried && errors.steps && <p className="mt-2 text-sm text-danger">{errors.steps}</p>}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setSteps((c) => [...c, blankStep()])}
            >
              <Plus className="h-4 w-4" aria-hidden /> {t('Add step')}
            </Button>
          </section>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" size="lg">
              {existing ? t('Save changes') : t('Save recipe')}
            </Button>
            {tried && hasErrors && (
              <p className="text-sm text-danger">
                {errors.title || errors.ingredients || errors.steps}
              </p>
            )}
          </div>
        </motion.form>
      )}
    </div>
  )
}
