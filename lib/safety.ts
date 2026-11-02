import { t } from '@/lib/i18n'
import { withTemperatures } from './quantity'

// Plain safety notes for steps, so someone new to cooking (or a 13-year-old on their own)
// knows what to watch. Derived from the step text; a step can also carry its own caution.

export type CautionKind = 'hot' | 'oven' | 'boil' | 'sharp' | 'raw'

// Whole words in English or Spanish. \b doesn't see accented letters, so Spanish uses
// letter lookarounds instead.
const es = (words: string) => new RegExp(`(?<!\\p{L})(${words})(?!\\p{L})`, 'iu')

const rules: { kind: CautionKind; re: RegExp; esRe: RegExp; note: string }[] = [
  {
    kind: 'oven',
    re: /\b(oven|bake|baking|roast|roasting|grill|broil|tray)\b/i,
    esRe: es('horno|hornea\\p{L}*|asa|asar|asado|asados?|gratin\\p{L}*|bandeja'),
    note: t('Oven: use oven gloves, and open the door away from your face.'),
  },
  {
    kind: 'hot',
    re: /\b(fry|frying|fried|sear|searing|saut[eé]\w*|hot oil|smoking|sizzl\w*|pan|skillet|wok|pot|medium heat|high heat)\b/i,
    esRe: es(
      'fr[ií]e|fre[ií]r|fr[ií]elos?|dora\\p{L}*|d[oó]ra\\p{L}*|saltea\\p{L}*|sofr[ií]e\\p{L}*|sart[eé]n|wok|olla|aceite caliente|fuego medio|fuego alto'
    ),
    note: t('Hot pan: turn the handle inward and keep water away from hot oil.'),
  },
  {
    kind: 'boil',
    re: /\b(boil\w*|simmer\w*|drain|steam\w*|blanch\w*)\b/i,
    esRe: es('hierv\\p{L}*|herv\\p{L}*|hirviendo|escurr\\p{L}*|cuece\\p{L}*|cocer|vapor'),
    note: t('Boiling water: pour away from you and use a lid as a shield.'),
  },
  {
    kind: 'sharp',
    re: /\b(chop|chopping|slice|slicing|dice|dicing|cut|cutting|knife|grate|grating|peel|peeling|zest|zesting|mince|mincing)\b/i,
    esRe: es(
      'pica|picar|picad\\p{L}*|corta|cortar|c[oó]rta\\p{L}*|cuchillo|ralla|rallar|pela|pelar|ralladura|l[aá]minas'
    ),
    note: t('Sharp: curl your fingertips under and cut away from you.'),
  },
  {
    kind: 'raw',
    re: /\b(raw|chicken|pork|beef|mince|salmon|prawns?|fish)\b/i,
    esRe: es('crud\\p{L}*|pollo|cerdo|res|carne|salm[oó]n|camar[oó]n\\p{L}*|pescado'),
    note: t('Raw meat or fish: wash hands, board and knife after.'),
  },
]

export interface Caution {
  kind: CautionKind
  note: string
}

/** Cautions for one step, most serious first, at most two. */
export function cautionsFor(text: string, own?: string): Caution[] {
  const out: Caution[] = own ? [{ kind: 'hot', note: own }] : []
  for (const r of rules)
    if ((r.re.test(text) || r.esRe.test(text)) && !out.some((c) => c.kind === r.kind))
      out.push({ kind: r.kind, note: r.note })
  return out.slice(0, 2)
}

/** True for steps where a younger cook should get help. */
export const needsGrownUp = (c: Caution[]) => c.some((x) => x.kind !== 'raw')

/** "Bake at 200°C" -> "Bake at 200°C (390°F)". See withTemperatures for imperial kitchens. */
export const withFahrenheit = (text: string) => withTemperatures(text, 'metric')
