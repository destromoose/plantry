import React, { useState } from 'react'
import { GroceryItem, GroceryCategory } from '@/app/types/GroceryList'

interface GroceryListProps {
  items: GroceryItem[]
  onCheck: (id: string, checked: boolean) => void
  onDelete: (id: string) => void
}

export default function GroceryList({ items, onCheck, onDelete }: GroceryListProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Group items by category
  const categorizedItems = items.reduce<Record<string, GroceryItem[]>>((acc, item) => {
    const category = item.category || 'Other'
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category].push(item)
    return acc
  }, {})

  const categories: GroceryCategory[] = Object.keys(categorizedItems).map((name) => ({
    name,
    items: categorizedItems[name],
  }))

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }))
  }

  if (items.length === 0) {
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
          <path d="M9 11V6a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v0"></path>
          <path d="M13 11V4a2 2 0 0 1 2-2v0a2 2 0 0 1 2 2v7"></path>
          <path d="M17 11V8a2 2 0 0 1 4 0v3"></path>
          <path d="M1 11V9a2 2 0 0 1 2-2h1"></path>
          <path d="M5 11V6a2 2 0 0 1 4 0v5"></path>
          <rect width="22" height="8" x="1" y="11" rx="2"></rect>
        </svg>
        <h3 className="text-lg font-medium">Your grocery list is empty</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Add items manually or generate a list from your meal plan.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {categories.map((category) => (
        <div key={category.name} className="rounded-md border border-neutral-200 dark:border-neutral-800">
          <div
            className="flex cursor-pointer items-center justify-between p-3"
            onClick={() => toggleCategory(category.name)}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{category.name}</span>
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800">
                {category.items.length}
              </span>
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-neutral-500 transition-transform ${
                expandedCategories[category.name] ? 'rotate-180' : ''
              }`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          <div
            className={`border-t border-neutral-200 px-3 py-1 dark:border-neutral-800 ${
              expandedCategories[category.name] === false ? 'hidden' : ''
            }`}
          >
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {category.items.map((item) => (
                <li key={item.id} className="flex items-center py-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => onCheck(item.id, e.target.checked)}
                    className="mr-3 h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary dark:border-neutral-600"
                  />
                  <div className="flex flex-grow items-center">
                    <span className={`${item.checked ? 'text-neutral-400 line-through' : ''}`}>
                      {item.name}
                    </span>
                    <span className="ml-2 text-sm text-neutral-500">
                      {item.quantity} {item.unit}
                    </span>
                  </div>
                  <button
                    onClick={() => onDelete(item.id)}
                    className="ml-2 rounded-full p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-500 dark:hover:bg-neutral-800"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  )
} 