// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { GET as status, POST as create } from '@/app/api/sync/route'
import { GET as pull, PUT as push } from '@/app/api/sync/[code]/route'

const params = (code: string) => ({ params: Promise.resolve({ code }) })
const json = (body: unknown) => JSON.stringify(body)

describe('sync API (memory store)', () => {
  it('creates a household, then only accepts saves from the latest revision', async () => {
    expect(await (await status()).json()).toEqual({ enabled: true })

    const made = await create(
      new Request('http://x/api/sync', { method: 'POST', body: json({ doc: { v: 1, n: 1 } }) })
    )
    const { code, rev } = await made.json()
    expect(code).toMatch(/^[A-Z2-9]{12}$/)
    expect(rev).toBe(1)

    const got = await (await pull(new Request('http://x'), params(code))).json()
    expect(got.doc).toEqual({ v: 1, n: 1 })

    const ok = await push(
      new Request('http://x', { method: 'PUT', body: json({ baseRev: 1, doc: { v: 1, n: 2 } }) }),
      params(code)
    )
    expect(ok.status).toBe(200)
    expect((await ok.json()).rev).toBe(2)

    // A phone still on revision 1 is told about revision 2 instead of overwriting it.
    const stale = await push(
      new Request('http://x', { method: 'PUT', body: json({ baseRev: 1, doc: { v: 1, n: 3 } }) }),
      params(code)
    )
    expect(stale.status).toBe(409)
    expect((await stale.json()).doc).toEqual({ v: 1, n: 2 })
  })

  it('accepts codes typed with dashes and lowercase, and rejects junk', async () => {
    const made = await create(new Request('http://x', { method: 'POST', body: json({ doc: {} }) }))
    const { code } = await made.json()
    const pretty = `${code.slice(0, 4)}-${code.slice(4, 8)}-${code.slice(8)}`.toLowerCase()
    expect((await pull(new Request('http://x'), params(pretty))).status).toBe(200)
    expect((await pull(new Request('http://x'), params('nope'))).status).toBe(400)
    expect((await pull(new Request('http://x'), params('ABCDEFGHJKMN'))).status).toBe(404)
  })

  it('refuses huge bodies', async () => {
    const big = 'x'.repeat(2_100_000)
    const res = await create(
      new Request('http://x', { method: 'POST', body: json({ doc: { big } }) })
    )
    expect(res.status).toBe(413)
  })
})
