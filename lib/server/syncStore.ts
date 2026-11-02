// Where shared households live on the server: one JSON document per household code,
// with a revision number so two phones saving at once can't overwrite each other.
//
// Uses Upstash Redis over its REST API when configured (Vercel's Upstash integration sets
// KV_REST_API_URL and KV_REST_API_TOKEN; a direct Upstash database sets UPSTASH_REDIS_REST_*).
// Without it, an in-memory store is used for local development and tests only.

export interface Stored {
  rev: number
  doc: unknown
  updatedAt: string
}

export type PutResult = { ok: true; rev: number } | { ok: false; current: Stored | null }

export interface SyncStore {
  get(code: string): Promise<Stored | null>
  /** Save only if the stored revision is still `baseRev` (0 for a new household). */
  put(code: string, baseRev: number, doc: unknown): Promise<PutResult>
}

/** Households untouched for this long are removed, so abandoned data doesn't pile up. */
const TTL_SECONDS = 60 * 60 * 24 * 400

const key = (code: string) => `plantry:household:${code}`

function memoryStore(): SyncStore {
  const g = globalThis as unknown as { __plantrySync?: Map<string, Stored> }
  const map = (g.__plantrySync ??= new Map())
  return {
    async get(code) {
      return map.get(code) ?? null
    },
    async put(code, baseRev, doc) {
      const cur = map.get(code) ?? null
      if ((cur?.rev ?? 0) !== baseRev) return { ok: false, current: cur }
      const next = { rev: baseRev + 1, doc, updatedAt: new Date().toISOString() }
      map.set(code, next)
      return { ok: true, rev: next.rev }
    },
  }
}

// Compare-and-set in one step on the Redis side.
const CAS = `
local cur = redis.call('GET', KEYS[1])
local rev = 0
if cur then rev = tonumber(cjson.decode(cur).rev) end
if rev ~= tonumber(ARGV[1]) then return cur or '' end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 'OK'
`

function upstashStore(url: string, token: string): SyncStore {
  async function call(cmd: (string | number)[]) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmd),
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`Upstash ${res.status}`)
    const body = (await res.json()) as { result?: unknown; error?: string }
    if (body.error) throw new Error(body.error)
    return body.result
  }
  const parse = (v: unknown): Stored | null => {
    if (typeof v !== 'string' || !v) return null
    try {
      return JSON.parse(v) as Stored
    } catch {
      return null
    }
  }
  return {
    async get(code) {
      return parse(await call(['GET', key(code)]))
    },
    async put(code, baseRev, doc) {
      const next: Stored = { rev: baseRev + 1, doc, updatedAt: new Date().toISOString() }
      const r = await call(['EVAL', CAS, 1, key(code), baseRev, JSON.stringify(next), TTL_SECONDS])
      if (r === 'OK') return { ok: true, rev: next.rev }
      return { ok: false, current: parse(r) }
    },
  }
}

export function syncConfigured() {
  return !!(
    (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) ||
    (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  )
}

/** The store to use, or null when sync isn't set up on this deployment. */
export function getSyncStore(): SyncStore | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (url && token) return upstashStore(url, token)
  // Memory only outside production, or when explicitly allowed (a single-server deploy).
  if (process.env.NODE_ENV !== 'production' || process.env.PLANTRY_SYNC_MEMORY === '1')
    return memoryStore()
  return null
}
