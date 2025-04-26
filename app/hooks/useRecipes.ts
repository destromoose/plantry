import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Recipe, RecipeFilters, RecipeFormData } from '@/app/types/Recipe';
import { getRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe, toggleFavorite } from '@/app/api/recipe';

export function useRecipes(filters?: RecipeFilters) {
  return useQuery({
    queryKey: ['recipes', filters],
    queryFn: () => getRecipes(filters),
  });
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: ['recipe', id],
    queryFn: () => getRecipeById(id),
    enabled: !!id,
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: RecipeFormData) => createRecipe(data),
    onSuccess: (newRecipe) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.setQueryData(['recipe', newRecipe.id], newRecipe);
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RecipeFormData> }) => updateRecipe(id, data),
    onSuccess: (updatedRecipe) => {
      if (updatedRecipe) {
        queryClient.invalidateQueries({ queryKey: ['recipes'] });
        queryClient.setQueryData(['recipe', updatedRecipe.id], updatedRecipe);
      }
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
      queryClient.removeQueries({ queryKey: ['recipe', id] });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => toggleFavorite(id),
    onSuccess: (updatedRecipe) => {
      if (updatedRecipe) {
        queryClient.invalidateQueries({ queryKey: ['recipes'] });
        queryClient.setQueryData(['recipe', updatedRecipe.id], updatedRecipe);
      }
    },
  });
} 