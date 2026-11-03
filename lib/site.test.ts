import { describe, expect, it } from 'vitest'
import { hasKitchen } from './site'

const saved = (onboarded: boolean) => JSON.stringify({ state: { settings: { onboarded } }, version: 2 })

describe('hasKitchen', () => {
  it('is true only for a kitchen that finished setup', () => {
    expect(hasKitchen(saved(true))).toBe(true)
    expect(hasKitchen(saved(false))).toBe(false)
    expect(hasKitchen(undefined)).toBe(false)
    expect(hasKitchen('not json')).toBe(false)
  })
})
