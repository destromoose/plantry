'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { ArrowLeft, Plus, Timer, Trash2, UtensilsCrossed } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { Aisle, Recipe, Taste } from '@/lib/types'
import { keyOf, uid } from '@/lib/utils'
import { detectTimer, parseRecipe } from '@/lib/parseRecipe'
import { settle } from '@/lib/motion'
import { Button } from '@/components/ui/Button'
import { Chip, Tag } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Label, Select, Textarea } from '@/components/ui/Field'
import { Stepper } from '@/components/ui/Stepper'
import { SectionTitle } from '@/components/ui/Card'
import { toast } from '@/components/ui/Toast'
import { RecipeImage, isUnsplash } from './RecipeImage'
import { allTastes, tasteLabels } from './tastes'

const aisles: { id: Aisle; label: string }[] = [
  { id: 'produce', label: 'Produce' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'meat-fish', label: 'Meat and fish' },
  { id: 'bakery', label: 'Bakery' },
  { id: 'pantry', label: 'Pantry' },
  { id: 'frozen', label: 'Frozen' },
  { id: 'spices', label: 'Spices' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'other', label: 'Other' },
]

interface IngRow {
  id: string
  name: string
  quantity: string
  unit: string
  aisle: Aisle
  optional?: boolean
}
interface StepRow {
  id: string
  text: string
}

const blankIng = (): IngRow => ({ id: uid('i'), name: '', quantity: '', unit: '', aisle: 'other' })
const blankStep = (): StepRow => ({ id: uid('s'), text: '' })

function parseQty(s: string): number {
  const t = s.trim()
  const frac = t.match(/^(\d+)\/(\d+)$/)
  if (frac && Number(frac[2])) return Number(frac[1]) / Number(frac[2])
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

export function RecipeEditor({
  editId,
  initialTab = 'type',
}: {
  editId?: string
  initialTab?: 'type' | 'paste'
}) {
  const router = useRouter()
  const existing = useStore((s) => (editId ? s.recipes.find((r) => r.id === editId) : undefined))
  const addRecipe = useStore((s) => s.addRecipe)
  const updateRecipe = useStore((s) => s.updateRecipe)

  const [tab, setTab] = useState<'type' | 'paste'>(existing ? 'type' : initialTab)
  const [pasteText, setPasteText] = useState('')
  const [pasteNote, setPasteNote] = useState<string | null>(null)

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
          optional: i.optional,
        }))
      : [blankIng()]
  )
  const [steps, setSteps] = useState<StepRow[]>(
    existing ? existing.steps.map((s) => ({ id: s.id, text: s.text })) : [blankStep()]
  )
  const [tried, setTried] = useState(false)

  const saving = useRef(false)

  if (editId && (!existing || !existing.custom)) {
    return (
      <EmptyState
        icon={UtensilsCrossed}
        title="That recipe isn't here"
        body="Only recipes you added yourself can be edited."
        action={
          <Link
            href="/recipes"
            className="inline-flex h-11 items-center rounded-pill bg-surface-2 px-5 text-[15px] font-medium hover:bg-line/60"
          >
            Back to recipes
          </Link>
        }
      />
    )
  }

  const errors = {
    title: !title.trim() ? 'Give it a name.' : '',
    ingredients: !ings.some((i) => i.name.trim()) ? 'Add at least one ingredient.' : '',
    steps: !steps.some((s) => s.text.trim()) ? 'Add at least one step.' : '',
  }
  const hasErrors = !!(errors.title || errors.ingredients || errors.steps)

  function sortOut() {
    const text = pasteText.trim()
    if (!text) {
      setPasteNote('Paste something first.')
      return
    }
    if (/^https?:\/\/\S+$/i.test(text)) {
      setPasteNote(
        "Plantry can't fetch pages yet. Paste the recipe text instead and it'll sort it out."
      )
      return
    }
    const parsed = parseRecipe(text)
    if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
      setPasteNote(
        'Couldn\'t find ingredients or steps in that. Try adding "Ingredients" and "Method" headings.'
      )
      return
    }
    if (parsed.title) setTitle(parsed.title)
    if (parsed.ingredients.length)
      setIngs(
        parsed.ingredients.map((i) => ({
          id: uid('i'),
          name: i.name,
          quantity: i.quantity ? String(i.quantity) : '',
          unit: i.unit,
          aisle: 'other',
        }))
      )
    if (parsed.steps.length) setSteps(parsed.steps.map((s) => ({ id: uid('s'), text: s.text })))
    setPasteNote(null)
    setTab('type')
    toast('Sorted. Check the details.')
  }

  function save() {
    setTried(true)
    if (hasErrors || saving.current) return
    saving.current = true
    const data: Omit<Recipe, 'id' | 'createdAt' | 'isFavorite' | 'custom'> = {
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim() || undefined,
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
          quantity: parseQty(i.quantity),
          unit: i.unit.trim(),
          aisle: i.aisle,
          ...(i.optional ? { optional: true } : {}),
        })),
      steps: steps
        .filter((s) => s.text.trim())
        .map((s) => {
          const t = detectTimer(s.text)
          return { id: s.id, text: s.text.trim(), ...(t ? { timerMinutes: t } : {}) }
        }),
    }
    if (data.totalMinutes < data.activeMinutes) data.totalMinutes = data.activeMinutes
    if (existing) {
      updateRecipe(existing.id, data)
      toast('Recipe saved')
      router.push(`/recipes/${existing.id}`)
    } else {
      const r = addRecipe(data)
      toast('Recipe added')
      router.push(`/recipes/${r.id}`)
    }
  }

  const patchIng = (id: string, patch: Partial<IngRow>) =>
    setIngs((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const patchStep = (id: string, text: string) =>
    setSteps((cur) => cur.map((r) => (r.id === id ? { ...r, text } : r)))

  return (
    <div className="mx-auto max-w-2xl pb-10">
      <header className="flex items-center gap-3 pt-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Button>
        <h1 className="font-display text-fluid-xl font-semibold leading-tight tracking-tight">
          {existing ? 'Edit recipe' : 'New recipe'}
        </h1>
      </header>

      {!existing && (
        <div className="mt-4 flex gap-2" role="group" aria-label="How to add">
          <Chip selected={tab === 'type'} onClick={() => setTab('type')}>
            Type it
          </Chip>
          <Chip selected={tab === 'paste'} onClick={() => setTab('paste')}>
            Paste a link or text
          </Chip>
        </div>
      )}

      {tab === 'paste' ? (
        <motion.section
          key="paste"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={settle}
          className="mt-5 space-y-3"
        >
          <Label htmlFor="paste">Recipe text or link</Label>
          <Textarea
            id="paste"
            value={pasteText}
            onChange={(e) => {
              setPasteText(e.target.value)
              setPasteNote(null)
            }}
            rows={12}
            placeholder={
              'Lemon pasta\n\nIngredients\n200 g spaghetti\n2 cloves garlic\n\nMethod\n1. Boil the pasta for 10 minutes.'
            }
          />
          {pasteNote && (
            <p role="status" className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">
              {pasteNote}
            </p>
          )}
          <Button onClick={sortOut}>Sort it out</Button>
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
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
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
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="img">Image URL (optional)</Label>
            <Input
              id="img"
              inputMode="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
            />
            <div className="relative mt-2 aspect-[16/9] max-w-xs overflow-hidden rounded-card">
              <RecipeImage url={imageUrl} seed={title || 'new'} sizes="320px" />
            </div>
            {imageUrl.trim() && !isUnsplash(imageUrl) && (
              <p className="mt-1.5 text-sm text-ink-3">
                Only images.unsplash.com previews for now. The link is kept.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="active">Active min</Label>
              <Input
                id="active"
                type="number"
                inputMode="numeric"
                min={0}
                value={active}
                onChange={(e) => setActive(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="total">Total min</Label>
              <Input
                id="total"
                type="number"
                inputMode="numeric"
                min={0}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
            <div>
              <Label>Servings</Label>
              <Stepper value={servings} onChange={setServings} max={24} label="Servings" />
            </div>
          </div>

          <div>
            <Label>Tastes</Label>
            <div className="flex flex-wrap gap-2">
              {allTastes.map((t) => (
                <Chip
                  key={t}
                  size="sm"
                  selected={tastes.includes(t)}
                  onClick={() =>
                    setTastes((c) => (c.includes(t) ? c.filter((x) => x !== t) : [...c, t]))
                  }
                >
                  {tasteLabels[t]}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 items-end gap-3">
            <div>
              <Label htmlFor="weather">Weather lean</Label>
              <Select
                id="weather"
                value={weather}
                onChange={(e) => setWeather(e.target.value as 'any' | 'warm' | 'light')}
              >
                <option value="any">Any weather</option>
                <option value="warm">Warm, for cold days</option>
                <option value="light">Light, for hot days</option>
              </Select>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={leftovers}
              onClick={() => setLeftovers((v) => !v)}
              className="flex h-12 items-center justify-between rounded-2xl border border-line bg-surface px-4 text-[15px]"
            >
              Makes leftovers
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
              <span id="ing-h">Ingredients</span>
            </SectionTitle>
            <ul className="space-y-3">
              {ings.map((row, idx) => (
                <li key={row.id} className="card space-y-2 p-3">
                  <div className="flex gap-2">
                    <Input
                      aria-label={`Ingredient ${idx + 1} name`}
                      placeholder="Name"
                      value={row.name}
                      onChange={(e) => patchIng(row.id, { name: e.target.value })}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove ingredient ${idx + 1}`}
                      onClick={() =>
                        setIngs((c) =>
                          c.length > 1 ? c.filter((r) => r.id !== row.id) : [blankIng()]
                        )
                      }
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                    <Input
                      aria-label={`Ingredient ${idx + 1} quantity`}
                      inputMode="decimal"
                      placeholder="Qty"
                      value={row.quantity}
                      onChange={(e) => patchIng(row.id, { quantity: e.target.value })}
                    />
                    <Input
                      aria-label={`Ingredient ${idx + 1} unit`}
                      placeholder="Unit"
                      value={row.unit}
                      onChange={(e) => patchIng(row.id, { unit: e.target.value })}
                    />
                    <Select
                      aria-label={`Ingredient ${idx + 1} aisle`}
                      value={row.aisle}
                      onChange={(e) => patchIng(row.id, { aisle: e.target.value as Aisle })}
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
              <p className="mt-2 text-sm text-danger">{errors.ingredients}</p>
            )}
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setIngs((c) => [...c, blankIng()])}
            >
              <Plus className="h-4 w-4" aria-hidden /> Add ingredient
            </Button>
          </section>

          <section aria-labelledby="step-h">
            <SectionTitle>
              <span id="step-h">Steps</span>
            </SectionTitle>
            <ol className="space-y-3">
              {steps.map((row, idx) => {
                const t = detectTimer(row.text)
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
                        aria-label={`Step ${idx + 1}`}
                        rows={2}
                        value={row.text}
                        onChange={(e) => patchStep(row.id, e.target.value)}
                      />
                      {t && (
                        <Tag className="gap-1">
                          <Timer className="h-3 w-3" aria-hidden /> timer {t} min
                        </Tag>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove step ${idx + 1}`}
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
              <Plus className="h-4 w-4" aria-hidden /> Add step
            </Button>
          </section>

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" size="lg">
              {existing ? 'Save changes' : 'Save recipe'}
            </Button>
            {tried && hasErrors && (
              <p className="text-sm text-danger">Fix the notes above first.</p>
            )}
          </div>
        </motion.form>
      )}
    </div>
  )
}
