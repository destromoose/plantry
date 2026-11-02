import { RecipeEditor } from '@/components/features/recipes/RecipeEditor'

export const metadata = { title: 'Recipe editor' }

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; tab?: string; url?: string; text?: string }>
}) {
  const { id, tab, url, text } = await searchParams
  return (
    <RecipeEditor
      editId={id}
      initialTab={tab === 'link' ? 'link' : tab === 'paste' ? 'paste' : 'type'}
      sharedUrl={url}
      sharedText={text}
    />
  )
}
