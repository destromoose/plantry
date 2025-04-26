import Link from 'next/link'

export default function Navigation() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-bold text-primary">
            Plantry
          </Link>
        </div>
        <nav className="hidden md:flex">
          <ul className="flex items-center gap-6">
            <li><Link href="/" className="text-sm font-medium hover:text-primary">Home</Link></li>
            <li><Link href="/recipes" className="text-sm font-medium hover:text-primary">Recipes</Link></li>
            <li><Link href="/discover" className="text-sm font-medium hover:text-primary">Discover</Link></li>
            <li><Link href="/premium" className="text-sm font-medium hover:text-primary">Premium</Link></li>
          </ul>
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm font-medium hover:text-primary">Log in</Link>
          <Link href="/signup" className="btn btn-primary btn-sm">Sign up</Link>
        </div>
      </div>
    </header>
  )
} 