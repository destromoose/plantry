import { describe, expect, it } from 'vitest'
import { POST } from '@/app/api/calendar/route'
import { GET } from '@/app/api/calendar/[token]/route'
import { getSyncStore } from './syncStore'
import { addDays, toDateKey } from '../utils'

describe('calendar link', () => {
  it('gives a read-only feed for a household', async () => {
    const store = getSyncStore()!
    await store.put('ABCDEFGHJKMN', 0, {
      members: [{ id: 'm1', name: 'Sam' }],
      recipes: [{ id: 'r1', title: 'Dal', ingredients: [] }],
      plan: [
        {
          id: 'p',
          date: addDays(toDateKey(new Date()), 2),
          slot: 'dinner',
          recipeId: 'r1',
          cookId: 'm1',
        },
      ],
    })
    const post = (code: string) =>
      POST(new Request('http://x/api/calendar', { method: 'POST', body: JSON.stringify({ code }) }))
    expect((await post('nope')).status).toBe(400)
    expect((await post('ABCD-EFGH-JKMP')).status).toBe(404)
    const res = await post('abcd-efgh-jkmn')
    const { token } = (await res.json()) as { token: string }
    expect(token).not.toContain('ABCD')
    // Asking twice gives the same link.
    expect(((await (await post('ABCDEFGHJKMN')).json()) as { token: string }).token).toBe(token)

    const feed = await GET(new Request(`http://x/api/calendar/${token}.ics`), {
      params: Promise.resolve({ token: `${token}.ics` }),
    })
    expect(feed.headers.get('Content-Type')).toContain('text/calendar')
    expect(await feed.text()).toContain('SUMMARY:Dal · Sam cooks')

    const bad = await GET(new Request('http://x'), {
      params: Promise.resolve({ token: '0'.repeat(24) }),
    })
    expect(bad.status).toBe(404)
  })
})
