import Link from 'next/link'
import { UtensilsCrossed } from 'lucide-react'

export const metadata = { title: 'Not found' }

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-20 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        <UtensilsCrossed className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-fluid-xl font-semibold tracking-tight">
        That page isn&apos;t on the menu
      </h1>
      <p className="mt-2 text-ink-2">The link may be old, or the recipe was deleted.</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-12 items-center rounded-pill bg-accent px-6 font-semibold text-accent-ink"
      >
        Back to tonight
      </Link>
    </div>
  )
}
