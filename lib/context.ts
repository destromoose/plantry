import { getLang } from '@/lib/i18n'
import type { Context, Mood, PlanEntry, Recipe, Settings, Weather } from './types'
import { addDays, toDateKey } from './utils'

export function moodForHour(hour: number): Mood {
  if (hour >= 5 && hour < 10) return 'dawn'
  if (hour >= 10 && hour < 17) return 'day'
  if (hour >= 17 && hour < 21) return 'dusk'
  return 'night'
}

export function weatherLean(weather?: Weather): Context['weatherLean'] {
  if (!weather) return 'any'
  if (weather.precipitation || weather.tempC <= 12) return 'warm'
  if (weather.tempC >= 26) return 'light'
  return 'any'
}

interface BuildInput {
  now: Date
  settings: Pick<Settings, 'mood' | 'weatherEnabled'>
  weather?: Weather
  plan: PlanEntry[]
  recipes: Recipe[]
  /** The person said they are still eating tonight, so don't jump to tomorrow yet. */
  stillTonight?: boolean
  /** The device is set to dark mode. Used by the 'system' mood. */
  prefersDark?: boolean
}

/** After this hour, Tonight starts thinking about tomorrow, unless tonight is still open. */
export const TOMORROW_FROM_HOUR = 22

/** Milliseconds until the next moment the context can change: a mood band, the cutoff or midnight. */
export function msUntilNextChange(now: Date): number {
  const marks = [5, 10, 17, 21, TOMORROW_FROM_HOUR, 24]
  const next = new Date(now)
  const h = marks.find((m) => m > now.getHours()) ?? 24
  next.setHours(h, 0, 5, 0)
  return Math.max(1000, next.getTime() - now.getTime())
}

/**
 * The adaptive context engine. A pure function so it is easy to test and so the
 * UI can re-run it at launch or on a clear change (hour band, tab return) and
 * never continuously.
 */
export function buildContext({
  now,
  settings,
  weather,
  plan,
  recipes,
  stillTonight,
  prefersDark,
}: BuildInput): Context {
  const hour = now.getHours()
  const dow = now.getDay()
  const isWeekend = dow === 0 || dow === 6
  const today = toDateKey(now)
  // Late evening: look at tomorrow, unless tonight's dinner is planned and not yet cooked
  // or the person asked to stay on tonight. After midnight, "tonight" is the new day.
  const todayEntry = plan.find((p) => p.date === today && p.slot === 'dinner')
  const tonightOpen =
    !!todayEntry && !todayEntry.done && !!(todayEntry.recipeId || todayEntry.leftoversOf)
  // Once tonight's dinner is cooked, move on to tomorrow.
  const tonightDone = !!todayEntry?.done
  const lateNight = !stillTonight && ((hour >= TOMORROW_FROM_HOUR && !tonightOpen) || tonightDone)
  const targetDate = lateNight ? addDays(today, 1) : today
  const targetLabel = lateNight ? 'Tomorrow' : 'Tonight'
  const mood =
    settings.mood === 'auto'
      ? moodForHour(hour)
      : settings.mood === 'system'
        ? prefersDark
          ? 'night'
          : 'day'
        : settings.mood
  const lean = settings.weatherEnabled ? weatherLean(weather) : 'any'

  const tonight = plan.find((p) => p.date === targetDate && p.slot === 'dinner')
  const tonightRecipe = tonight?.recipeId
    ? recipes.find((r) => r.id === tonight.recipeId)
    : undefined
  const yesterdayBigBatch = plan.find(
    (p) =>
      p.date === addDays(today, -1) &&
      p.slot === 'dinner' &&
      p.done &&
      recipes.find((r) => r.id === p.recipeId)?.leftovers
  )
  const weekPlanned = countPlannedDinners(plan, today)

  let nudge: Context['nudge'] = 'none'
  if (isWeekend && hour >= 7 && hour < 13 && weekPlanned < 3) nudge = 'plan-week'
  else if (
    hour >= 7 &&
    hour < 12 &&
    tonightRecipe?.ingredients.some((i) => i.aisle === 'frozen' || i.aisle === 'meat-fish')
  )
    nudge = 'defrost'
  else if (hour >= 16 && hour < 20 && tonightRecipe) nudge = 'start-now'
  else if ((hour >= 20 || lateNight) && yesterdayBigBatch) nudge = 'leftovers'

  const reason = describe({ mood, isWeekend, lean, weather, hour, lateNight })
  const canStayTonight = lateNight && !tonightDone

  return {
    now: now.toISOString(),
    mood,
    hour,
    isWeekend,
    targetDate,
    targetLabel,
    weather,
    weatherLean: lean,
    nudge,
    reason,
    canStayTonight,
  }
}

function countPlannedDinners(plan: PlanEntry[], today: string): number {
  const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(today, i)))
  return plan.filter(
    (p) => p.slot === 'dinner' && week.has(p.date) && (p.recipeId || p.note || p.leftoversOf)
  ).length
}

function describe(i: {
  mood: Mood
  isWeekend: boolean
  lean: Context['weatherLean']
  weather?: Weather
  hour: number
  lateNight: boolean
}): string {
  const wet = !!i.weather?.precipitation
  const cold = !wet && !!i.weather && i.weather.tempC <= 12
  const hot = !wet && !!i.weather && i.weather.tempC >= 26
  if (getLang() === 'es') {
    // "Tarde lluviosa entre semana, así que tiré a algo reconfortante."
    const time = { dawn: 'Mañana', day: 'Tarde', dusk: 'Noche', night: 'Noche cerrada' }[i.mood]
    const adj = wet ? ' lluviosa' : cold ? ' fría' : hot ? ' calurosa' : ''
    const day = i.isWeekend ? ' de fin de semana' : ' entre semana'
    const lean =
      i.lean === 'warm'
        ? ', así que tiré a algo reconfortante'
        : i.lean === 'light'
          ? ', así que lo dejé ligero'
          : ''
    return `${time}${adj}${day}${lean}.${i.lateNight ? ' Pensando en mañana.' : ''}`
  }
  const day = i.isWeekend ? 'weekend' : 'weekday'
  const time =
    i.mood === 'dawn'
      ? 'morning'
      : i.mood === 'day'
        ? 'afternoon'
        : i.mood === 'dusk'
          ? 'evening'
          : 'late night'
  const w = wet ? 'Rainy ' : cold ? 'Chilly ' : hot ? 'Hot ' : ''
  const leanText =
    i.lean === 'warm' ? ', so I leaned cozy' : i.lean === 'light' ? ', so I kept it light' : ''
  const target = i.lateNight ? ' Thinking about tomorrow.' : ''
  return `${w}${w ? day : capitalize(day)} ${time}${leanText}.${target}`
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** Fetches weather from Open-Meteo (free, no key). Returns undefined on any failure. */
export async function fetchWeather(lat: number, lon: number): Promise<Weather | undefined> {
  try {
    // Rounded to one decimal place, about 10 km. That is plenty for the weather.
    const r = (n: number) => Math.round(n * 10) / 10
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${r(lat)}&longitude=${r(lon)}&current=temperature_2m,precipitation`
    const res = await fetch(url)
    if (!res.ok) return undefined
    const json = (await res.json()) as {
      current?: { temperature_2m?: number; precipitation?: number }
    }
    if (!json.current || typeof json.current.temperature_2m !== 'number') return undefined
    return {
      tempC: json.current.temperature_2m,
      precipitation: (json.current.precipitation ?? 0) > 0,
      fetchedAt: new Date().toISOString(),
    }
  } catch {
    return undefined
  }
}
