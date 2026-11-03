import { describe, expect, it } from 'vitest'
import { canSwipeBack, parentOf, swipeCommits } from './backGesture'

describe('canSwipeBack', () => {
  it('is off on the tab roots and onboarding', () => {
    for (const p of [
      '/',
      '/week',
      '/recipes',
      '/recipes/',
      '/pantry',
      '/shop',
      '/onboarding',
      '/join',
    ])
      expect(canSwipeBack(p)).toBe(false)
  })
  it('is on for screens pushed from a tab', () => {
    for (const p of [
      '/recipes/abc',
      '/recipes/new',
      '/cook/abc',
      '/settings',
      '/household',
      '/history',
    ])
      expect(canSwipeBack(p)).toBe(true)
  })
})

describe('parentOf', () => {
  it('sends a recipe back to the library and the rest to Tonight', () => {
    expect(parentOf('/recipes/abc')).toBe('/recipes')
    expect(parentOf('/recipes/new')).toBe('/recipes')
    expect(parentOf('/settings')).toBe('/')
  })
})

describe('swipeCommits', () => {
  it('needs a third of the screen, or a quick flick', () => {
    expect(swipeCommits(100, 390, 0.1)).toBe(false)
    expect(swipeCommits(150, 390, 0.1)).toBe(true)
    expect(swipeCommits(60, 390, 0.8)).toBe(true)
    expect(swipeCommits(-200, 390, 1)).toBe(false)
  })
})
