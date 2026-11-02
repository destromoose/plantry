import { NextResponse } from 'next/server'
import { extractRecipe } from '@/lib/importRecipe'
import { FetchRefused, fetchPublicPage } from '@/lib/server/safeFetch'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'no-store' }

/** Reads the recipe on a public web page: GET /api/import?url=https://… */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url')?.trim()
  if (!url || url.length > 2000)
    return NextResponse.json({ error: 'bad-url' }, { status: 400, headers: noStore })
  try {
    const page = await fetchPublicPage(url)
    const recipe = extractRecipe(page.html, page.url)
    if (!recipe) return NextResponse.json({ error: 'no-recipe' }, { status: 422, headers: noStore })
    return NextResponse.json({ recipe }, { headers: noStore })
  } catch (e) {
    const code = e instanceof FetchRefused ? e.message : 'unreachable'
    const status = code === 'bad-url' || code === 'private' ? 400 : 502
    return NextResponse.json({ error: code }, { status, headers: noStore })
  }
}
