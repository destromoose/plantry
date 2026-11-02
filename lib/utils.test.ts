import { describe, expect, it } from 'vitest'
import { keyOf } from './utils'

describe('keyOf', () => {
  it('still singularises plain English names', () => {
    expect(keyOf('Tomatoes')).toBe('tomato')
    expect(keyOf('Berries')).toBe('berry')
    expect(keyOf('Eggs (large)')).toBe('egg')
    expect(keyOf('Swiss cheese')).toBe(keyOf('swiss cheese'))
  })
  it('strips accents so spellings match', () => {
    expect(keyOf('Jalapeños')).toBe('jalapeno')
  })
  it('keeps digits and non-Latin names apart', () => {
    expect(keyOf('2% milk')).not.toBe(keyOf('milk'))
    expect(keyOf('豆腐')).toBe('豆腐')
    expect(keyOf('Лук')).toBe('лук')
    expect(keyOf('豆腐')).not.toBe(keyOf('味噌'))
  })
  it('never returns an empty key for a real name', () => {
    expect(keyOf('🍋')).not.toBe('')
    expect(keyOf('🍋')).not.toBe(keyOf('🥑'))
  })
})

describe('keyOf synonyms', () => {
  it('matches common alternative names and drops describing words', () => {
    expect(keyOf('Chilli flakes')).toBe('chili flake')
    expect(keyOf('Spring onions')).toBe('scallion')
    expect(keyOf('Coriander')).toBe('cilantro')
    expect(keyOf('Large eggs')).toBe('egg')
    expect(keyOf('Free range eggs')).toBe('egg')
    expect(keyOf('Cookies')).toBe('cookie')
    expect(keyOf('Gluten free pasta')).toBe('gluten free pasta')
  })
})
