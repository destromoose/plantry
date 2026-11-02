import { NextResponse } from 'next/server'
import { getSyncStore, type SyncStore } from '@/lib/server/syncStore'
import { normalizeCode } from '@/lib/syncCode'
import { MAX_DOC_BYTES } from '@/lib/syncDoc'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

type Params = { params: Promise<{ code: string }> }

async function setup(
  params: Params['params']
): Promise<NextResponse | { store: SyncStore; code: string }> {
  const store = getSyncStore()
  if (!store) return NextResponse.json({ error: 'not-configured' }, { status: 503 })
  const code = normalizeCode((await params).code)
  if (!code) return NextResponse.json({ error: 'bad-code' }, { status: 400 })
  return { store, code }
}

/** The household's latest data and revision. */
export async function GET(_req: Request, { params }: Params) {
  const s = await setup(params)
  if (s instanceof NextResponse) return s
  const cur = await s.store.get(s.code)
  if (!cur) return NextResponse.json({ error: 'not-found' }, { status: 404, headers: noStore })
  return NextResponse.json(cur, { headers: noStore })
}

/**
 * Save new data. `baseRev` must be the revision the phone last saw; if another phone saved
 * since, the answer is 409 with the newer data, so the phone can merge and try again.
 */
export async function PUT(req: Request, { params }: Params) {
  const s = await setup(params)
  if (s instanceof NextResponse) return s
  const text = await req.text()
  if (text.length > MAX_DOC_BYTES)
    return NextResponse.json({ error: 'too-large' }, { status: 413 })
  let body: { baseRev?: unknown; doc?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  if (typeof body.baseRev !== 'number' || !body.doc || typeof body.doc !== 'object')
    return NextResponse.json({ error: 'bad-body' }, { status: 400 })
  // Only existing households can be written; new ones come from POST /api/sync.
  if (body.baseRev < 1) return NextResponse.json({ error: 'bad-rev' }, { status: 400 })
  const res = await s.store.put(s.code, body.baseRev, body.doc)
  if (res.ok) return NextResponse.json({ rev: res.rev }, { headers: noStore })
  if (!res.current) return NextResponse.json({ error: 'not-found' }, { status: 404 })
  return NextResponse.json(res.current, { status: 409, headers: noStore })
}
