import { RecipeEditor } from '@/components/features/recipes/RecipeEditor'

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; tab?: string }>
}) {
  const { id, tab } = await searchParams
  return <RecipeEditor editId={id} initialTab={tab === 'link' ? 'paste' : 'type'} />
}
