import { Recipe, RecipeFilters, RecipeFormData } from '@/app/types/Recipe'

// This is a mock API implementation
// In a real implementation, this would make actual API calls to a backend

const DELAY = 500 // Simulate network delay

const mockRecipes: Recipe[] = [
  {
    id: '1',
    title: 'Avocado Toast with Poached Eggs',
    description: 'A simple but delicious breakfast with creamy avocado and perfectly poached eggs.',
    imageUrl: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
    prepTime: 10,
    cookTime: 5,
    servings: 2,
    ingredients: [
      { id: '1-1', name: 'Avocado', quantity: 1, unit: 'whole', category: 'Produce' },
      { id: '1-2', name: 'Eggs', quantity: 2, unit: 'large', category: 'Dairy' },
      { id: '1-3', name: 'Sourdough Bread', quantity: 2, unit: 'slices', category: 'Bakery' },
      { id: '1-4', name: 'Salt', quantity: 0.25, unit: 'tsp', category: 'Spices' },
      { id: '1-5', name: 'Pepper', quantity: 0.25, unit: 'tsp', category: 'Spices' },
      { id: '1-6', name: 'Red Pepper Flakes', quantity: 0.25, unit: 'tsp', category: 'Spices' },
    ],
    instructions: [
      { id: '1-i1', step: 1, text: 'Toast the bread slices until golden and crispy.' },
      { id: '1-i2', step: 2, text: 'Mash the avocado and spread it on the toast. Season with salt and pepper.' },
      { id: '1-i3', step: 3, text: 'Bring a pot of water to a gentle simmer and add a splash of vinegar.' },
      { id: '1-i4', step: 4, text: 'Crack an egg into a small bowl, then gently slide it into the simmering water.' },
      { id: '1-i5', step: 5, text: 'Poach for 3-4 minutes for a runny yolk.' },
      { id: '1-i6', step: 6, text: 'Remove with a slotted spoon, place on top of the avocado toast.' },
      { id: '1-i7', step: 7, text: 'Sprinkle with red pepper flakes and serve immediately.' },
    ],
    tags: [
      { id: 't1', name: 'Breakfast' },
      { id: 't2', name: 'Vegetarian' },
      { id: 't3', name: 'Quick' },
    ],
    notes: 'For extra flavor, try adding a squeeze of lemon juice to the avocado.',
    source: 'Plantry Kitchen',
    createdAt: new Date('2023-01-15'),
    updatedAt: new Date('2023-01-15'),
    userId: 'user1',
    isPublic: true,
    isFavorite: true,
  },
  {
    id: '2',
    title: 'Cilantro Lime Chicken Tacos',
    description: 'Flavorful tacos with zesty marinated chicken and fresh toppings.',
    imageUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=800&q=80',
    prepTime: 15,
    cookTime: 15,
    servings: 4,
    ingredients: [
      { id: '2-1', name: 'Chicken Breast', quantity: 1.5, unit: 'lbs', category: 'Meat' },
      { id: '2-2', name: 'Lime', quantity: 2, unit: 'whole', category: 'Produce' },
      { id: '2-3', name: 'Cilantro', quantity: 0.5, unit: 'cup', category: 'Produce' },
      { id: '2-4', name: 'Corn Tortillas', quantity: 8, unit: 'small', category: 'Bakery' },
      { id: '2-5', name: 'Avocado', quantity: 1, unit: 'whole', category: 'Produce' },
      { id: '2-6', name: 'Red Onion', quantity: 0.5, unit: 'whole', category: 'Produce' },
    ],
    instructions: [
      { id: '2-i1', step: 1, text: 'Combine lime juice, zest, chopped cilantro, minced garlic, salt, and olive oil in a bowl.' },
      { id: '2-i2', step: 2, text: 'Slice chicken into strips and marinate for at least 30 minutes.' },
      { id: '2-i3', step: 3, text: 'Heat a skillet over medium-high heat and cook chicken until done, about 6-8 minutes.' },
      { id: '2-i4', step: 4, text: 'Warm tortillas in a dry pan or directly over a gas flame.' },
      { id: '2-i5', step: 5, text: 'Assemble tacos with chicken, diced avocado, sliced red onion, and additional cilantro.' },
      { id: '2-i6', step: 6, text: 'Serve with lime wedges on the side.' },
    ],
    tags: [
      { id: 't4', name: 'Dinner' },
      { id: 't5', name: 'Mexican' },
      { id: 't6', name: 'Healthy' },
    ],
    createdAt: new Date('2023-02-10'),
    updatedAt: new Date('2023-02-10'),
    userId: 'user1',
    isPublic: true,
    isFavorite: false,
  },
]

// API Functions
export async function getRecipes(filters?: RecipeFilters): Promise<Recipe[]> {
  await new Promise(resolve => setTimeout(resolve, DELAY))
  
  let filtered = [...mockRecipes]
  
  if (filters) {
    if (filters.query) {
      const query = filters.query.toLowerCase()
      filtered = filtered.filter(recipe => 
        recipe.title.toLowerCase().includes(query) || 
        recipe.description.toLowerCase().includes(query)
      )
    }
    
    if (filters.tags && filters.tags.length > 0) {
      filtered = filtered.filter(recipe => 
        recipe.tags.some(tag => filters.tags!.includes(tag.name))
      )
    }
    
    if (filters.ingredients && filters.ingredients.length > 0) {
      filtered = filtered.filter(recipe => 
        filters.ingredients!.every(ingredient => 
          recipe.ingredients.some(ri => ri.name.toLowerCase() === ingredient.toLowerCase())
        )
      )
    }
    
    if (filters.prepTimeMax) {
      filtered = filtered.filter(recipe => recipe.prepTime <= filters.prepTimeMax!)
    }
    
    if (filters.cookTimeMax) {
      filtered = filtered.filter(recipe => recipe.cookTime <= filters.cookTimeMax!)
    }
    
    if (filters.sort) {
      switch (filters.sort) {
        case 'recent':
          filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          break
        case 'quick':
          filtered.sort((a, b) => (a.prepTime + a.cookTime) - (b.prepTime + b.cookTime))
          break
        case 'popular':
          // In a real app, this would sort by some popularity metric
          break
      }
    }
  }
  
  return filtered
}

export async function getRecipeById(id: string): Promise<Recipe | null> {
  await new Promise(resolve => setTimeout(resolve, DELAY))
  return mockRecipes.find(recipe => recipe.id === id) || null
}

export async function createRecipe(data: RecipeFormData): Promise<Recipe> {
  await new Promise(resolve => setTimeout(resolve, DELAY))
  
  const newRecipe: Recipe = {
    id: `new-${Date.now()}`,
    ...data,
    ingredients: data.ingredients.map((ingredient, index) => ({
      ...ingredient,
      id: `new-${Date.now()}-i${index}`,
    })),
    instructions: data.instructions.map((instruction, index) => ({
      ...instruction,
      id: `new-${Date.now()}-step${index}`,
      step: index + 1,
    })),
    tags: data.tags.map((tag, index) => ({
      id: `new-tag-${index}`,
      name: tag,
    })),
    createdAt: new Date(),
    updatedAt: new Date(),
    userId: 'user1', // In a real app, this would be the current user's ID
    isFavorite: false,
  }
  
  mockRecipes.push(newRecipe)
  return newRecipe
}

export async function updateRecipe(id: string, data: Partial<RecipeFormData>): Promise<Recipe | null> {
  await new Promise(resolve => setTimeout(resolve, DELAY))
  
  const index = mockRecipes.findIndex(recipe => recipe.id === id)
  if (index === -1) return null
  
  const updatedRecipe = {
    ...mockRecipes[index],
    ...data,
    updatedAt: new Date(),
  }
  
  mockRecipes[index] = updatedRecipe
  return updatedRecipe
}

export async function deleteRecipe(id: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, DELAY))
  
  const index = mockRecipes.findIndex(recipe => recipe.id === id)
  if (index === -1) return false
  
  mockRecipes.splice(index, 1)
  return true
}

export async function toggleFavorite(id: string): Promise<Recipe | null> {
  await new Promise(resolve => setTimeout(resolve, DELAY))
  
  const index = mockRecipes.findIndex(recipe => recipe.id === id)
  if (index === -1) return null
  
  mockRecipes[index] = {
    ...mockRecipes[index],
    isFavorite: !mockRecipes[index].isFavorite,
    updatedAt: new Date(),
  }
  
  return mockRecipes[index]
} 