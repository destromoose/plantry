import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <h4 className="text-lg font-bold">Plantry</h4>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
              Your personal meal planner and recipe keeper with smart grocery list generator
            </p>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase text-neutral-500">Features</h4>
            <ul className="mt-2 space-y-2">
              <li><Link href="/recipes" className="text-sm hover:text-primary">Recipes</Link></li>
              <li><Link href="/planner" className="text-sm hover:text-primary">Meal Planner</Link></li>
              <li><Link href="/grocery" className="text-sm hover:text-primary">Grocery Lists</Link></li>
              <li><Link href="/discover" className="text-sm hover:text-primary">AI Recipes</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase text-neutral-500">Company</h4>
            <ul className="mt-2 space-y-2">
              <li><Link href="/about" className="text-sm hover:text-primary">About</Link></li>
              <li><Link href="/premium" className="text-sm hover:text-primary">Premium</Link></li>
              <li><Link href="/blog" className="text-sm hover:text-primary">Blog</Link></li>
              <li><Link href="/contact" className="text-sm hover:text-primary">Contact</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-bold uppercase text-neutral-500">Legal</h4>
            <ul className="mt-2 space-y-2">
              <li><Link href="/privacy" className="text-sm hover:text-primary">Privacy</Link></li>
              <li><Link href="/terms" className="text-sm hover:text-primary">Terms</Link></li>
              <li><Link href="/cookies" className="text-sm hover:text-primary">Cookies</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-neutral-200 pt-8 dark:border-neutral-800">
          <p className="text-center text-sm text-neutral-500">
            © {new Date().getFullYear()} Plantry. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
} 