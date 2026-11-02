import { CookMode } from '@/components/features/cook/CookMode'

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ date?: string; servings?: string }>
}) {
  const { id } = await params
  const { date, servings } = await searchParams
  const n = Number(servings)
  return (
    <CookMode
      id={id}
      date={typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined}
      servings={Number.isInteger(n) && n >= 1 && n <= 24 ? n : undefined}
    />
  )
}
