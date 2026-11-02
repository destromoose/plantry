'use client'

import Image from 'next/image'
import { UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

const tints = ['bg-terracotta/25', 'bg-saffron/30', 'bg-sage/30', 'bg-plum/20']

export function isUnsplash(url?: string): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'images.unsplash.com'
  } catch {
    return false
  }
}

function tintFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return tints[h % tints.length]
}

/** Fills its parent. Falls back to a tinted placeholder for missing or unsupported hosts. */
export function RecipeImage({ url, seed, sizes, priority, className }: { url?: string; seed: string; sizes: string; priority?: boolean; className?: string }) {
  return (
    <div className={cn('absolute inset-0 bg-surface-2', className)}>
      {isUnsplash(url) ? (
        <Image src={url!} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      ) : (
        <div className={cn('flex h-full w-full items-center justify-center text-ink-3', tintFor(seed))}>
          <UtensilsCrossed className="h-8 w-8" aria-hidden />
        </div>
      )}
    </div>
  )
}
