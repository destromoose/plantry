import { NextResponse } from 'next/server'
import { getSyncStore } from '@/lib/server/syncStore'
import { normalizeCode } from '@/lib/syncCode'
import { calendarKey, calendarToken } from '@/lib/calendarFeed'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/**
 * Make (or find) the household's calendar link. The link carries a token, not the household
 * code, so a calendar app or anyone it's shared with can see the plan but never change it.
 */
export async function POST(req: Request) {
  const store = getSyncStore()
  if (!store) return NextResponse.json({ error: 'not-configured' }, { status: 503 })
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'bad-body' }, { status: 400 })
  }
  const raw = (body as { code?: unknown } | null)?.code
  const code = typeof raw === 'string' ? normalizeCode(raw) : undefined
  if (!code) return NextResponse.json({ error: 'bad-code' }, { status: 400 })
  if (!(await store.get(code)))
    return NextResponse.json({ error: 'not-found' }, { status: 404, headers: noStore })
  const token = await calendarToken(code)
  const key = calendarKey(token)
  const cur = await store.get(key)
  // Save it again now and then, so a link in use never expires.
  await store.put(key, cur?.rev ?? 0, { code })
  return NextResponse.json({ token }, { headers: noStore })
}
