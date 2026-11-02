// Plantry's languages. English text is the key: t('Only missing {x}', { x: 'lime' }).
// Missing translations fall back to English, so nothing ever shows a raw key.
//
// The language is module state rather than React context so plain functions (suggestion
// reasons, safety notes, toasts) can translate too. Changing it remounts the app.

import { es } from './es'

export type Lang = 'en' | 'es'
export type LangSetting = Lang | 'auto'

const LANG_KEY = 'plantry-lang'

/** Read before any screen renders, so even module-level labels come out in the right language. */
function initial(): Lang {
  if (typeof window === 'undefined') return 'en'
  try {
    return resolveLang((localStorage.getItem(LANG_KEY) as LangSetting | null) ?? 'auto')
  } catch {
    return resolveLang('auto')
  }
}

let current: Lang = initial()

/** Save the choice and reload, so every label is built again in the new language. */
export function switchLang(setting: LangSetting) {
  try {
    localStorage.setItem(LANG_KEY, setting)
  } catch {
    /* falls back to the device language next time */
  }
  if (resolveLang(setting) !== current) window.location.reload()
}

export function langSetting(): LangSetting {
  try {
    const v = localStorage.getItem(LANG_KEY)
    return v === 'en' || v === 'es' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

export const getLang = () => current
export function setLang(l: Lang) {
  current = l
}

/** The language a setting means on this device. */
export function resolveLang(setting: LangSetting | undefined): Lang {
  if (setting === 'en' || setting === 'es') return setting
  if (typeof navigator !== 'undefined' && /^es\b/i.test(navigator.language)) return 'es'
  return 'en'
}

/** Locale for dates and numbers: the browser's own for English, Spanish otherwise. */
export const locale = (): string | undefined => (current === 'es' ? 'es' : undefined)

type Vars = Record<string, string | number | null | undefined>

const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? '') : m)) : s

export function t(english: string, vars?: Vars): string {
  return fill(current === 'es' ? (es[english] ?? english) : english, vars)
}

/**
 * A count with its word: tn(3, 'thing') -> "3 things" / "3 cosas". Spanish forms come from
 * the dictionary as "cosa|cosas"; English adds an s unless a plural is given.
 */
export function tn(n: number, word: string, plural = `${word}s`): string {
  if (current === 'es') {
    const forms = es[`#${word}`]
    if (forms) {
      const [one, many] = forms.split('|')
      return `${n} ${n === 1 ? one : (many ?? one)}`
    }
  }
  return `${n} ${n === 1 ? word : plural}`
}

/** "lime and feta", "lima y feta"; three or more get commas. */
export function andList(items: string[]): string {
  try {
    return new Intl.ListFormat(current === 'es' ? 'es' : 'en', {
      style: 'long',
      type: 'conjunction',
    }).format(items)
  } catch {
    return items.join(current === 'es' ? ' y ' : ' and ')
  }
}
