'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { isImageUrl } from '@/components/features/recipes/RecipeImage'

/** A small recipe image with a plain background when there is none or it fails to load. */
export function Thumb({
  src,
  className,
  sizes = '80px',
}: {
  src?: string
  className?: string
  sizes?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-surface-2', className)}>
      {src && isImageUrl(src) && failed !== src && (
        <Image
          src={src.trim()}
          alt=""
          fill
          unoptimized
          sizes={sizes}
          className="object-cover"
          onError={() => setFailed(src)}
        />
      )}
    </div>
  )
}
