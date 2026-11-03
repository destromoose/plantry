import type { ImageLoaderProps } from 'next/image'

/** True for Unsplash links, which can be resized by changing the w= parameter. */
export function isUnsplash(url: string): boolean {
  try {
    return new URL(url).hostname === 'images.unsplash.com'
  } catch {
    return false
  }
}

/** Asks Unsplash for a picture as wide as the screen needs, so phones don't download desktop-sized photos. */
export function unsplashLoader({ src, width, quality }: ImageLoaderProps): string {
  const u = new URL(src)
  u.searchParams.set('auto', 'format')
  u.searchParams.set('fit', 'crop')
  u.searchParams.set('w', String(width))
  u.searchParams.set('q', String(quality ?? 70))
  return u.toString()
}

/** Props for next/image: resize Unsplash photos, load anything else as it is. */
export function imageProps(url: string) {
  return isUnsplash(url) ? { loader: unsplashLoader } : { unoptimized: true }
}
