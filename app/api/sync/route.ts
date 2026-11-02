import { NextResponse } from 'next/server'
import { getSyncStore } from '@/lib/server/syncStore'
import { newHouseholdCode } from '@/lib/syncCode'
import { MAX_DOC_BYTES } from '@/lib/syncDoc'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

/** Is sync set up on this server? */
export async function GET() {
  return NextResponse.json({ enabled: !!getSyncStore() }, { headers: noStore })
}

/** Start sharing: make a new household with this phone's data. */
export async function POST(req: Request) {
  const store = getSyncStore()
  if (!store) return NextResponse.json({ error: 'not-configured' }, { status: 503 })
  const text = await req.text()
  if (text.length > MAX_DOC_BYTES)
    return NextResponse.json({ error: 'too-large' }, { status: 413 })
  let body: { doc?: unknown }
  try {
    body = JSON.parse(text)
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 })
  }
  if (!body.doc || typeof body.doc !== 'object')
    return NextResponse.json({ error: 'no-doc' }, { status: 400 })
  // A fresh code is free in practice; retry on the off chance it isn't.
  for (let i = 0; i < 3; i++) {
    const code = newHouseholdCode()
    const res = await store.put(code, 0, body.doc)
    if (res.ok) return NextResponse.json({ code, rev: res.rev }, { headers: noStore })
  }
  return NextResponse.json({ error: 'try-again' }, { status: 500 })
}
