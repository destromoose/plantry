import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-primary">Plantry</span>
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
      
      <section className="container mx-auto px-4 py-24 md:py-32">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12 lg:gap-16">
          <div className="flex flex-col justify-center gap-6">
            <h1 className="text-4xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-5xl md:text-6xl">
              Meal planning <span className="text-primary">made deliciously simple</span>
            </h1>
            <p className="text-xl text-neutral-600 dark:text-neutral-300">
              Recipes, grocery lists, and meal plans that work together seamlessly. Save time, reduce waste, and enjoy cooking again.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/signup" className="btn btn-primary btn-lg">
                Start Planning
              </Link>
              <Link href="/discover" className="btn btn-ghost btn-lg">
                Try AI Recipes
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <div className="relative h-[400px] w-[400px] overflow-hidden rounded-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
              <Image
                src="https://images.unsplash.com/photo-1547592180-85f173990554?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80"
                alt="Delicious food prepared with Plantry"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-neutral-100 dark:bg-neutral-900">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
              Features that make cooking a joy
            </h2>
            <p className="mt-4 text-xl text-neutral-600 dark:text-neutral-300">
              Everything you need to plan, shop, and cook with confidence
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="card p-6">
              <div className="mb-4 rounded-full bg-primary/10 p-3 w-12 h-12 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"></path><line x1="6" x2="18" y1="17" y2="17"></line></svg>
              </div>
              <h3 className="text-xl font-bold">Smart Recipe Collection</h3>
              <p className="mt-2 text-neutral-600 dark:text-neutral-300">
                Import recipes from any website, organize into collections, and find exactly what you need.
              </p>
            </div>
            <div className="card p-6">
              <div className="mb-4 rounded-full bg-primary/10 p-3 w-12 h-12 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>
              </div>
              <h3 className="text-xl font-bold">Meal Planner</h3>
              <p className="mt-2 text-neutral-600 dark:text-neutral-300">
                Plan your meals by day or week. Drag-and-drop recipes to create the perfect balance.
              </p>
            </div>
            <div className="card p-6">
              <div className="mb-4 rounded-full bg-primary/10 p-3 w-12 h-12 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M9 11V6a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v0"></path><path d="M13 11V4a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v7"></path><path d="M17 11V8a2 2 0 0 1 4 0v3"></path><path d="M1 11V9a2 2 0 0 1 2-2h1"></path><path d="M5 11V6a2 2 0 0 1 4 0v5"></path><rect width="22" height="8" x="1" y="11" rx="2"></rect></svg>
              </div>
              <h3 className="text-xl font-bold">Grocery List Generator</h3>
              <p className="mt-2 text-neutral-600 dark:text-neutral-300">
                Automatically create shopping lists from your meal plans. Add, remove, or modify items with ease.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
            How Plantry Works
          </h2>
          <p className="mt-4 text-xl text-neutral-600 dark:text-neutral-300">
            From recipes to grocery shopping in four simple steps
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-xl font-bold">1</span>
            </div>
            <h3 className="text-xl font-bold">Save Recipes</h3>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">
              Import your favorites from any website or browse our collection
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-xl font-bold">2</span>
            </div>
            <h3 className="text-xl font-bold">Plan Meals</h3>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">
              Create weekly or monthly plans by dragging recipes onto calendar days
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-xl font-bold">3</span>
            </div>
            <h3 className="text-xl font-bold">Generate List</h3>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">
              Turn your meal plan into an organized shopping list with one click
            </p>
          </div>
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <span className="text-xl font-bold">4</span>
            </div>
            <h3 className="text-xl font-bold">Shop & Cook</h3>
            <p className="mt-2 text-neutral-600 dark:text-neutral-300">
              Use the mobile app while shopping, then follow recipes when cooking
            </p>
          </div>
        </div>
      </section>

      <section className="bg-primary/5">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-4xl">
              Discover AI Recipe Suggestions
            </h2>
            <p className="mt-4 text-xl text-neutral-600 dark:text-neutral-300">
              Not sure what to cook? Let our AI help create personalized recipe ideas
            </p>
            <div className="mt-8">
              <Link href="/discover" className="btn btn-primary btn-lg">
                Try AI Recipes
              </Link>
            </div>
          </div>
        </div>
      </section>

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
    </main>
  )
} 