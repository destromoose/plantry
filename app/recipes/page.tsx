import React from 'react'
import Link from 'next/link'
import { Metadata } from 'next'
import RecipeList from '@/app/recipes/RecipeList'

export const metadata: Metadata = {
  title: 'Recipes | Plantry',
  description: 'Browse and discover new recipes for your meal planning',
}

export default function RecipesPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recipes</h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-300">
            Browse our collection or save your own favorite recipes
          </p>
        </div>
        <Link
          href="/recipes/new"
          className="btn btn-primary"
        >
          Add Recipe
        </Link>
      </div>
      
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <input
            type="text"
            placeholder="Search recipes..."
            className="input w-full pl-10"
          />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.3-4.3"></path>
          </svg>
        </div>
        
        <div>
          <select className="input w-full appearance-none">
            <option value="">Filter by category</option>
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
            <option value="dessert">Dessert</option>
            <option value="snack">Snack</option>
          </select>
        </div>
        
        <div>
          <select className="input w-full appearance-none">
            <option value="recent">Most Recent</option>
            <option value="popular">Most Popular</option>
            <option value="quick">Quick & Easy</option>
          </select>
        </div>
      </div>
      
      <RecipeList />
      
      <div className="mt-8 flex justify-center">
        <nav className="flex space-x-1">
          <span className="btn btn-secondary">Previous</span>
          <span className="btn btn-primary">1</span>
          <span className="btn btn-ghost">2</span>
          <span className="btn btn-ghost">3</span>
          <span className="btn btn-secondary">Next</span>
        </nav>
      </div>
    </main>
  )
} 