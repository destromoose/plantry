import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getMoveStore, MAX_MOVE_BYTES } from '@/lib/server/moveStore'
import { isLegacyOrigin, isPlantryKey } from '@/lib/site'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * "Is the new address live and ready?" The old address asks this across origins before it
 * moves anyone, so nobody is sent to a domain that isn't set up yet.
 */
export async function GET(req: Request) {
  const origin = req.headers.get('origin')
  const headers: Record<string, string> = { ...noStore, Vary: 'Origin' }
  if (origin && isLegacyOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin
  return NextResponse.json({ app: 'plantry', move: !!getMoveStore() }, { headers })
}

/** Pack up this phone's saved data for collection at the new address. */
export async function POST(req: Request) {
  // Packages are only made by Plantry's old address, never by another site's page.
  const origin = req.headers.get('origin')
  if (origin && !isLegacyOrigin(origin))
    return NextResponse.json({ error: 'wrong-origin' }, { status: 403 })
  const store = getMoveStore()
  if (!store) return NextResponse.json({ error: 'not-configured' }, { status: 503 })
  const text = await req.text()
  if (text.length > MAX_MOVE_BYTES)
    return NextResponse.json({ error: 'too-large' }, { status: 413 })
  let body: { items?: unknown; fp?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  const items = body.items
  if (
    !items ||
    typeof items !== 'object' ||
    Array.isArray(items) ||
    !Object.entries(items).every(([k, v]) => isPlantryKey(k) && typeof v === 'string')
  )
    return NextResponse.json({ error: 'bad-items' }, { status: 400 })
  const fp = typeof body.fp === 'string' ? body.fp.slice(0, 64) : ''
  const token = randomBytes(16).toString('hex')
  try {
    await store.put(token, JSON.stringify({ items, fp }))
  } catch {
    return NextResponse.json({ error: 'try-again' }, { status: 502 })
  }
  return NextResponse.json({ token }, { headers: noStore })
}
