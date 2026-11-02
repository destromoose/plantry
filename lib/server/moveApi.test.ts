// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { GET as ready, POST as pack } from '@/app/api/move/route'
import { POST as collect } from '@/app/api/move/[token]/route'

const params = (token: string) => ({ params: Promise.resolve({ token }) })
const post = (body: unknown) =>
  new Request('http://x/api/move', { method: 'POST', body: JSON.stringify(body) })

describe('move API (memory store)', () => {
  it('lets only the old address check that the new one is live', async () => {
    const old = await ready(
      new Request('http://x/api/move', { headers: { origin: 'https://plantry-pi.vercel.app' } })
    )
    expect(old.headers.get('access-control-allow-origin')).toBe('https://plantry-pi.vercel.app')
    expect((await old.json()).app).toBe('plantry')
    const other = await ready(
      new Request('http://x/api/move', { headers: { origin: 'https://evil.example' } })
    )
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('hands a package over exactly once', async () => {
    const items = { 'plantry-v1': '{"state":{}}', 'plantry-lang': 'es' }
    const res = await pack(post({ items, fp: 'abc' }))
    const { token } = await res.json()
    expect(token).toMatch(/^[a-f0-9]{32}$/)

    const first = await collect(new Request('http://x', { method: 'POST' }), params(token))
    expect(await first.json()).toEqual({ items, fp: 'abc' })
    const again = await collect(new Request('http://x', { method: 'POST' }), params(token))
    expect(again.status).toBe(404)
  })

  it('only carries Plantry text data', async () => {
    expect((await pack(post({ items: { other: 'x' } }))).status).toBe(400)
    expect((await pack(post({ items: { 'plantry-v1': 5 } }))).status).toBe(400)
    expect((await pack(post({ items: [] }))).status).toBe(400)
    const bad = await collect(new Request('http://x', { method: 'POST' }), params('../nope'))
    expect(bad.status).toBe(400)
  })
})
