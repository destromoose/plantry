import { describe, expect, it } from 'vitest'
import { cautionsFor, withFahrenheit } from './safety'

describe('safety', () => {
  it('adds Fahrenheit next to Celsius', () => {
    expect(withFahrenheit('Heat the oven to 200°C.')).toBe('Heat the oven to 200°C (390°F).')
    expect(withFahrenheit('Bake at 180 °C (350°F)')).toBe('Bake at 180 °C (350°F)')
  })
  it('finds hot and sharp steps', () => {
    expect(cautionsFor('Heat the oil in a pan and fry the onion').map((c) => c.kind)).toContain(
      'hot'
    )
    expect(cautionsFor('Finely chop the parsley').map((c) => c.kind)).toEqual(['sharp'])
    expect(cautionsFor('Stir in the yogurt')).toEqual([])
  })
})
