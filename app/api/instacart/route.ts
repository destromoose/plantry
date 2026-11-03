import { NextResponse } from 'next/server'
import { toLineItems, type ListItem } from '@/lib/instacart'
import { SITE_ORIGIN } from '@/lib/site'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }
const apiBase = () => process.env.INSTACART_API_URL || 'https://connect.instacart.com'

/** Whether this copy of Plantry can send lists to Instacart. */
export async function GET() {
  return NextResponse.json({ enabled: !!process.env.INSTACART_API_KEY }, { headers: noStore })
}

/** Turn a shopping list into an Instacart link the person opens to fill their cart. */
export async function POST(req: Request) {
  const key = process.env.INSTACART_API_KEY
  if (!key) return NextResponse.json({ error: 'not-configured' }, { status: 503 })
  let body: { items?: unknown; title?: unknown }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'bad-body' }, { status: 400 })
  }
  const items = Array.isArray(body.items)
    ? (body.items as unknown[]).filter(
        (i): i is ListItem =>
          !!i && typeof i === 'object' && typeof (i as ListItem).name === 'string'
      )
    : []
  const line_items = toLineItems(items)
  if (!line_items.length) return NextResponse.json({ error: 'empty' }, { status: 400 })
  const title =
    typeof body.title === 'string' && body.title.trim()
      ? body.title.trim().slice(0, 80)
      : 'Plantry list'

  try {
    const res = await fetch(`${apiBase()}/idp/v1/products/products_link`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        title,
        link_type: 'shopping_list',
        expires_in: 7,
        line_items,
        landing_page_configuration: { partner_linkback_url: `${SITE_ORIGIN}/shop` },
      }),
      cache: 'no-store',
    })
    const out = (await res.json().catch(() => ({}))) as { products_link_url?: string }
    if (!res.ok || !out.products_link_url)
      return NextResponse.json({ error: 'instacart' }, { status: 502, headers: noStore })
    return NextResponse.json({ url: out.products_link_url }, { headers: noStore })
  } catch {
    return NextResponse.json({ error: 'instacart' }, { status: 502, headers: noStore })
  }
}
