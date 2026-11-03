'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { imageProps } from '@/lib/imageLoader'

const tints = ['bg-terracotta/25', 'bg-saffron/30', 'bg-sage/30', 'bg-plum/20']

/** Any https link can be shown. Images load straight from the browser. */
export function isImageUrl(url?: string): boolean {
  if (!url) return false
  try {
    return new URL(url.trim()).protocol === 'https:'
  } catch {
    return false
  }
}

function tintFor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return tints[h % tints.length]
}

/** Fills its parent. Falls back to a tinted placeholder when there is no picture or it fails to load. */
export function RecipeImage({
  url,
  seed,
  sizes,
  priority,
  className,
}: {
  url?: string
  seed: string
  sizes: string
  priority?: boolean
  className?: string
}) {
  // Remember which link failed, so a new link gets a fresh try.
  const [failed, setFailed] = useState<string | null>(null)
  const show = isImageUrl(url) && failed !== url
  return (
    <div className={cn('absolute inset-0 bg-surface-2', className)}>
      {show ? (
        <Image
          src={url!.trim()}
          alt=""
          fill
          {...imageProps(url!.trim())}
          sizes={sizes}
          priority={priority}
          fetchPriority={priority ? 'high' : undefined}
          className="object-cover"
          onError={() => setFailed(url!)}
        />
      ) : (
        <div
          className={cn('flex h-full w-full items-center justify-center text-ink-3', tintFor(seed))}
        >
          <UtensilsCrossed className="h-8 w-8" aria-hidden />
        </div>
      )}
    </div>
  )
}
