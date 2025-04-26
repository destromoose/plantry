import { Recipe } from './Recipe';

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'other';

export interface MealEntry {
  id: string;
  date: Date;
  mealType: MealType;
  recipeId: string;
  recipe?: Recipe;
  servings: number;
  notes?: string;
}

export interface DailyPlan {
  date: Date;
  meals: MealEntry[];
}

export interface MealPlan {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  entries: MealEntry[];
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  isShared: boolean;
  sharedWith?: string[];
}

export interface MealPlanFormData {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
}

export interface MealEntryFormData {
  date: Date;
  mealType: MealType;
  recipeId: string;
  servings: number;
  notes?: string;
} 