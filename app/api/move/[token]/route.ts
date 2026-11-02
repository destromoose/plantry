import { NextResponse } from 'next/server'
import { getMoveStore, isMoveToken } from '@/lib/server/moveStore'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

type Params = { params: Promise<{ token: string }> }

/** Collect a moved phone's data. Each package can be collected once. */
export async function POST(_req: Request, { params }: Params) {
  const store = getMoveStore()
  if (!store) return NextResponse.json({ error: 'not-configured' }, { status: 503 })
  const { token } = await params
  if (!isMoveToken(token)) return NextResponse.json({ error: 'bad-token' }, { status: 400 })
  let text: string | null
  try {
    text = await store.take(token)
  } catch {
    return NextResponse.json({ error: 'try-again' }, { status: 502 })
  }
  if (!text) return NextResponse.json({ error: 'not-found' }, { status: 404, headers: noStore })
  return new NextResponse(text, {
    headers: { ...noStore, 'Content-Type': 'application/json' },
  })
}
