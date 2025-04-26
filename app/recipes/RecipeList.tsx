'use client'

import React, { useState } from 'react'
import RecipeCard from '@/app/components/features/recipes/RecipeCard'
import { useRecipes } from '@/app/hooks/useRecipes'
import { RecipeFilters } from '@/app/types/Recipe'

export default function RecipeList() {
  const [filters, setFilters] = useState<RecipeFilters>({
    sort: 'recent',
  })
  
  const { data: recipes, isLoading, error } = useRecipes(filters)
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="card h-80 animate-pulse">
            <div className="h-48 w-full bg-neutral-200 dark:bg-neutral-800"></div>
            <div className="p-4">
              <div className="mb-2 h-6 w-3/4 bg-neutral-200 dark:bg-neutral-800"></div>
              <div className="h-4 w-1/2 bg-neutral-200 dark:bg-neutral-800"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-red-500"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">Error loading recipes</h3>
            <div className="mt-2 text-sm text-red-700 dark:text-red-300">
              <p>Failed to load recipes. Please try again later.</p>
            </div>
          </div>
        </div>
      </div>
    )
  }
  
  if (!recipes || recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-8 text-center dark:border-neutral-700 dark:bg-neutral-900">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-3 text-neutral-400"
        >
          <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"></path>
          <line x1="6" x2="18" y1="17" y2="17"></line>
        </svg>
        <h3 className="text-lg font-medium">No recipes found</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Try adjusting your search or filters to find what you're looking for.
        </p>
      </div>
    )
  }
  
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe) => (
        <RecipeCard key={recipe.id} recipe={recipe} />
      ))}
    </div>
  )
} 