export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  note?: string;
  category?: string;
}

export interface Instruction {
  id: string;
  step: number;
  text: string;
}

export interface RecipeTag {
  id: string;
  name: string;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  prepTime: number; // minutes
  cookTime: number; // minutes
  servings: number;
  ingredients: Ingredient[];
  instructions: Instruction[];
  tags: RecipeTag[];
  notes?: string;
  source?: string;
  sourceUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  isPublic: boolean;
  isFavorite: boolean;
}

export interface RecipeFilters {
  query?: string;
  tags?: string[];
  ingredients?: string[];
  prepTimeMax?: number;
  cookTimeMax?: number;
  sort?: 'popular' | 'recent' | 'quick';
}

export interface RecipeFormData {
  title: string;
  description: string;
  imageUrl?: string;
  prepTime: number;
  cookTime: number;
  servings: number;
  ingredients: Omit<Ingredient, 'id'>[];
  instructions: Omit<Instruction, 'id' | 'step'>[];
  tags: string[];
  notes?: string;
  source?: string;
  sourceUrl?: string;
  isPublic: boolean;
} 