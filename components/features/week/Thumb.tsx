import Image from 'next/image'
import { cn } from '@/lib/utils'

/** A small recipe image with a placeholder background. */
export function Thumb({ src, className, sizes = '80px' }: { src?: string; className?: string; sizes?: string }) {
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-surface-2', className)}>
      {src && <Image src={src} alt="" fill sizes={sizes} className="object-cover" />}
    </div>
  )
}
