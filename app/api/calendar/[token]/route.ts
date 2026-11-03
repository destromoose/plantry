import { getSyncStore } from '@/lib/server/syncStore'
import { buildFeed, calendarKey, type FeedInput, type FeedLang } from '@/lib/calendarFeed'
import { SITE_ORIGIN } from '@/lib/site'
import { toDateKey } from '@/lib/utils'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ token: string }> }

const REFRESH_AFTER_MS = 1000 * 60 * 60 * 24 * 30

/** The household's plan as an .ics feed. */
export async function GET(req: Request, { params }: Params) {
  const store = getSyncStore()
  if (!store) return new Response('Calendar is not set up here.', { status: 503 })
  const token = (await params).token.replace(/\.ics$/i, '').toLowerCase()
  if (!/^[0-9a-f]{24}$/.test(token)) return new Response('Not found', { status: 404 })
  const link = await store.get(calendarKey(token))
  const code = (link?.doc as { code?: unknown } | undefined)?.code
  if (!link || typeof code !== 'string') return new Response('Not found', { status: 404 })
  const household = await store.get(code)
  if (!household) return new Response('Not found', { status: 404 })

  // Calendar apps keep fetching while someone is subscribed; keep the link alive with them.
  if (Date.now() - Date.parse(link.updatedAt) > REFRESH_AFTER_MS)
    await store.put(calendarKey(token), link.rev, link.doc).catch(() => undefined)

  const doc = household.doc as Partial<FeedInput>
  const lang: FeedLang = new URL(req.url).searchParams.get('lang') === 'es' ? 'es' : 'en'
  const body = buildFeed(
    {
      members: Array.isArray(doc.members) ? doc.members : [],
      recipes: Array.isArray(doc.recipes) ? doc.recipes : [],
      plan: Array.isArray(doc.plan) ? doc.plan : [],
    },
    { today: toDateKey(new Date()), origin: SITE_ORIGIN, lang }
  )
  return new Response(body, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="plantry.ics"',
      'Cache-Control': 'no-store',
    },
  })
}
