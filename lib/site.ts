// Where Plantry lives on the web.
//
// The app moved from its first Vercel address to its own domain. Each web address keeps its
// own saved data in the browser, so people opening the old address are moved over with their
// data (see components/shell/SiteMove.tsx and public/move.html).

/** Plantry's home on the web. */
export const SITE_ORIGIN = 'https://plantry.astrolabworks.com'

/** Old addresses that hand people (and their data) over to SITE_ORIGIN. */
export const LEGACY_ORIGINS = ['https://plantry-pi.vercel.app']

export const isLegacyOrigin = (origin: string) => LEGACY_ORIGINS.includes(origin)

/** Saved keys that belong to Plantry and travel with a move. */
export const isPlantryKey = (key: string) =>
  key.startsWith('plantry-') && !key.startsWith('plantry-move')

/** Set on the new address after a move, so the app can say welcome once. */
export const NEW_HOME_KEY = 'plantry-move-welcome'

/** Short, stable fingerprint of a moved payload, so the same data is never offered twice. */
export function fingerprint(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(36) + ':' + text.length.toString(36)
}
