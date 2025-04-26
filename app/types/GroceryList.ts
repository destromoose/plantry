import { Recipe } from './Recipe';

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  checked: boolean;
  note?: string;
  recipeId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GroceryCategory {
  name: string;
  items: GroceryItem[];
}

export interface GroceryList {
  id: string;
  title: string;
  description?: string;
  items: GroceryItem[];
  recipeIds: string[];
  recipes?: Recipe[];
  isCompleted: boolean;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  isShared: boolean;
  sharedWith?: string[];
}

export interface GroceryListFormData {
  title: string;
  description?: string;
  items?: Omit<GroceryItem, 'id' | 'createdAt' | 'updatedAt'>[];
  recipeIds?: string[];
}

export interface GroceryItemFormData {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  note?: string;
  recipeId?: string;
} 