import { withTemperatures } from './quantity'

// Plain safety notes for steps, so someone new to cooking (or a 13-year-old on their own)
// knows what to watch. Derived from the step text; a step can also carry its own caution.

export type CautionKind = 'hot' | 'oven' | 'boil' | 'sharp' | 'raw'

const rules: { kind: CautionKind; re: RegExp; note: string }[] = [
  {
    kind: 'oven',
    re: /\b(oven|bake|baking|roast|roasting|grill|broil|tray)\b/i,
    note: 'Oven: use oven gloves, and open the door away from your face.',
  },
  {
    kind: 'hot',
    re: /\b(fry|frying|fried|sear|searing|saut[eé]\w*|hot oil|smoking|sizzl\w*|pan|skillet|wok|pot|medium heat|high heat)\b/i,
    note: 'Hot pan: turn the handle inward and keep water away from hot oil.',
  },
  {
    kind: 'boil',
    re: /\b(boil\w*|simmer\w*|drain|steam\w*|blanch\w*)\b/i,
    note: 'Boiling water: pour away from you and use a lid as a shield.',
  },
  {
    kind: 'sharp',
    re: /\b(chop|chopping|slice|slicing|dice|dicing|cut|cutting|knife|grate|grating|peel|peeling|zest|zesting|mince|mincing)\b/i,
    note: 'Sharp: curl your fingertips under and cut away from you.',
  },
  {
    kind: 'raw',
    re: /\b(raw|chicken|pork|beef|mince|salmon|prawns?|fish)\b/i,
    note: 'Raw meat or fish: wash hands, board and knife after.',
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
    if (r.re.test(text) && !out.some((c) => c.kind === r.kind))
      out.push({ kind: r.kind, note: r.note })
  return out.slice(0, 2)
}

/** True for steps where a younger cook should get help. */
export const needsGrownUp = (c: Caution[]) => c.some((x) => x.kind !== 'raw')

/** "Bake at 200°C" -> "Bake at 200°C (390°F)". See withTemperatures for imperial kitchens. */
export const withFahrenheit = (text: string) => withTemperatures(text, 'metric')
