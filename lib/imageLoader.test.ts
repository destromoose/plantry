import { describe, expect, it } from 'vitest'
import { imageProps, isUnsplash, unsplashLoader } from './imageLoader'

describe('unsplashLoader', () => {
  it('replaces the width and keeps the crop', () => {
    const url = unsplashLoader({
      src: 'https://images.unsplash.com/photo-1?auto=format&fit=crop&w=1200&q=80',
      width: 640,
    })
    const u = new URL(url)
    expect(u.searchParams.get('w')).toBe('640')
    expect(u.searchParams.get('fit')).toBe('crop')
    expect(u.searchParams.get('q')).toBe('70')
    expect(u.pathname).toBe('/photo-1')
  })

  it('only resizes Unsplash links', () => {
    expect(isUnsplash('https://images.unsplash.com/photo-1')).toBe(true)
    expect(isUnsplash('https://example.com/a.jpg')).toBe(false)
    expect(imageProps('https://example.com/a.jpg')).toEqual({ unoptimized: true })
    expect(imageProps('https://images.unsplash.com/photo-1')).toHaveProperty('loader')
  })
})
