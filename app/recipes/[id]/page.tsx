import { RecipeDetail } from '@/components/features/recipes/RecipeDetail'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <RecipeDetail id={id} />
}
