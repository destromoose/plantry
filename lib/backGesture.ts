// The left-edge swipe back for the home-screen app. Safari draws its own swipe
// back in a browser tab, but an app added to the home screen has none, so
// Plantry adds one on every screen you reach from a tab.

/** The five tab roots and the screens with no way back. */
const roots = new Set(['/', '/week', '/recipes', '/pantry', '/shop'])
const noBack = ['/onboarding', '/join']

/** True when a screen was pushed from somewhere and can be swiped away. */
export function canSwipeBack(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (roots.has(path)) return false
  return !noBack.some((p) => path === p || path.startsWith(p + '/'))
}

/** Where back goes when there is no history to go back to, such as a screen opened from a link. */
export function parentOf(pathname: string): string {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path.startsWith('/recipes/')) return '/recipes'
  return '/'
}

/** How far, as a share of the screen, and how fast a swipe has to go to count. */
export function swipeCommits(dx: number, width: number, velocity: number): boolean {
  if (dx <= 0) return false
  return dx > width * 0.35 || (dx > 40 && velocity > 0.5)
}

// A screen can take over what back means, such as cook mode asking first when a timer runs.
let handler: (() => void) | null = null

export function setBackHandler(fn: (() => void) | null) {
  handler = fn
}

export function backHandler() {
  return handler
}
