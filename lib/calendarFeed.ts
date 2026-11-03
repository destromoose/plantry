// The household's plan as a calendar people subscribe to once (Apple, Google, Outlook).
// Each planned meal is an all-day event that says who's cooking, and a morning reminder
// shows up when something needs to come out of the freezer.

import type { Member, PlanEntry, Recipe } from './types'
import { addDays } from './utils'

export interface FeedInput {
  members: Pick<Member, 'id' | 'name'>[]
  recipes: Pick<Recipe, 'id' | 'title' | 'ingredients'>[]
  plan: PlanEntry[]
}

export type FeedLang = 'en' | 'es'

const words = {
  en: {
    calendar: 'Plantry dinners',
    cooks: (name: string) => `${name} cooks`,
    leftovers: (title: string) => `Leftovers: ${title}`,
    out: (thing: string) => `Take the ${thing} out of the freezer`,
    outFor: (title: string) => `For tonight's ${title}.`,
    open: 'Open in Plantry',
    slot: { breakfast: 'Breakfast', lunch: 'Lunch', dinner: '', snack: 'Snack' } as Record<
      string,
      string
    >,
  },
  es: {
    calendar: 'Cenas de Plantry',
    cooks: (name: string) => `cocina ${name}`,
    leftovers: (title: string) => `Sobras: ${title}`,
    out: (thing: string) => `Saca ${thing} del congelador`,
    outFor: (title: string) => `Para ${title} de esta noche.`,
    open: 'Abrir en Plantry',
    slot: { breakfast: 'Desayuno', lunch: 'Comida', dinner: '', snack: 'Merienda' } as Record<
      string,
      string
    >,
  },
}

/** RFC 5545 text: escape the special characters and fold long lines. */
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

function fold(line: string): string {
  // Lines are at most 75 bytes; continuation lines start with a space. Counted in UTF-8
  // bytes, never splitting a character.
  const out: string[] = []
  let cur = ''
  let bytes = 0
  for (const ch of line) {
    const size = new TextEncoder().encode(ch).length
    if (bytes + size > 75) {
      out.push(cur)
      cur = ' '
      bytes = 1
    }
    cur += ch
    bytes += size
  }
  out.push(cur)
  return out.join('\r\n')
}

const ymd = (date: string) => date.replace(/-/g, '')

/** What has to be thawed for this recipe, if anything: frozen things or meat and fish. */
export function needsThawing(r: Pick<Recipe, 'ingredients'>): string | undefined {
  return r.ingredients
    .find((i) => i.aisle === 'frozen' || i.aisle === 'meat-fish')
    ?.name.toLowerCase()
}

export function buildFeed(
  input: FeedInput,
  opts: { today: string; origin: string; lang?: FeedLang; stamp?: string }
): string {
  const w = words[opts.lang ?? 'en']
  const from = addDays(opts.today, -14)
  const to = addDays(opts.today, 60)
  const stamp = opts.stamp ?? new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  const people = new Map(input.members.map((m) => [m.id, m.name]))
  const recipes = new Map(input.recipes.map((r) => [r.id, r]))

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Plantry//Dinner calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(w.calendar)}`,
    // Ask calendar apps to check back a few times a day.
    'REFRESH-INTERVAL;VALUE=DURATION:PT4H',
    'X-PUBLISHED-TTL:PT4H',
  ]

  const entries = input.plan
    .filter((p) => p.date >= from && p.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  for (const p of entries) {
    const recipe = p.recipeId ? recipes.get(p.recipeId) : undefined
    const source = p.leftoversOf ? recipes.get(p.leftoversOf) : undefined
    const what = source
      ? w.leftovers(source.title)
      : (recipe?.title ?? p.note?.trim() ?? '').slice(0, 120)
    if (!what) continue
    const cook = p.cookId ? people.get(p.cookId) : undefined
    const slot = w.slot[p.slot] ?? ''
    const summary = [slot ? `${slot}: ${what}` : what, cook ? w.cooks(cook) : '']
      .filter(Boolean)
      .join(' · ')
    const link = recipe ? `${opts.origin}/recipes/${encodeURIComponent(recipe.id)}` : opts.origin
    lines.push(
      'BEGIN:VEVENT',
      `UID:${esc(`${p.date}-${p.slot}@plantry`)}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(p.date)}`,
      `DTEND;VALUE=DATE:${ymd(addDays(p.date, 1))}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(`${w.open}: ${link}`)}`,
      `URL:${link}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    )
    // The defrost reminder as a short morning event, since most calendar apps drop alarms
    // from subscribed calendars. Floating time, so it's 8 am wherever the phone is.
    const thaw = recipe && !p.done && p.slot === 'dinner' ? needsThawing(recipe) : undefined
    if (thaw && recipe && p.date >= opts.today)
      lines.push(
        'BEGIN:VEVENT',
        `UID:${esc(`${p.date}-thaw@plantry`)}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${ymd(p.date)}T080000`,
        `DTEND:${ymd(p.date)}T081500`,
        `SUMMARY:${esc(w.out(thaw))}`,
        `DESCRIPTION:${esc(w.outFor(recipe.title))}`,
        'TRANSP:TRANSPARENT',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(w.out(thaw))}`,
        'TRIGGER:PT0M',
        'END:VALARM',
        'END:VEVENT'
      )
  }
  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Where a calendar link points: its household, kept beside the households themselves. */
export const calendarKey = (token: string) => `cal:${token}`

/** A calendar link that can't be used to read or change the household, only its plan. */
export async function calendarToken(code: string): Promise<string> {
  const data = new TextEncoder().encode(`plantry-calendar:${code}`)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', data))
  return Array.from(hash.slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('')
}
